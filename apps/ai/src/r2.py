"""AWS S3 client for model artifacts.

boto3 uses the default credential chain: AWS_ACCESS_KEY_ID /
AWS_SECRET_ACCESS_KEY / AWS_REGION env vars (or ~/.aws/credentials, or an
EC2 instance role). Replaces the original Cloudflare R2 target (blocked:
account error 10042).
"""
import io
import json
import logging
import os

log = logging.getLogger(__name__)

BUCKET = os.environ.get("S3_BUCKET", "cartis-models")
REGION = os.environ.get("AWS_REGION", "ap-south-2")


def _client():
    import boto3  # lazy import so training works without boto3 installed

    return boto3.client("s3", region_name=REGION)


def upload_artifact(key: str, data: bytes, metadata: dict | None = None) -> None:
    try:
        _client().put_object(Bucket=BUCKET, Key=key, Body=io.BytesIO(data), Metadata=metadata or {})
        log.info("uploaded s3://%s/%s", BUCKET, key)
    except Exception as e:  # noqa: BLE001
        log.warning("S3 upload failed for %s: %s", key, e)


def upload_json(key: str, obj: dict) -> None:
    upload_artifact(key, json.dumps(obj, indent=2).encode())
