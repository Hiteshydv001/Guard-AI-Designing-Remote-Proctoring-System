"""Thin async client for the Clerk Backend API (user + invitation management)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx
from fastapi import HTTPException, status

from .config import settings


@dataclass
class ClerkUser:
    id: str
    email: str | None
    first_name: str | None
    last_name: str | None
    public_metadata: dict[str, Any]

    @property
    def full_name(self) -> str | None:
        name = " ".join(p for p in (self.first_name, self.last_name) if p)
        return name or None


@dataclass
class Invitation:
    id: str
    url: str | None


class ClerkError(HTTPException):
    pass


def _parse_user(data: dict) -> ClerkUser:
    primary = data.get("primary_email_address_id")
    email = None
    for e in data.get("email_addresses") or []:
        if e.get("id") == primary or email is None:
            email = e.get("email_address")
    return ClerkUser(
        id=data["id"],
        email=email,
        first_name=data.get("first_name"),
        last_name=data.get("last_name"),
        public_metadata=data.get("public_metadata") or {},
    )


def split_name(name: str) -> tuple[str, str | None]:
    parts = name.strip().split(maxsplit=1)
    return parts[0], (parts[1] if len(parts) > 1 else None)


class ClerkClient:
    def __init__(self, secret_key: str, base_url: str):
        self.secret_key = secret_key
        self.base_url = base_url.rstrip("/")

    @property
    def configured(self) -> bool:
        return bool(self.secret_key)

    async def _request(self, method: str, path: str, **kwargs) -> Any:
        if not self.configured:
            raise ClerkError(status.HTTP_503_SERVICE_UNAVAILABLE, "CLERK_SECRET_KEY is not configured on the server")
        async with httpx.AsyncClient(timeout=15) as client:
            res = await client.request(
                method,
                f"{self.base_url}{path}",
                headers={"Authorization": f"Bearer {self.secret_key}"},
                **kwargs,
            )
        if res.is_success:
            return res.json() if res.content else None
        try:
            err = res.json()["errors"][0]
            message = err.get("long_message") or err.get("message") or res.text
        except Exception:
            message = res.text[:300]
        code = status.HTTP_404_NOT_FOUND if res.status_code == 404 else status.HTTP_400_BAD_REQUEST
        raise ClerkError(code, f"Clerk: {message}")

    async def get_user(self, user_id: str) -> ClerkUser:
        return _parse_user(await self._request("GET", f"/users/{user_id}"))

    async def create_user(self, *, email: str, name: str, password: str, metadata: dict) -> ClerkUser:
        first, last = split_name(name)
        data = await self._request(
            "POST",
            "/users",
            json={
                "email_address": [email],
                "password": password,
                "first_name": first,
                "last_name": last,
                "public_metadata": metadata,
            },
        )
        return _parse_user(data)

    async def set_password(self, user_id: str, password: str) -> None:
        await self._request("PATCH", f"/users/{user_id}", json={"password": password, "sign_out_of_other_sessions": True})

    async def delete_user(self, user_id: str) -> None:
        await self._request("DELETE", f"/users/{user_id}")

    async def create_invitation(
        self, *, email: str, metadata: dict, redirect_url: str, notify: bool = True, expires_in_days: int = 30
    ) -> Invitation:
        data = await self._request(
            "POST",
            "/invitations",
            json={
                "email_address": email,
                "public_metadata": metadata,
                "redirect_url": redirect_url,
                "notify": notify,
                "ignore_existing": True,
                "expires_in_days": expires_in_days,
            },
        )
        return Invitation(id=data["id"], url=data.get("url"))

    async def revoke_invitation(self, invitation_id: str) -> None:
        await self._request("POST", f"/invitations/{invitation_id}/revoke")


_client = ClerkClient(settings.clerk_secret_key, settings.clerk_api_url)


def get_clerk() -> ClerkClient:
    """FastAPI dependency (overridden in tests)."""
    return _client
