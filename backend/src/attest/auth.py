from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from argon2 import PasswordHasher
from fastapi import Cookie, HTTPException, status

from .config import settings
from .storage import session
from .storage.models import Session as SessionRow

password_hasher = PasswordHasher()


def verify_password(password: str) -> bool:
    if settings.auth_password_hash:
        try:
            return password_hasher.verify(settings.auth_password_hash, password)
        except Exception:
            return False
    return secrets.compare_digest(password, settings.auth_password)


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_session() -> str:
    token = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)
    expires = now + timedelta(hours=settings.session_hours)
    with session() as db:
        db.add(SessionRow(token_hash=token_hash(token), created_at=now.isoformat(), expires_at=expires.isoformat()))
    return token


def delete_session(token: str | None) -> None:
    if token:
        with session() as db:
            db.query(SessionRow).filter_by(token_hash=token_hash(token)).delete()


def require_session(attest_session: str | None = Cookie(default=None)) -> str:
    if not attest_session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="authentication required")
    with session() as db:
        row = db.get(SessionRow, token_hash(attest_session))
    if not row or datetime.fromisoformat(row.expires_at) <= datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="authentication required")
    return attest_session
