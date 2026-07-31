"""Cloudflare R2 client for model artifacts.

Degrades gracefully: R2 is not enabled yet (account error 10042), so uploads
log and return None instead of crashing the training jobs.
"""
import io
import json
import logging
import os

log = logging.getLogger(__name__)

R2_ENDPOINT = os.environ.get("R2_ENDPOINT", "https://<account>.r2.cloudflarestorage.com")
R2_ACCESS_KEY = os.environ.get("R2_ACCESS_KEY", "")
R2_SECRET_KEY = os.environ.get("R2_SECRET_KEY", "")
BUCKET = os.environ.get("R2_BUCKET", "cartis-models")


def _enabled() -> bool:
    return bool(R2_ACCESS_KEY and R2_SECRET_KEY and "<account>" not in R2_ENDPOINT)


def upload_artifact(key: str, data: bytes, metadata: dict | None = None) -> None:
    if not _enabled():
        log.warning("R2 not configured — skipping upload of %s (enable R2 in the Cloudflare dashboard)", key)
        return
    try:
        import boto3  # lazy import so training works without boto3 installed

        s3 = boto3.client(
            "s3",
            endpoint_url=R2_ENDPOINT,
            aws_access_key_id=R2_ACCESS_KEY,
            aws_secret_access_key=R2_SECRET_KEY,
            region_name="auto",
        )
        s3.put_object(Bucket=BUCKET, Key=key, Body=data, Metadata=metadata or {})
        log.info("uploaded %s", key)
    except Exception as e:  # noqa: BLE001
        log.warning("R2 upload failed for %s: %s", key, e)


def upload_json(key: str, obj: dict) -> None:
    upload_artifact(key, json.dumps(obj, indent=2).encode())
