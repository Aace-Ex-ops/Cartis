import os

import psycopg2


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def query(sql: str, params: tuple = ()) -> list[tuple]:
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchall()
