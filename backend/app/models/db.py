import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import aiosqlite

from app.config import get_settings


def _utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


class Database:
    def __init__(self, path: Optional[str] = None) -> None:
        settings = get_settings()
        self.path = path or settings.database_path
        Path(self.path).parent.mkdir(parents=True, exist_ok=True)

    async def init(self) -> None:
        async with aiosqlite.connect(self.path) as db:
            await db.executescript(
                """
                CREATE TABLE IF NOT EXISTS avatars (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    engine TEXT NOT NULL,
                    image_path TEXT,
                    video_path TEXT,
                    model_path TEXT,
                    config_json TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS sessions (
                    id TEXT PRIMARY KEY,
                    state TEXT NOT NULL,
                    avatar_id TEXT,
                    engine TEXT,
                    dograh_run_id INTEGER,
                    metrics_json TEXT,
                    error TEXT,
                    started_at TEXT,
                    ended_at TEXT,
                    created_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS diagnostics (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT,
                    metric_json TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                """
            )
            await db.commit()

    async def get_setting(self, key: str) -> Optional[str]:
        async with aiosqlite.connect(self.path) as db:
            db.row_factory = aiosqlite.Row
            cur = await db.execute(
                "SELECT value FROM settings WHERE key = ?", (key,)
            )
            row = await cur.fetchone()
            return row["value"] if row else None

    async def set_setting(self, key: str, value: str) -> None:
        async with aiosqlite.connect(self.path) as db:
            await db.execute(
                """
                INSERT INTO settings (key, value, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
                """,
                (key, value, _utcnow()),
            )
            await db.commit()

    async def list_avatars(self) -> list[dict[str, Any]]:
        async with aiosqlite.connect(self.path) as db:
            db.row_factory = aiosqlite.Row
            cur = await db.execute(
                "SELECT * FROM avatars ORDER BY updated_at DESC"
            )
            rows = await cur.fetchall()
            return [self._avatar_row(r) for r in rows]

    async def get_avatar(self, avatar_id: str) -> Optional[dict[str, Any]]:
        async with aiosqlite.connect(self.path) as db:
            db.row_factory = aiosqlite.Row
            cur = await db.execute(
                "SELECT * FROM avatars WHERE id = ?", (avatar_id,)
            )
            row = await cur.fetchone()
            return self._avatar_row(row) if row else None

    async def upsert_avatar(self, avatar: dict[str, Any]) -> dict[str, Any]:
        config = {k: v for k, v in avatar.items() if k not in ("id",)}
        async with aiosqlite.connect(self.path) as db:
            await db.execute(
                """
                INSERT INTO avatars (
                    id, name, engine, image_path, video_path, model_path,
                    config_json, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    name = excluded.name,
                    engine = excluded.engine,
                    image_path = excluded.image_path,
                    video_path = excluded.video_path,
                    model_path = excluded.model_path,
                    config_json = excluded.config_json,
                    updated_at = excluded.updated_at
                """,
                (
                    avatar["id"],
                    avatar["name"],
                    avatar["engine"],
                    avatar.get("image_path"),
                    avatar.get("video_path"),
                    avatar.get("model_path"),
                    json.dumps(config),
                    avatar.get("created_at", _utcnow()),
                    avatar.get("updated_at", _utcnow()),
                ),
            )
            await db.commit()
        result = await self.get_avatar(avatar["id"])
        assert result is not None
        return result

    async def delete_avatar(self, avatar_id: str) -> bool:
        async with aiosqlite.connect(self.path) as db:
            cur = await db.execute(
                "DELETE FROM avatars WHERE id = ?", (avatar_id,)
            )
            await db.commit()
            return cur.rowcount > 0

    async def create_session(self, session: dict[str, Any]) -> None:
        async with aiosqlite.connect(self.path) as db:
            await db.execute(
                """
                INSERT INTO sessions (
                    id, state, avatar_id, engine, dograh_run_id,
                    metrics_json, error, started_at, ended_at, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    session["id"],
                    session["state"],
                    session.get("avatar_id"),
                    session.get("engine"),
                    session.get("dograh_run_id"),
                    json.dumps(session.get("metrics") or {}),
                    session.get("error"),
                    session.get("started_at"),
                    session.get("ended_at"),
                    session.get("created_at", _utcnow()),
                ),
            )
            await db.commit()

    async def update_session(self, session_id: str, **fields: Any) -> None:
        if not fields:
            return
        cols = []
        vals: list[Any] = []
        for key, value in fields.items():
            col = "metrics_json" if key == "metrics" else key
            cols.append(f"{col} = ?")
            vals.append(json.dumps(value) if key == "metrics" else value)
        vals.append(session_id)
        async with aiosqlite.connect(self.path) as db:
            await db.execute(
                f"UPDATE sessions SET {', '.join(cols)} WHERE id = ?",
                vals,
            )
            await db.commit()

    async def get_session(self, session_id: str) -> Optional[dict[str, Any]]:
        async with aiosqlite.connect(self.path) as db:
            db.row_factory = aiosqlite.Row
            cur = await db.execute(
                "SELECT * FROM sessions WHERE id = ?", (session_id,)
            )
            row = await cur.fetchone()
            if not row:
                return None
            return {
                "id": row["id"],
                "state": row["state"],
                "avatar_id": row["avatar_id"],
                "engine": row["engine"],
                "dograh_run_id": row["dograh_run_id"],
                "metrics": json.loads(row["metrics_json"] or "{}"),
                "error": row["error"],
                "started_at": row["started_at"],
                "ended_at": row["ended_at"],
                "created_at": row["created_at"],
            }

    async def add_diagnostic(
        self, metric: dict[str, Any], session_id: Optional[str] = None
    ) -> None:
        async with aiosqlite.connect(self.path) as db:
            await db.execute(
                """
                INSERT INTO diagnostics (session_id, metric_json, created_at)
                VALUES (?, ?, ?)
                """,
                (session_id, json.dumps(metric), _utcnow()),
            )
            await db.commit()

    async def recent_diagnostics(self, limit: int = 50) -> list[dict[str, Any]]:
        async with aiosqlite.connect(self.path) as db:
            db.row_factory = aiosqlite.Row
            cur = await db.execute(
                """
                SELECT session_id, metric_json, created_at
                FROM diagnostics
                ORDER BY id DESC
                LIMIT ?
                """,
                (limit,),
            )
            rows = await cur.fetchall()
            return [
                {
                    "session_id": r["session_id"],
                    "metric": json.loads(r["metric_json"]),
                    "created_at": r["created_at"],
                }
                for r in rows
            ]

    async def count_avatars(self) -> int:
        async with aiosqlite.connect(self.path) as db:
            db.row_factory = aiosqlite.Row
            cur = await db.execute("SELECT COUNT(*) AS c FROM avatars")
            row = await cur.fetchone()
            return int(row["c"])

    def _avatar_row(self, row: aiosqlite.Row) -> dict[str, Any]:
        config = json.loads(row["config_json"])
        return {
            "id": row["id"],
            "name": row["name"],
            "engine": row["engine"],
            "image_path": row["image_path"],
            "video_path": row["video_path"],
            "model_path": row["model_path"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
            **{
                k: v
                for k, v in config.items()
                if k
                not in {
                    "id",
                    "name",
                    "engine",
                    "image_path",
                    "video_path",
                    "model_path",
                    "created_at",
                    "updated_at",
                }
            },
        }


db = Database()
