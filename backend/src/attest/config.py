from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    data_dir: Path
    auth_password: str
    auth_password_hash: str | None
    session_hours: int
    cookie_secure: bool
    request_interval_seconds: float

    @classmethod
    def from_env(cls) -> "Settings":
        data_dir = Path(os.getenv("ATTEST_DATA_DIR", "./data")).expanduser()
        return cls(
            data_dir=data_dir,
            auth_password=os.getenv("ATTEST_AUTH_PASSWORD", "dev-password"),
            auth_password_hash=os.getenv("ATTEST_AUTH_PASSWORD_HASH"),
            session_hours=int(os.getenv("ATTEST_SESSION_HOURS", "12")),
            cookie_secure=os.getenv("ATTEST_COOKIE_SECURE", "").lower() in ("1", "true", "yes"),
            request_interval_seconds=float(os.getenv("ATTEST_REQUEST_INTERVAL_SECONDS", "1.0")),
        )


settings = Settings.from_env()
