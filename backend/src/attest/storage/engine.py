from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from ..config import settings


def _engine():
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    return create_engine(f"sqlite:///{settings.data_dir / 'attest.db'}", echo=False)


engine = _engine()

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
