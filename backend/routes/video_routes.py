import io
import os
import uuid
import zipfile
import datetime
import mimetypes
from pathlib import Path

from flask import Blueprint, request, jsonify, g, send_file, Response
from werkzeug.utils import secure_filename

import database
import crypto_utils
from auth import login_required, hash_password, verify_password
from config import UPLOAD_DIR, STORAGE_DIR, ALLOWED_EXTENSIONS, MAX_UPLOAD_MB

video_bp = Blueprint("videos", __name__, url_prefix="/api/videos")

MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024


def _extension_ok(filename: str) -> bool:
    return Path(filename).suffix.lower() in ALLOWED_EXTENSIONS


@video_bp.post("/upload")
@login_required
def upload_and_encrypt():
    """
    Secure upload workflow: receive a video file, immediately encrypt it
    with a fresh AES-256 key, persist only the ciphertext to storage, and
    record metadata in the database. The plaintext temp file is deleted
    as soon as encryption finishes.
    """
    if "file" not in request.files:
        return jsonify({"error": "No file part named 'file' in request"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400
    if not _extension_ok(file.filename):
        return jsonify({
            "error": f"Unsupported file type. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        }), 400

    user = g.current_user
    original_filename = secure_filename(file.filename)
    temp_id = uuid.uuid4().hex
    temp_path = UPLOAD_DIR / f"{temp_id}_{original_filename}"

    file.save(temp_path)

    size = os.path.getsize(temp_path)
    if size > MAX_UPLOAD_BYTES:
        os.remove(temp_path)
        return jsonify({"error": f"File exceeds {MAX_UPLOAD_MB}MB limit"}), 413

    stored_filename = f"{uuid.uuid4().hex}.enc"
    storage_path = STORAGE_DIR / stored_filename

    try:
        wrapped_key, iv_b64, sha256_hex, original_size = crypto_utils.encrypt_video_file(
            temp_path, storage_path
        )
    finally:
        # Plaintext never persists beyond the encryption step
        if temp_path.exists():
            os.remove(temp_path)

    video_id = database.create_video(
        user_id=user["id"],
        original_filename=original_filename,
        stored_filename=stored_filename,
        wrapped_key=wrapped_key,
        iv=iv_b64,
        sha256_original=sha256_hex,
        size_bytes=original_size,
    )

    return jsonify({
        "id": video_id,
        "original_filename": original_filename,
        "status": "encrypted",
        "size_bytes": original_size,
    }), 201


@video_bp.get("")
@login_required
def list_videos():
    user = g.current_user
    rows = database.list_videos_for_user(user["id"])
    return jsonify([
        {
            "id": row["id"],
            "original_filename": row["original_filename"],
            "status": row["status"],
            "size_bytes": row["size_bytes"],
            "uploaded_at": row["uploaded_at"],
        }
        for row in rows
    ])


@video_bp.route("/<int:video_id>/download", methods=["GET", "POST"])
@login_required
def decrypt_and_download(video_id):
    """
    Controlled decryption: only the owning, authenticated user can trigger
    this. Decrypts to a temp file, verifies integrity via the stored
    SHA-256 hash, streams it back, then removes the temp plaintext copy.

    Requires password confirmation to prevent unauthorized downloads from
    unattended / open browser sessions.
    """
    user = g.current_user
    ip = _get_client_ip()
    ua = request.headers.get("User-Agent", "Unknown Browser")[:250]

    # Security Step-Up: require account password confirmation
    confirm_pwd = (
        request.headers.get("X-Confirm-Password")
        or (request.get_json(silent=True) or {}).get("password")
        or request.args.get("confirm_password")
        or ""
    )

    if not confirm_pwd or not verify_password(confirm_pwd, user["password_hash"]):
        database.log_security_event(
            user["id"],
            "download_blocked",
            ip,
            ua,
            f"Unauthorized download attempt without valid password confirmation for video {video_id}",
        )
        return jsonify({"error": "Security confirmation required: Incorrect account password"}), 403

    video = database.get_video(video_id, user["id"])
    if video is None:
        return jsonify({"error": "Video not found"}), 404

    storage_path = STORAGE_DIR / video["stored_filename"]
    if not storage_path.exists():
        return jsonify({"error": "Encrypted file missing from storage"}), 410

    temp_out = UPLOAD_DIR / f"decrypted_{uuid.uuid4().hex}_{video['original_filename']}"

    try:
        crypto_utils.decrypt_video_file(
            storage_path, temp_out, video["wrapped_key"], video["iv"],
            expected_sha256=video["sha256_original"],
        )
    except ValueError as e:
        if temp_out.exists():
            os.remove(temp_out)
        return jsonify({"error": str(e)}), 500

    database.log_security_event(
        user["id"],
        "video_downloaded",
        ip,
        ua,
        f"Downloaded: {video['original_filename']} ({video['size_bytes']} bytes)",
    )

    response = send_file(
        temp_out,
        as_attachment=True,
        download_name=video["original_filename"],
    )

    @response.call_on_close
    def _cleanup():
        if temp_out.exists():
            os.remove(temp_out)

    return response


@video_bp.get("/<int:video_id>/view")
@login_required
def view_video(video_id):
    """
    Authorized in-browser playback WITHOUT a permanent decrypted copy.

    The ciphertext is decrypted straight into memory and streamed back in
    the response body as an inline video. No plaintext file is ever
    written to disk, and the response is marked no-store so browsers
    don't cache a decrypted copy either. This is what the "View" button
    in My Videos calls.
    """
    user = g.current_user
    ip = _get_client_ip()
    ua = request.headers.get("User-Agent", "Unknown Browser")[:250]

    video = database.get_video(video_id, user["id"])
    if video is None:
        return jsonify({"error": "Video not found"}), 404

    storage_path = STORAGE_DIR / video["stored_filename"]
    if not storage_path.exists():
        return jsonify({"error": "Encrypted file missing from storage"}), 410

    with open(storage_path, "rb") as f:
        ciphertext = f.read()

    try:
        plaintext = crypto_utils.decrypt_video_bytes(
            ciphertext, video["wrapped_key"], video["iv"],
            expected_sha256=video["sha256_original"],
        )
    except ValueError as e:
        return jsonify({"error": str(e)}), 500

    database.log_security_event(
        user["id"],
        "video_viewed",
        ip,
        ua,
        f"Viewed inline: {video['original_filename']}",
    )

    mimetype = mimetypes.guess_type(video["original_filename"])[0] or "video/mp4"

    response = Response(plaintext, mimetype=mimetype)
    response.headers["Content-Disposition"] = (
        f'inline; filename="{video["original_filename"]}"'
    )
    response.headers["Content-Length"] = str(len(plaintext))
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    response.headers["Accept-Ranges"] = "bytes"
    return response


@video_bp.get("/<int:video_id>/download-encrypted")
@login_required
def download_encrypted_zip(video_id):
    """
    Lets the owner download the video exactly as it's stored: still
    AES-256 encrypted, zipped up. Nothing is decrypted server-side for
    this route - it's a raw ciphertext backup, unreadable without the
    app's master key.
    """
    user = g.current_user
    video = database.get_video(video_id, user["id"])
    if video is None:
        return jsonify({"error": "Video not found"}), 404

    storage_path = STORAGE_DIR / video["stored_filename"]
    if not storage_path.exists():
        return jsonify({"error": "Encrypted file missing from storage"}), 410

    stem = Path(video["original_filename"]).stem
    entry_name = f"{stem}.enc"

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.write(storage_path, arcname=entry_name)
        zf.writestr(
            "README.txt",
            "This file is AES-256-CBC encrypted by VIDEOSEC.\n"
            "It is NOT a playable video on its own - it can only be "
            "decrypted from inside the VIDEOSEC app by the account that "
            "uploaded it.\n",
        )
    buffer.seek(0)

    return send_file(
        buffer,
        as_attachment=True,
        download_name=f"{stem}_encrypted.zip",
        mimetype="application/zip",
    )


@video_bp.delete("/<int:video_id>")
@login_required
def delete_video(video_id):
    user = g.current_user
    video = database.get_video(video_id, user["id"])
    if video is None:
        return jsonify({"error": "Video not found"}), 404

    storage_path = STORAGE_DIR / video["stored_filename"]
    if storage_path.exists():
        os.remove(storage_path)

    database.delete_video(video_id, user["id"])
    return jsonify({"deleted": video_id})


def _get_client_ip():
    return request.headers.get("X-Forwarded-For", request.remote_addr or "127.0.0.1").split(",")[0].strip()


@video_bp.get("/client-info")
def client_info():
    return jsonify({
        "ip": _get_client_ip(),
        "timestamp": datetime.datetime.utcnow().isoformat(),
    })


# ------------------------------------------------------------- Sharing ---
@video_bp.post("/<int:video_id>/share")
@login_required
def create_video_share(video_id):
    """
    Creates a secure share for this video:
    - Account-to-account (by recipient username/email)
    - Or open shareable link
    - Optional PIN lock
    - Optional view limit (e.g. 1 for Single-View/Burn)
    - Optional expiration timer (hours)
    """
    user = g.current_user
    video = database.get_video(video_id, user["id"])
    if video is None:
        return jsonify({"error": "Video not found"}), 404

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
            if max_views <= 0:
                max_views = None
        except ValueError:
            max_views = None

    expires_hours = data.get("expires_hours")
    expires_at = None
    if expires_hours:
        try:
            hours = float(expires_hours)
            if hours > 0:
                expires_at = (datetime.datetime.utcnow() + datetime.timedelta(hours=hours)).isoformat()
        except ValueError:
            pass

    shared_with_user_id = None
    recipient_username = None
    if recipient_ident:
        target_user = database.get_user_by_username_or_email(recipient_ident)
        if target_user is None:
            return jsonify({"error": f"Recipient user '{recipient_ident}' not found"}), 404
        if target_user["id"] == user["id"]:
            return jsonify({"error": "You cannot share a video with yourself"}), 400
        shared_with_user_id = target_user["id"]
        recipient_username = target_user["username"]

    pin_hash = hash_password(pin) if pin else None
    share_token = uuid.uuid4().hex

    share_id = database.create_share(
        video_id=video["id"],
        owner_id=user["id"],
        shared_with_user_id=shared_with_user_id,
        share_token=share_token,
        pin_hash=pin_hash,
        permission=permission,
        max_views=max_views,
        expires_at=expires_at,
    )

    return jsonify({
        "share_id": share_id,
        "share_token": share_token,
        "recipient_username": recipient_username,
        "has_pin": bool(pin_hash),
        "permission": permission,
        "max_views": max_views,
        "expires_at": expires_at,
    }), 201


@video_bp.get("/shared-with-me")
@login_required
def list_shared_with_me():
    user = g.current_user
    rows = database.list_shares_for_recipient(user["id"])
    now_iso = datetime.datetime.utcnow().isoformat()
    results = []
    for r in rows:
        is_expired = bool(r["expires_at"] and now_iso > r["expires_at"])
        is_limit = bool(r["max_views"] is not None and r["view_count"] >= r["max_views"])
        results.append({
            "share_id": r["id"],
            "share_token": r["share_token"],
            "video_id": r["video_id"],
            "original_filename": r["original_filename"],
            "size_bytes": r["size_bytes"],
            "owner_username": r["owner_username"],
            "has_pin": bool(r["has_pin"]),
            "permission": r["permission"],
            "max_views": r["max_views"],
            "view_count": r["view_count"],
            "expires_at": r["expires_at"],
            "created_at": r["created_at"],
            "is_expired": is_expired,
            "is_view_limit_reached": is_limit,
        })
    return jsonify(results)


@video_bp.get("/my-shares")
@login_required
def list_my_shares():
    user = g.current_user
    rows = database.list_shares_by_owner(user["id"])
    now_iso = datetime.datetime.utcnow().isoformat()
    return jsonify([
        {
            "share_id": r["id"],
            "share_token": r["share_token"],
            "video_id": r["video_id"],
            "original_filename": r["original_filename"],
            "recipient_username": r["recipient_username"] or "Anyone with link",
            "has_pin": bool(r["has_pin"]),
            "permission": r["permission"],
            "max_views": r["max_views"],
            "view_count": r["view_count"],
            "expires_at": r["expires_at"],
            "is_expired": bool(r["expires_at"] and now_iso > r["expires_at"]),
            "is_view_limit_reached": bool(r["max_views"] is not None and r["view_count"] >= r["max_views"]),
            "created_at": r["created_at"],
        }
        for r in rows
    ])


@video_bp.delete("/shares/<int:share_id>")
@login_required
def revoke_share(share_id):
    user = g.current_user
    count = database.delete_share(share_id, user["id"])
    if count == 0:
        return jsonify({"error": "Share not found or unauthorized"}), 404
    return jsonify({"revoked": share_id})


@video_bp.patch("/shares/<int:share_id>")
@login_required
def update_share(share_id):
    """
    Allows the video owner to update permissions, modify expiration, or immediately stop sharing.
    """
    user = g.current_user
    data = request.get_json(silent=True) or {}
    permission = data.get("permission")
    if permission and permission not in ("view_only", "view_and_download"):
        permission = None

    expires_at = None
    if "expires_hours" in data:
        hours = data["expires_hours"]
        if hours is None or hours == 0:
            expires_at = None
        else:
            try:
                expires_at = (datetime.datetime.utcnow() + datetime.timedelta(hours=float(hours))).isoformat()
            except ValueError:
                pass
    elif data.get("stop"):
        # Immediately deactivate by setting expiration in the past
        expires_at = (datetime.datetime.utcnow() - datetime.timedelta(seconds=1)).isoformat()

    pin_hash = None
    if "pin" in data:
        new_pin = (data["pin"] or "").strip()
        pin_hash = hash_password(new_pin) if new_pin else ""

    count = database.update_share(
        share_id=share_id,
        owner_id=user["id"],
        permission=permission,
        expires_at=expires_at,
        pin_hash=pin_hash if pin_hash != "" else None,
    )
    if count == 0:
        return jsonify({"error": "Share not found or unauthorized"}), 404

    return jsonify({"updated": share_id, "expires_at": expires_at, "permission": permission})



@video_bp.get("/share/<string:share_token>/info")
def get_share_public_info(share_token):
    share = database.get_share_by_token(share_token)
    if share is None:
        return jsonify({"error": "Share link not found or has been revoked"}), 404

    now_iso = datetime.datetime.utcnow().isoformat()
    is_expired = bool(share["expires_at"] and now_iso > share["expires_at"])
    is_limit = bool(share["max_views"] is not None and share["view_count"] >= share["max_views"])

    return jsonify({
        "share_token": share_token,
        "original_filename": share["original_filename"],
        "size_bytes": share["size_bytes"],
        "owner_username": share["owner_username"],
        "has_pin": bool(share["pin_hash"]),
        "permission": share["permission"],
        "max_views": share["max_views"],
        "view_count": share["view_count"],
        "expires_at": share["expires_at"],
        "is_expired": is_expired,
        "is_view_limit_reached": is_limit,
    })


@video_bp.post("/share/<string:share_token>/view")
def view_shared_video(share_token):
    share = database.get_share_by_token(share_token)
    if share is None:
        return jsonify({"error": "Share link not found or has been revoked"}), 404

    now_iso = datetime.datetime.utcnow().isoformat()
    if share["expires_at"] and now_iso > share["expires_at"]:
        return jsonify({"error": "This secure video link has expired."}), 403

    if share["max_views"] is not None and share["view_count"] >= share["max_views"]:
        return jsonify({"error": "This video has reached its maximum view limit (Burn-after-watching)."}), 403

    # PIN Verification
    if share["pin_hash"]:
        data = request.get_json(silent=True) or {}
        pin = data.get("pin") or request.headers.get("X-Video-PIN") or ""
        if not pin or not verify_password(pin, share["pin_hash"]):
            return jsonify({"error": "Incorrect security PIN. Access denied."}), 403

    storage_path = STORAGE_DIR / share["stored_filename"]
    if not storage_path.exists():
        return jsonify({"error": "Encrypted file missing from storage"}), 410

    with open(storage_path, "rb") as f:
        ciphertext = f.read()

    try:
        plaintext = crypto_utils.decrypt_video_bytes(
            ciphertext, share["wrapped_key"], share["iv"],
            expected_sha256=share["sha256_original"],
        )
    except ValueError as e:
        return jsonify({"error": str(e)}), 500

    # Increment view count
    database.increment_share_view_count(share["id"])

    mimetype = mimetypes.guess_type(share["original_filename"])[0] or "video/mp4"
    response = Response(plaintext, mimetype=mimetype)
    response.headers["Content-Disposition"] = f'inline; filename="{share["original_filename"]}"'
    response.headers["Content-Length"] = str(len(plaintext))
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    response.headers["Accept-Ranges"] = "bytes"
    response.headers["X-Forensic-IP"] = _get_client_ip()
    response.headers["X-Forensic-Timestamp"] = datetime.datetime.utcnow().isoformat()
    return response


@video_bp.post("/share/<string:share_token>/download")
def download_shared_video(share_token):
    share = database.get_share_by_token(share_token)
    if share is None:
        return jsonify({"error": "Share link not found or has been revoked"}), 404

    now_iso = datetime.datetime.utcnow().isoformat()
    if share["expires_at"] and now_iso > share["expires_at"]:
        return jsonify({"error": "This secure video link has expired."}), 403

    if share["permission"] != "view_and_download":
        return jsonify({"error": "The owner has designated this video as View-Only (download disabled)."}), 403

    if share["max_views"] is not None and share["view_count"] >= share["max_views"]:
        return jsonify({"error": "This video has reached its maximum view limit."}), 403

    if share["pin_hash"]:
        data = request.get_json(silent=True) or {}
        pin = data.get("pin") or request.headers.get("X-Video-PIN") or ""
        if not pin or not verify_password(pin, share["pin_hash"]):
            return jsonify({"error": "Incorrect security PIN. Access denied."}), 403

    storage_path = STORAGE_DIR / share["stored_filename"]
    if not storage_path.exists():
        return jsonify({"error": "Encrypted file missing from storage"}), 410

    with open(storage_path, "rb") as f:
        ciphertext = f.read()

    try:
        plaintext = crypto_utils.decrypt_video_bytes(
            ciphertext, share["wrapped_key"], share["iv"],
            expected_sha256=share["sha256_original"],
        )
    except ValueError as e:
        return jsonify({"error": str(e)}), 500

    database.increment_share_view_count(share["id"])
    buffer = io.BytesIO(plaintext)
    return send_file(
        buffer,
        as_attachment=True,
        download_name=share["original_filename"],
        mimetype=mimetypes.guess_type(share["original_filename"])[0] or "application/octet-stream",
    )


# --------------------------------- Portable (.vsec) Container Crypto ---
@video_bp.post("/<int:video_id>/export-vsec")
@login_required
def export_vsec_container(video_id):
    """
    Exports video into a portable .vsec container encrypted with a user-supplied PIN.
    Can be shared via flash drive, email, WhatsApp, etc., and decrypted on VIDEOSEC.
    """
    user = g.current_user
    video = database.get_video(video_id, user["id"])
    if video is None:
        return jsonify({"error": "Video not found"}), 404

    data = request.get_json(silent=True) or {}
    pin = (data.get("pin") or "").strip()
    if not pin or len(pin) < 4:
        return jsonify({"error": "A security PIN of at least 4 characters is required to lock the export."}), 400

    storage_path = STORAGE_DIR / video["stored_filename"]
    if not storage_path.exists():
        return jsonify({"error": "Encrypted file missing from storage"}), 410

    with open(storage_path, "rb") as f:
        ciphertext = f.read()

    try:
        plaintext = crypto_utils.decrypt_video_bytes(
            ciphertext, video["wrapped_key"], video["iv"],
            expected_sha256=video["sha256_original"],
        )
    except ValueError as e:
        return jsonify({"error": str(e)}), 500

    package_bytes = crypto_utils.create_vsec_package(
        plaintext, video["original_filename"], pin
    )

    buffer = io.BytesIO(package_bytes)
    stem = Path(video["original_filename"]).stem
    return send_file(
        buffer,
        as_attachment=True,
        download_name=f"{stem}.vsec",
        mimetype="application/octet-stream",
    )


@video_bp.post("/unlock-vsec")
def unlock_vsec_container():
    """
    Unlocks and decrypts a portable .vsec container using the sender's PIN.
    Supports in-browser playback (stream) or download.
    """
    if "file" not in request.files:
        return jsonify({"error": "No .vsec file provided"}), 400

    file = request.files["file"]
    pin = (request.form.get("pin") or "").strip()
    action = request.form.get("action", "stream")

    if not pin:
        return jsonify({"error": "Please provide the security PIN."}), 400

    package_bytes = file.read()
    try:
        plaintext, metadata = crypto_utils.unlock_vsec_package(package_bytes, pin)
    except Exception as e:
        return jsonify({"error": str(e)}), 400

    filename = metadata.get("filename", "decrypted_video.mp4")
    mimetype = mimetypes.guess_type(filename)[0] or "video/mp4"

    if action == "download":
        buffer = io.BytesIO(plaintext)
        return send_file(
            buffer,
            as_attachment=True,
            download_name=filename,
            mimetype=mimetype,
        )

    # In-browser playback stream
    response = Response(plaintext, mimetype=mimetype)
    response.headers["Content-Disposition"] = f'inline; filename="{filename}"'
    response.headers["Content-Length"] = str(len(plaintext))
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    response.headers["Accept-Ranges"] = "bytes"
    response.headers["X-Forensic-IP"] = _get_client_ip()
    response.headers["X-Forensic-Timestamp"] = datetime.datetime.utcnow().isoformat()
    return response

