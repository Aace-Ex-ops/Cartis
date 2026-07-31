"""Job 2 (weekly): price prediction — best-time-to-buy per product from price_index."""
import logging
from datetime import datetime, timezone

from .db import query
from .r2 import upload_artifact, upload_json

log = logging.getLogger(__name__)

SQL = """
SELECT p.gtin, pi.site_name, pi.price, pi.checked_at
FROM price_index pi
JOIN products p ON p.product_id = pi.product_id
WHERE pi.checked_at >= now() - interval '180 days'
ORDER BY pi.checked_at
"""


def train() -> None:
    rows = query(SQL)
    log.info("training on %d price observations", len(rows))
    if len(rows) < 20:
        log.warning("not enough price history — skipping model fit")
        return

    import pickle

    import pandas as pd
    from sklearn.linear_model import LinearRegression

    df = pd.DataFrame(rows, columns=["gtin", "site", "price", "checked_at"])
    df["day"] = df["captured_at"].astype("datetime64[D]").astype(int)
    df["days_since"] = (df["day"] - df["day"].min()).astype(float)
    df["week"] = df["day"] % 7
    df["key"] = df["gtin"] + "@" + df["site"]

    forecasts = {}
    models = {}
    for key, g in df.groupby("key"):
        if len(g) < 5:
            continue
        m = LinearRegression().fit(g[["days_since", "week"]], g["price"])
        models[key] = m
        horizon = g["days_since"].max() + 14  # next 14 days
        forecasts[key] = {
            "gtin": g["gtin"].iloc[0],
            "site": g["site"].iloc[0],
            "current_price": float(g["price"].iloc[-1]),
            "forecast_price": float(m.predict([[horizon, (horizon + 2) % 7]])[0]),
            "drop_probability": 0.5,  # ponytail: constant until residuals are modelled
        }

    version = datetime.now(timezone.utc).strftime("%Y.%m.%d")
    prefix = f"price_prediction/{version}"
    upload_artifact(f"{prefix}/models.pkl", pickle.dumps(models))
    upload_json(
        f"{prefix}/metadata.json",
        {
            "version": version,
            "trained_at": datetime.now(timezone.utc).isoformat(),
            "products": len(models),
            "rows": len(rows),
        },
    )
    upload_json("price_prediction/latest.json", {"version": version, "forecasts": forecasts})
    log.info("price prediction models for %d products uploaded", len(models))
