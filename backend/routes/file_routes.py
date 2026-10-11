import io
import datetime
import mimetypes
import os
import uuid
from pathlib import Path

from flask import Blueprint, Response, g, jsonify, request, send_file
from werkzeug.utils import secure_filename

import crypto_utils
import database
from auth import decode_token, hash_password, login_required, verify_password
from config import (
    ALLOWED_FILE_EXTENSIONS,
    FILE_STORAGE_DIR,
    MAX_FILE_UPLOAD_MB,
)

file_bp = Blueprint("files", __name__, url_prefix="/api/files")
MAX_FILE_UPLOAD_BYTES = MAX_FILE_UPLOAD_MB * 1024 * 1024


def _client_ip():
    return request.headers.get(
        "X-Forwarded-For", request.remote_addr or "127.0.0.1"
    ).split(",")[0].strip()


def _user_agent():
    return request.headers.get("User-Agent", "Unknown Browser")[:250]


def _share_status(share):
    now = datetime.datetime.utcnow().isoformat()
    is_expired = bool(share["expires_at"] and now > share["expires_at"])
    is_view_limit_reached = bool(
        share["max_views"] is not None
        and share["view_count"] >= share["max_views"]
    )
    return is_expired, is_view_limit_reached


def _share_access_error(share):
    recipient_id = share["shared_with_user_id"]
    if recipient_id is None:
        return None

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return jsonify({"error": "Sign in with the invited account to access this file."}), 401

    try:
        payload = decode_token(auth_header.split(" ", 1)[1])
        user = database.get_user_by_id(int(payload["sub"]))
    except Exception:
        user = None

    if user is None:
        return jsonify({"error": "Sign in with the invited account to access this file."}), 401
    if user["id"] not in (recipient_id, share["owner_id"]):
        return jsonify({"error": "This file was shared with a different account."}), 403
    return None


def _load_shared_plaintext(share):
    storage_path = FILE_STORAGE_DIR / share["stored_filename"]
    if not storage_path.is_file():
        return None, (jsonify({"error": "Encrypted file missing from storage"}), 410)
    try:
        plaintext = crypto_utils.decrypt_bytes(
            storage_path.read_bytes(),
            share["wrapped_key"],
            share["iv"],
            expected_sha256=share["sha256_original"],
        )
    except (OSError, ValueError):
        return None, (jsonify({"error": "File integrity verification failed."}), 500)
    return plaintext, None


def _check_share_pin(share):
    if not share["pin_hash"]:
        return None
    pin = (request.get_json(silent=True) or {}).get("pin", "")
    if not pin or not verify_password(pin, share["pin_hash"]):
        return jsonify({"error": "Incorrect security PIN. Access denied."}), 403
    return None


def _file_share_unavailable(share):
    expired, limit_reached = _share_status(share)
    if expired:
        return jsonify({"error": "This secure file link has expired."}), 403
    if limit_reached:
        return jsonify({"error": "This file share has reached its view limit."}), 403
    return None


@file_bp.get("")
@login_required
def list_files():
    rows = database.list_encrypted_files(g.current_user["id"])
    return jsonify([
        {
            "id": row["id"],
            "original_filename": row["original_filename"],
            "size_bytes": row["size_bytes"],
            "uploaded_at": row["uploaded_at"],
        }
        for row in rows
    ])


@file_bp.post("/upload")
@login_required
def upload_file():
    uploaded = request.files.get("file")
    if uploaded is None or not uploaded.filename:
        return jsonify({"error": "Choose an image or document to encrypt."}), 400

    original_filename = secure_filename(uploaded.filename)
    extension = Path(original_filename).suffix.lower()
    if not original_filename or extension not in ALLOWED_FILE_EXTENSIONS:
        return jsonify({"error": "This image or document type is not supported."}), 400

    plaintext = uploaded.read(MAX_FILE_UPLOAD_BYTES + 1)
    if not plaintext:
        return jsonify({"error": "The selected file is empty."}), 400
    if len(plaintext) > MAX_FILE_UPLOAD_BYTES:
        return jsonify({
            "error": f"File exceeds the {MAX_FILE_UPLOAD_MB} MB limit."
        }), 413

    ciphertext, wrapped_key, iv, sha256_original, size_bytes = crypto_utils.encrypt_bytes(plaintext)
    stored_filename = f"{uuid.uuid4().hex}.enc"
    storage_path = FILE_STORAGE_DIR / stored_filename

    try:
        storage_path.write_bytes(ciphertext)
        file_id = database.create_encrypted_file(
            owner_id=g.current_user["id"],
            original_filename=original_filename,
            stored_filename=stored_filename,
            wrapped_key=wrapped_key,
            iv=iv,
            sha256_original=sha256_original,
            size_bytes=size_bytes,
        )
    except Exception:
        storage_path.unlink(missing_ok=True)
        raise
    finally:
        del plaintext

    return jsonify({
        "id": file_id,
        "original_filename": original_filename,
        "size_bytes": size_bytes,
        "status": "encrypted",
    }), 201


@file_bp.post("/<int:file_id>/download")
@login_required
def download_file(file_id):
    user = g.current_user
    confirm_password = (
        request.headers.get("X-Confirm-Password")
        or (request.get_json(silent=True) or {}).get("password")
        or ""
    )
    if not confirm_password or not verify_password(
        confirm_password, user["password_hash"]
    ):
        database.log_security_event(
            user["id"],
            "file_download_blocked",
            _client_ip(),
            _user_agent(),
            f"Unauthorized file download attempt for file {file_id}",
        )
        return jsonify({"error": "Security confirmation required: Incorrect account password"}), 403

    file_record = database.get_encrypted_file(file_id, user["id"])
    if file_record is None:
        return jsonify({"error": "File not found"}), 404

    storage_path = FILE_STORAGE_DIR / file_record["stored_filename"]
    if not storage_path.is_file():
        return jsonify({"error": "Encrypted file missing from storage"}), 410

    try:
        plaintext = crypto_utils.decrypt_bytes(
            storage_path.read_bytes(),
            file_record["wrapped_key"],
            file_record["iv"],
            expected_sha256=file_record["sha256_original"],
        )
    except (ValueError, OSError):
        return jsonify({"error": "File integrity verification failed."}), 500

    database.log_security_event(
        user["id"],
        "file_downloaded",
        _client_ip(),
        _user_agent(),
        f"Downloaded: {file_record['original_filename']} ({file_record['size_bytes']} bytes)",
    )
    response = send_file(
        io.BytesIO(plaintext),
        as_attachment=True,
        download_name=file_record["original_filename"],
        mimetype="application/octet-stream",
    )
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    return response


@file_bp.delete("/<int:file_id>")
@login_required
def delete_file(file_id):
    user_id = g.current_user["id"]
    file_record = database.get_encrypted_file(file_id, user_id)
    if file_record is None:
        return jsonify({"error": "File not found"}), 404

    storage_path = FILE_STORAGE_DIR / file_record["stored_filename"]
    if storage_path.exists():
        os.remove(storage_path)
    database.delete_encrypted_file(file_id, user_id)
    return jsonify({"deleted": file_id})


@file_bp.post("/<int:file_id>/share")
@login_required
def create_file_share(file_id):
    user = g.current_user
    file_record = database.get_encrypted_file(file_id, user["id"])
    if file_record is None:
        return jsonify({"error": "File not found"}), 404

    data = request.get_json(silent=True) or {}
    recipient_ident = (data.get("recipient") or "").strip()
    pin = (data.get("pin") or "").strip()
    permission = data.get("permission", "view_only")
    if permission not in ("view_only", "view_and_download"):
        permission = "view_only"

    max_views = data.get("max_views")
    if max_views is not None:
        try:
            max_views = int(max_views)
        except (TypeError, ValueError):
            return jsonify({"error": "View limit must be a positive whole number."}), 400
        if max_views <= 0:
            return jsonify({"error": "View limit must be a positive whole number."}), 400

    expires_at = None
    expires_hours = data.get("expires_hours")
    if expires_hours not in (None, "", 0, "0"):
        try:
            hours = float(expires_hours)
            if hours <= 0:
                return jsonify({"error": "Expiration must be positive or disabled."}), 400
            expires_at = (
                datetime.datetime.utcnow() + datetime.timedelta(hours=hours)
            ).isoformat()
        except (TypeError, ValueError):
            return jsonify({"error": "Expiration must be a valid number of hours."}), 400

    recipient = None
    recipient_username = None
    if recipient_ident:
        recipient = database.get_user_by_username_or_email(recipient_ident)
        if recipient is None:
            return jsonify({"error": f"Recipient '{recipient_ident}' not found."}), 404
        if recipient["id"] == user["id"]:
            return jsonify({"error": "You cannot share a file with yourself."}), 400
        recipient_username = recipient["username"]

    share_token = uuid.uuid4().hex
    share_id = database.create_encrypted_file_share(
        file_id=file_id,
        owner_id=user["id"],
        shared_with_user_id=recipient["id"] if recipient else None,
        share_token=share_token,
        pin_hash=hash_password(pin) if pin else None,
        permission=permission,
        max_views=max_views,
        expires_at=expires_at,
    )
    return jsonify({
        "share_id": share_id,
        "share_token": share_token,
        "recipient_username": recipient_username,
        "has_pin": bool(pin),
        "permission": permission,
        "max_views": max_views,
        "expires_at": expires_at,
    }), 201


@file_bp.get("/my-shares")
@login_required
def list_my_file_shares():
    rows = database.list_encrypted_file_shares_by_owner(g.current_user["id"])
    now = datetime.datetime.utcnow().isoformat()
    return jsonify([
        {
            "share_id": row["id"],
            "share_token": row["share_token"],
            "file_id": row["file_id"],
            "original_filename": row["original_filename"],
            "size_bytes": row["size_bytes"],
            "recipient_username": row["recipient_username"] or "Anyone with link",
            "has_pin": bool(row["has_pin"]),
            "permission": row["permission"],
            "max_views": row["max_views"],
            "view_count": row["view_count"],
            "expires_at": row["expires_at"],
            "is_expired": bool(row["expires_at"] and now > row["expires_at"]),
            "is_view_limit_reached": bool(
                row["max_views"] is not None and row["view_count"] >= row["max_views"]
            ),
        }
        for row in rows
    ])


@file_bp.get("/shared-with-me")
@login_required
def list_file_shares_with_me():
    rows = database.list_encrypted_file_shares_for_recipient(g.current_user["id"])
    now = datetime.datetime.utcnow().isoformat()
    return jsonify([
        {
            "share_id": row["id"],
            "share_token": row["share_token"],
            "file_id": row["file_id"],
            "original_filename": row["original_filename"],
            "size_bytes": row["size_bytes"],
            "owner_username": row["owner_username"],
            "has_pin": bool(row["has_pin"]),
            "permission": row["permission"],
            "max_views": row["max_views"],
            "view_count": row["view_count"],
            "expires_at": row["expires_at"],
            "is_expired": bool(row["expires_at"] and now > row["expires_at"]),
            "is_view_limit_reached": bool(
                row["max_views"] is not None and row["view_count"] >= row["max_views"]
            ),
        }
        for row in rows
    ])


@file_bp.delete("/shares/<int:share_id>")
@login_required
def revoke_file_share(share_id):
    deleted = database.delete_encrypted_file_share(share_id, g.current_user["id"])
    if not deleted:
        return jsonify({"error": "Share not found or unauthorized."}), 404
    return jsonify({"revoked": share_id})


@file_bp.patch("/shares/<int:share_id>")
@login_required
def update_file_share(share_id):
    permission = (request.get_json(silent=True) or {}).get("permission")
    if permission not in ("view_only", "view_and_download"):
        return jsonify({"error": "Choose a valid file-share permission."}), 400
    updated = database.update_encrypted_file_share(
        share_id,
        g.current_user["id"],
        permission=permission,
    )
    if not updated:
        return jsonify({"error": "Share not found or unauthorized."}), 404
    return jsonify({"updated": share_id, "permission": permission})


@file_bp.get("/share/<string:share_token>/info")
def get_file_share_info(share_token):
    share = database.get_encrypted_file_share_by_token(share_token)
    if share is None:
        return jsonify({"error": "Share link not found or has been revoked."}), 404
    access_error = _share_access_error(share)
    if access_error:
        return access_error
    expired, limit_reached = _share_status(share)
    return jsonify({
        "share_token": share_token,
        "original_filename": share["original_filename"],
        "size_bytes": share["size_bytes"],
        "owner_username": share["owner_username"],
        "recipient_username": share["recipient_username"],
        "has_pin": bool(share["pin_hash"]),
        "permission": share["permission"],
        "max_views": share["max_views"],
        "view_count": share["view_count"],
        "expires_at": share["expires_at"],
        "is_expired": expired,
        "is_view_limit_reached": limit_reached,
    })


@file_bp.post("/share/<string:share_token>/view")
def view_shared_file(share_token):
    share = database.get_encrypted_file_share_by_token(share_token)
    if share is None:
        return jsonify({"error": "Share link not found or has been revoked."}), 404
    access_error = _share_access_error(share)
    if access_error:
        return access_error
    unavailable = _file_share_unavailable(share)
    if unavailable:
        return unavailable
    pin_error = _check_share_pin(share)
    if pin_error:
        return pin_error

    plaintext, error_response = _load_shared_plaintext(share)
    if error_response:
        return error_response
    if not database.consume_encrypted_file_share_view(share["id"], share["max_views"]):
        return jsonify({"error": "This file share has reached its view limit."}), 403

    database.log_security_event(
        share["owner_id"],
        "file_share_viewed",
        _client_ip(),
        _user_agent(),
        f"Shared file viewed: {share['original_filename']}",
    )
    mimetype = mimetypes.guess_type(share["original_filename"])[0] or "application/octet-stream"
    response = send_file(
        io.BytesIO(plaintext),
        as_attachment=False,
        download_name=share["original_filename"],
        mimetype=mimetype,
    )
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    response.headers["X-Share-View-Count"] = str(share["view_count"] + 1)
    return response


@file_bp.post("/share/<string:share_token>/download")
def download_shared_file(share_token):
    share = database.get_encrypted_file_share_by_token(share_token)
    if share is None:
        return jsonify({"error": "Share link not found or has been revoked."}), 404
    access_error = _share_access_error(share)
    if access_error:
        return access_error
    unavailable = _file_share_unavailable(share)
    if unavailable:
        return unavailable
    if share["permission"] != "view_and_download":
        return jsonify({"error": "The owner has disabled downloads for this file."}), 403
    pin_error = _check_share_pin(share)
    if pin_error:
        return pin_error

    plaintext, error_response = _load_shared_plaintext(share)
    if error_response:
        return error_response
    if not database.consume_encrypted_file_share_view(share["id"], share["max_views"]):
        return jsonify({"error": "This file share has reached its view limit."}), 403

    database.log_security_event(
        share["owner_id"],
        "file_share_downloaded",
        _client_ip(),
        _user_agent(),
        f"Shared file downloaded: {share['original_filename']}",
    )
    response = send_file(
        io.BytesIO(plaintext),
        as_attachment=True,
        download_name=share["original_filename"],
        mimetype="application/octet-stream",
    )
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    response.headers["X-Share-View-Count"] = str(share["view_count"] + 1)
    return response
