"""Clerk session-token verification and role guards."""

from __future__ import annotations

import logging
from dataclasses import dataclass

import jwt
from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Profile
from .config import settings
from .db import get_session

log = logging.getLogger("guardai.auth")
_jwks_client: jwt.PyJWKClient | None = None


def _jwks() -> jwt.PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        if not settings.jwks_url:
            raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "CLERK_ISSUER is not configured")
        _jwks_client = jwt.PyJWKClient(settings.jwks_url, cache_keys=True, lifespan=3600)
    return _jwks_client


@dataclass
class CurrentUser:
    id: str
    profile: Profile | None


def verify_clerk_token(token: str) -> str:
    try:
        key = _jwks().get_signing_key_from_jwt(token).key
        claims = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            issuer=settings.clerk_issuer or None,
            options={"verify_aud": False, "require": ["exp", "sub"]},
            leeway=10,
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, f"Invalid session token: {exc}") from exc

    azp = claims.get("azp")
    trusted = settings.cors_origins and "*" not in settings.cors_origins
    if azp and trusted and azp.rstrip("/") not in settings.cors_origins:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token issued for an unknown origin")
    return claims["sub"]


def read_invitation_ticket(ticket: str) -> dict | None:
    """Verify a Clerk invitation ticket (an RS256 JWT signed with the instance key) and return its claims.

    Expiry is checked by the caller so an expired link can be reported as such. Returns None if the
    ticket is not a genuine invitation ticket for this Clerk instance.
    """
    try:
        keys = _jwks().get_signing_keys()
    except Exception:
        log.warning("Could not load Clerk signing keys to check an invitation ticket")
        return None
    for key in keys:
        try:
            claims = jwt.decode(ticket, key.key, algorithms=["RS256"], options={"verify_aud": False, "verify_exp": False})
        except jwt.PyJWTError:
            continue
        return claims if claims.get("st") == "invitation" and claims.get("sid") else None
    return None


async def current_user(
    authorization: str | None = Header(default=None),
    x_dev_user: str | None = Header(default=None),
    db: AsyncSession = Depends(get_session),
) -> CurrentUser:
    if settings.dev_auth and x_dev_user:
        user_id = x_dev_user.split(":", 1)[0]
    elif authorization and authorization.lower().startswith("bearer "):
        user_id = verify_clerk_token(authorization.split(" ", 1)[1])
    else:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")

    profile = await db.get(Profile, user_id)
    if profile is not None and not profile.active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account has been deactivated")
    return CurrentUser(id=user_id, profile=profile)


async def require_proctor(user: CurrentUser = Depends(current_user)) -> CurrentUser:
    if not user.profile or user.profile.role != "proctor":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Proctor role required")
    return user


async def require_candidate(user: CurrentUser = Depends(current_user)) -> CurrentUser:
    if not user.profile or user.profile.role != "candidate":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Candidate role required")
    return user
