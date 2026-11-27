"""Test setup: SQLite + DEV_AUTH, Clerk replaced by an in-memory fake, ML disabled unless stubbed."""

import os
import tempfile

_tmp = tempfile.mkdtemp(prefix="guardai-test-")
os.environ.update(
    DATABASE_URL=f"sqlite+aiosqlite:///{_tmp}/test.db",
    LOCAL_UPLOAD_DIR=f"{_tmp}/uploads",
    DEV_AUTH="true",
    ML_ENABLED="false",
    SUPABASE_URL="",
    CLERK_SECRET_KEY="sk_test_fake",
)

import itertools  # noqa: E402

import pytest  # noqa: E402
from fastapi import HTTPException  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.core.clerk import ClerkUser, Invitation, get_clerk  # noqa: E402
from app.main import app  # noqa: E402

TINY_JPEG = (
    "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP////////////////////////////////////////////////"
    "//////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////"
    "////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAP/xAAUEAEAAAAAAAAAAAAAAAAAAAAA"
    "/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AKAP/9k="
)


class FakeClerk:
    configured = True

    def __init__(self):
        self.users: dict[str, ClerkUser] = {}
        self.passwords: dict[str, str] = {}
        self.invitations: dict[str, dict] = {}
        self._ids = itertools.count(1)

    async def create_user(self, *, email, name, password, metadata):
        if any(u.email == email for u in self.users.values()):
            raise HTTPException(400, "Clerk: That email address is taken.")
        uid = f"user_fake{next(self._ids)}"
        first, _, last = name.partition(" ")
        self.users[uid] = ClerkUser(uid, email, first, last or None, metadata)
        self.passwords[uid] = password
        return self.users[uid]

    async def get_user(self, user_id):
        if user_id not in self.users:
            raise HTTPException(404, "Clerk: not found")
        return self.users[user_id]

    async def set_password(self, user_id, password):
        self.passwords[user_id] = password

    async def delete_user(self, user_id):
        self.users.pop(user_id, None)

    async def create_invitation(self, *, email, metadata, redirect_url, notify=True, expires_in_days=30):
        iid = f"inv_{next(self._ids)}"
        self.invitations[iid] = {"email": email, "metadata": metadata, "redirect_url": redirect_url, "notify": notify}
        return Invitation(iid, f"https://clerk.test/accept?ticket={iid}")

    async def revoke_invitation(self, invitation_id):
        self.invitations.pop(invitation_id, None)

    def sign_up(self, email: str, name: str) -> str:
        """Simulate an invited student finishing Clerk sign-up."""
        meta = next((i["metadata"] for i in self.invitations.values() if i["email"] == email), {})
        uid = f"user_fake{next(self._ids)}"
        first, _, last = name.partition(" ")
        self.users[uid] = ClerkUser(uid, email, first, last or None, meta)
        return uid


@pytest.fixture(scope="session")
def clerk():
    fake = FakeClerk()
    app.dependency_overrides[get_clerk] = lambda: fake
    yield fake
    app.dependency_overrides.pop(get_clerk, None)


@pytest.fixture(scope="session")
def client(clerk):
    with TestClient(app) as c:
        yield c


def as_user(uid: str) -> dict:
    return {"X-Dev-User": uid}
