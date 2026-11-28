"""Our hand-rolled SigV4 signing must match botocore's reference implementation exactly (R2 and B2 regions)."""

from datetime import UTC, datetime
from unittest import mock
from urllib.parse import parse_qs, urlparse

import pytest
from botocore.auth import S3SigV4Auth, S3SigV4QueryAuth
from botocore.awsrequest import AWSRequest
from botocore.credentials import Credentials

from app.services.s3 import S3Store

NOW = datetime(2026, 11, 27, 14, 30, 5, tzinfo=UTC)
CREDS = Credentials("AKIDEXAMPLE", "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY")
KEY = "exam-1/attempt 2/20261127T143005-phone_detected.jpg"  # space exercises URI encoding
r2 = S3Store("https://acct123.r2.cloudflarestorage.com", "auto", CREDS.access_key, CREDS.secret_key, "guardai-evidence")
b2 = S3Store("s3.us-west-004.backblazeb2.com", "us-west-004", CREDS.access_key, CREDS.secret_key, "guardai-evidence")


def _frozen():
    return mock.patch("botocore.auth.datetime")


@pytest.mark.parametrize("store", [r2, b2], ids=["r2", "b2"])
def test_presigned_get_matches_botocore(store):
    url = store.presign_get(KEY, expires=900, now=NOW)
    ours = parse_qs(urlparse(url).query)

    req = AWSRequest(method="GET", url=f"{store.endpoint}/guardai-evidence/{KEY.replace(' ', '%20')}")
    with _frozen() as dt:
        dt.datetime.utcnow.return_value = NOW.replace(tzinfo=None)
        dt.datetime.now.return_value = NOW.replace(tzinfo=None)
        S3SigV4QueryAuth(CREDS, "s3", store.region, expires=900).add_auth(req)
    ref = parse_qs(urlparse(req.url).query)

    assert urlparse(url).path == urlparse(req.url).path
    assert ours["X-Amz-Signature"] == ref["X-Amz-Signature"]
    assert ours["X-Amz-Credential"] == ref["X-Amz-Credential"]


@pytest.mark.parametrize("store", [r2, b2], ids=["r2", "b2"])
def test_put_authorization_matches_botocore(store):
    body = b"\xff\xd8 jpeg bytes"
    ours = store._signed_headers("PUT", KEY, body, {"content-type": "image/jpeg"}, NOW)

    req = AWSRequest(
        method="PUT",
        url=f"{store.endpoint}/guardai-evidence/{KEY.replace(' ', '%20')}",
        data=body,
        headers={"content-type": "image/jpeg"},
    )
    with _frozen() as dt:
        dt.datetime.utcnow.return_value = NOW.replace(tzinfo=None)
        dt.datetime.now.return_value = NOW.replace(tzinfo=None)
        S3SigV4Auth(CREDS, "s3", store.region).add_auth(req)

    sig = lambda h: h.split("Signature=")[1]  # noqa: E731
    assert sig(ours["Authorization"]) == sig(req.headers["Authorization"])
    assert ours["x-amz-content-sha256"] == req.headers["X-Amz-Content-SHA256"]
