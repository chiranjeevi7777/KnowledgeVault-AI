import os
import sqlite3
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

DB_PATH = os.getenv("METADATA_DB_PATH", "./metadata.db")

def _get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS file_meta (
            file_id TEXT PRIMARY KEY,
            file_name TEXT,
            last_modified TEXT,
            file_type TEXT,
            processed_at TEXT
        )
        """
    )
    return conn

def get_meta(file_id: str):
    conn = _get_conn()
    cur = conn.execute("SELECT file_id, file_name, last_modified, file_type, processed_at FROM file_meta WHERE file_id = ?", (file_id,))
    row = cur.fetchone()
    conn.close()
    if row:
        return {
            "file_id": row[0],
            "file_name": row[1],
            "last_modified": row[2],
            "file_type": row[3],
            "processed_at": row[4],
        }
    return None

def upsert_meta(file_id: str, file_name: str, last_modified: str, file_type: str):
    conn = _get_conn()
    now = datetime.utcnow().isoformat()
    conn.execute(
        "INSERT INTO file_meta (file_id, file_name, last_modified, file_type, processed_at) VALUES (?, ?, ?, ?, ?) "
        "ON CONFLICT(file_id) DO UPDATE SET file_name=excluded.file_name, last_modified=excluded.last_modified, "
        "file_type=excluded.file_type, processed_at=excluded.processed_at",
        (file_id, file_name, last_modified, file_type, now),
    )
    conn.commit()
    conn.close()
    logger.info("Metadata updated for file %s", file_id)
