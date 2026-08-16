"""cartis-ai embed-chats: background job that embeds new chat turns into chat_memories.

Runs as a cron job on the server (every few minutes). Idempotent: rows already
present in chat_memories (UNIQUE(session_id, content)) are skipped, so a crash
mid-batch is safe to re-run. Per-row embedding — each chat_messages row becomes
one memory row.
"""
import json
import logging
import os
import urllib.request

from .db import execute, query

log = logging.getLogger(__name__)

BATCH = 25


def _embed(texts: list[str]) -> list[list[float]]:
    account = os.environ["CF_ACCOUNT_ID"]
    token = os.environ["CF_AI_TOKEN"]
    req = urllib.request.Request(
        f"https://api.cloudflare.com/client/v4/accounts/{account}/ai/run/@cf/baai/bge-m3",
        data=json.dumps({"text": texts}).encode(),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = json.load(resp)
    if not data.get("success"):
        raise RuntimeError(f"CF embed failed: {data.get('errors')}")
    return [vec for vec in data["result"]["data"]]


def train() -> None:
    rows = query(
        """SELECT m.id::text, m.session_id::text, s.user_id::text, m.content
           FROM chat_messages m
           JOIN chat_sessions s ON s.session_id = m.session_id
           LEFT JOIN chat_memories mem
             ON mem.session_id = m.session_id AND mem.content = m.content
           WHERE mem.memory_id IS NULL AND length(m.content) > 0
           ORDER BY m.id
           LIMIT %s""",
        (BATCH,),
    )
    if not rows:
        log.info("embed-chats: nothing to do")
        return
    log.info("embed-chats: processing %d rows", len(rows))
    for message_id, session_id, user_id, content in rows:
        texts = [content[:2000]]
        try:
            (emb,) = _embed(texts)
        except Exception as e:  # noqa: BLE001
            log.warning("embed row %s failed: %s", message_id, e)
            continue
        vec = "[" + ",".join(f"{x:.6f}" for x in emb) + "]"
        execute(
            """INSERT INTO chat_memories (user_id, session_id, content, embedding)
               VALUES (%s::text::uuid, %s::text::uuid, %s, %s::vector)
               ON CONFLICT DO NOTHING""",
            (user_id, session_id, content, vec),
        )
        log.info("embedded row %s (%d chars)", message_id, len(content))