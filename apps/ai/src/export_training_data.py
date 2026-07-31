"""Job 3 (12h): export labeled training datasets to R2 as Parquet."""
import logging
from datetime import datetime, timezone

from .db import query
from .r2 import upload_artifact, upload_json

log = logging.getLogger(__name__)

SQL = """
SELECT p.name, p.price, p.category, a.verdict, a.user_action,
       a.created_at::date, u.financial_health_score
FROM analysis_log a
JOIN products p ON p.product_id = a.product_id
JOIN users u ON u.user_id = a.user_id
WHERE a.user_action IS NOT NULL
ORDER BY a.created_at
"""


def export() -> None:
    rows = query(SQL)
    log.info("exporting %d labeled rows", len(rows))
    if not rows:
        log.warning("no data to export")
        return

    import io

    import pandas as pd

    df = pd.DataFrame(
        rows,
        columns=["product_name", "price", "category", "coach_verdict", "user_action", "date", "health_score"],
    )
    buf = io.BytesIO()
    df.to_parquet(buf, index=False)

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M")
    key = f"datasets/training_{stamp}.parquet"
    upload_artifact(key, buf.getvalue(), metadata={"rows": str(len(rows))})
    upload_json("datasets/latest.json", {"key": key, "rows": len(rows), "exported_at": stamp})
    log.info("exported %s (%d rows)", key, len(rows))
