from __future__ import annotations

import json
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Iterator

from sqlalchemy import text
from sqlalchemy.orm import Session as OrmSession

from ..config import settings
from .base import Base
from .engine import SessionLocal, engine


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def json_dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def json_loads(value: str | None, default: Any = None) -> Any:
    if not value:
        return default
    return json.loads(value)


@contextmanager
def session() -> Iterator[OrmSession]:
    """ORM 会话：自动提交，异常时回滚。"""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


# 兼容旧调用方：提供与原来相同的入口名
@contextmanager
def connection() -> Iterator[OrmSession]:
    yield from session()


def init_db() -> None:
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    with engine.begin() as conn:
        conn.execute(text("PRAGMA journal_mode=WAL"))
        Base.metadata.create_all(conn)


from . import models  # noqa: E402,F401  注册所有模型到 Base.metadata
