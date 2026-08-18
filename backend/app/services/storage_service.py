"""
Evidence-file storage.

Writes to settings.UPLOAD_DIR if set, otherwise to ./uploads (relative to the app's
working directory). On Render, a web service's filesystem is ephemeral — files
written there are lost on every deploy or restart — so UPLOAD_DIR should point at
the mount path of an attached persistent Disk in production.
"""
import os
from typing import Optional

from app.core.config import settings

UPLOAD_DIR = os.path.abspath(settings.UPLOAD_DIR or "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


def is_durable() -> bool:
    """True if UPLOAD_DIR was explicitly configured (presumed to point at a
    persistent Disk mount), false if falling back to the app's own ephemeral
    working directory."""
    return bool(settings.UPLOAD_DIR)


def save_file(filename: str, content: bytes) -> None:
    with open(os.path.join(UPLOAD_DIR, filename), "wb") as f:
        f.write(content)


def read_file(filename: str) -> Optional[bytes]:
    path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.isfile(path):
        return None
    with open(path, "rb") as f:
        return f.read()
