import sqlite3
import os
import json
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "query_history.db")

def _get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with _get_conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS queries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                conversation_id TEXT,
                query TEXT,
                mode TEXT,
                score REAL,
                sources INTEGER,
                result TEXT,
                timestamp TEXT,
                accessed_files TEXT
            )
        """)
        conn.commit()

def log_query(conversation_id: str, query: str, mode: str, score: float, sources: int, result: str, accessed_files: list[str]):
    with _get_conn() as conn:
        conn.execute("""
            INSERT INTO queries (conversation_id, query, mode, score, sources, result, timestamp, accessed_files)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            conversation_id,
            query,
            mode,
            score,
            sources,
            result,
            datetime.now().isoformat(),
            json.dumps(accessed_files)
        ))
        conn.commit()

def get_recent_queries(limit: int = 50) -> list[dict]:
    with _get_conn() as conn:
        rows = conn.execute("SELECT * FROM queries ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
        
        results = []
        for r in rows:
            results.append({
                "id": str(r["id"]),
                "conversation_id": r["conversation_id"],
                "query": r["query"],
                "mode": r["mode"],
                "score": r["score"],
                "sources": r["sources"],
                "result": r["result"],
                "timestamp": r["timestamp"],
                "accessed_files": json.loads(r["accessed_files"] or "[]")
            })
        return results
def get_chart_data() -> dict:
    with _get_conn() as conn:
        rows = conn.execute("""
            SELECT 
                strftime('%H:00', timestamp) as time_bucket,
                COUNT(*) as requests,
                AVG(score) * 100 as accuracy
            FROM queries 
            GROUP BY time_bucket
            ORDER BY timestamp ASC
            LIMIT 24
        """).fetchall()
        
        timeline_data = []
        for r in rows:
            timeline_data.append({
                "time": r["time_bucket"] or "00:00",
                "requests": r["requests"],
                "accuracy": round(r["accuracy"] or 0)
            })

        rows_res = conn.execute("SELECT result, COUNT(*) as count FROM queries GROUP BY result").fetchall()
        colors = {"Success": "#10b981", "Fallback": "#f59e0b"}
        role_data = []
        for r in rows_res:
            res_name = r["result"] or "Unknown"
            role_data.append({
                "name": res_name,
                "value": r["count"],
                "color": colors.get(res_name, "#4f46e5")
            })

        total_queries = conn.execute("SELECT COUNT(*) as c FROM queries").fetchone()["c"]

    return {
        "timelineData": timeline_data,
        "roleData": role_data,
        "total_queries": total_queries
    }

# Initialize on import
init_db()
