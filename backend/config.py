"""
VIDEOSEC backend configuration.

All secrets are loaded from environment variables. Sensible local defaults
are provided so the app runs out of the box for development/demo purposes,
but you should set real values (via a .env file or real env vars) before
any kind of deployment.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")


# --- Paths -----------------------------------------------------------------
UPLOAD_DIR = BASE_DIR / "uploads"                 # temp holding area for raw uploads
STORAGE_DIR = BASE_DIR / "storage" / "encrypted"   # simulated "cloud/object storage"
FILE_STORAGE_DIR = BASE_DIR / "storage" / "encrypted_files"
DB_PATH = BASE_DIR / "videosec.db"

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
STORAGE_DIR.mkdir(parents=True, exist_ok=True)
FILE_STORAGE_DIR.mkdir(parents=True, exist_ok=True)

# --- Auth --------------------------------------------------------------
JWT_SECRET = os.environ.get("VIDEOSEC_JWT_SECRET", "dev-only-change-me-jwt-secret")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = int(os.environ.get("VIDEOSEC_JWT_EXPIRY_HOURS", "12"))

# --- Encryption ----------------------------------------------------------
# Master key used only to WRAP (encrypt) each video's random per-file AES key
# before it is stored in the database. Never used to encrypt video data
# directly. In production, load this from a secrets manager / KMS, not
# from source control.
MASTER_KEY_HEX = os.environ.get(
    "VIDEOSEC_MASTER_KEY_HEX",
    "0" * 63 + "1",  # 32-byte dev-only fallback key (64 hex chars)
)

MAX_UPLOAD_MB = int(os.environ.get("VIDEOSEC_MAX_UPLOAD_MB", "500"))
ALLOWED_EXTENSIONS = {".mp4", ".avi", ".mov", ".mkv", ".webm"}
MAX_FILE_UPLOAD_MB = int(os.environ.get("VIDEOSEC_MAX_FILE_UPLOAD_MB", "100"))
ALLOWED_FILE_EXTENSIONS = {
    ".bmp", ".csv", ".doc", ".docx", ".gif", ".heic", ".jpeg", ".jpg",
    ".md", ".odt", ".pdf", ".png", ".ppt", ".pptx", ".rtf", ".svg",
    ".tif", ".tiff", ".txt", ".webp", ".xls", ".xlsx",
}

# --- Security & Email / OTP Settings ------------------------------------
OTP_EXPIRY_MINUTES = int(os.environ.get("VIDEOSEC_OTP_EXPIRY_MINUTES", "10"))
SMTP_HOST = os.environ.get("VIDEOSEC_SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("VIDEOSEC_SMTP_PORT", "587"))
SMTP_USER = os.environ.get("VIDEOSEC_SMTP_USER", "")
SMTP_PASSWORD = os.environ.get("VIDEOSEC_SMTP_PASSWORD", "")
SMTP_FROM = os.environ.get("VIDEOSEC_SMTP_FROM", os.environ.get("VIDEOSEC_SMTP_USER", "noreply@videosec.local"))
SMTP_USE_TLS = os.environ.get("VIDEOSEC_SMTP_USE_TLS", "true").lower() in ("true", "1", "yes")

# Trusted devices can bypass OTP (new/untrusted devices always require OTP)
REQUIRE_MFA_EVERY_LOGIN = os.environ.get("VIDEOSEC_REQUIRE_MFA_EVERY_LOGIN", "false").lower() in ("true", "1", "yes")

# Temporarily expose dev OTP in browser JSON when SMTP is not configured
EXPOSE_DEV_OTP_IN_JSON = os.environ.get("VIDEOSEC_EXPOSE_DEV_OTP_IN_JSON", "true").lower() in ("true", "1", "yes")


