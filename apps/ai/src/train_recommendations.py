"""Job 1 (24h): recommendation model — predicts buy vs skip from analysis_log."""
import json
import logging
from datetime import datetime, timezone

from .db import query
from .r2 import upload_artifact, upload_json

log = logging.getLogger(__name__)

SQL = """
SELECT p.name, p.price, p.category, a.verdict, a.user_action
FROM analysis_log a
JOIN products p ON p.product_id = a.product_id
WHERE a.user_action IS NOT NULL
ORDER BY a.created_at DESC
LIMIT 100000
"""


def train() -> None:
    rows = query(SQL)
    log.info("training on %d logged decisions", len(rows))
    if len(rows) < 10:
        log.warning("not enough data — skipping model fit")
        return

    import pickle

    import pandas as pd
    from sklearn.feature_extraction.text import HashingVectorizer
    from sklearn.linear_model import LogisticRegression
    from sklearn.model_selection import cross_val_score

    df = pd.DataFrame(rows, columns=["name", "price", "category", "verdict", "action"])
    df["bought"] = (df["action"] == "bought").astype(int)
    X_text = df["name"].fillna("") + " " + df["category"].fillna("") + " " + df["verdict"].fillna("")
    X = HashingVectorizer(n_features=2**12).fit_transform(X_text)
    y = df["bought"].values
    model = LogisticRegression(max_iter=1000)
    scores = cross_val_score(model, X, y, cv=3)
    model.fit(X, y)
    log.info("cv accuracy: %.3f", scores.mean())

    version = datetime.now(timezone.utc).strftime("%Y.%m.%d")
    prefix = f"recommendations/{version}"
    upload_artifact(f"{prefix}/model.pkl", pickle.dumps(model))
    upload_json(
        f"{prefix}/metadata.json",
        {
            "version": version,
            "trained_at": datetime.now(timezone.utc).isoformat(),
            "rows": len(rows),
            "cv_accuracy": float(scores.mean()),
            "features": "hashing(name+category+verdict)",
        },
    )
    upload_json(
        "recommendations/latest.json",
        {"version": version, "trained_at": datetime.now(timezone.utc).isoformat()},
    )
    log.info("recommendation model %s uploaded", version)
