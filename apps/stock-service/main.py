"""Cartis stock quote service: yfinance -> normalized quote, Redis-cached.

Runs on the EC2 (127.0.0.1:8001), reached via the Rust /setu-proxy
passthrough. Localhost-only, no auth gate needed (the proxy is the door).
"""
import json
import os
import time

import redis
import yfinance as yf
from fastapi import FastAPI
from fastapi.responses import JSONResponse

app = FastAPI()
r = redis.Redis.from_url(os.environ.get("REDIS_URL", "redis://127.0.0.1:6379"), decode_responses=True)
TTL = int(os.environ.get("STOCK_TTL", "300"))


def normalize(sym: str) -> str:
    sym = sym.strip().upper()
    if sym.endswith(".NSE"):
        return sym[:-4] + ".NS"
    if sym.endswith(".BSE"):
        return sym[:-4] + ".BO"
    return sym


def quote_yahoo(sym: str):
    try:
        t = yf.Ticker(sym)
        fi = t.fast_info
        if not fi or fi.get("lastPrice") is None:
            raise LookupError(f"symbol not found: {sym}")
        close = float(fi["lastPrice"])
        prev = float(fi.get("previousClose") or close)
        name = (t.info or {}).get("longName") or fi.get("exchange") or sym
    except KeyError as e:
        raise LookupError(f"symbol not found: {sym}") from e
    return {
        "symbol": sym,
        "name": name,
        "close": f"{close:.2f}",
        "previous_close": f"{prev:.2f}",
        "change": f"{close - prev:.2f}",
        "percent_change": f"{(close - prev) / prev * 100:.2f}" if prev else "0.00",
    }


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/quote")
def quote(symbol: str):
    if not symbol:
        return JSONResponse({"error": "symbol required"}, 400)
    sym = normalize(symbol)
    cached = r.get(f"stock:{sym}")
    if cached:
        return json.loads(cached)
    last_err = None
    for attempt in (sym, sym + ".NS" if "." not in sym else None):
        if not attempt:
            continue
        try:
            out = quote_yahoo(attempt)
            r.set(f"stock:{attempt}", json.dumps(out), ex=TTL)
            if attempt != sym:
                r.set(f"stock:{sym}", json.dumps(out), ex=TTL)
            return out
        except Exception as e:  # noqa: BLE001
            last_err = e
    return JSONResponse({"error": str(last_err or "quote failed")}, 404 if isinstance(last_err, LookupError) else 502)
