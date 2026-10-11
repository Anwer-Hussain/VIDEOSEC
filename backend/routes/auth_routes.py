import re
import uuid
import secrets
import sqlite3
import urllib.parse

from flask import Blueprint, request, jsonify, g

import database
from auth import hash_password, verify_password, create_token, login_required
from config import (
    OTP_EXPIRY_MINUTES,
    SMTP_HOST,
    SMTP_USER,
    REQUIRE_MFA_EVERY_LOGIN,
    EXPOSE_DEV_OTP_IN_JSON,
)
from email_service import (
    mask_email,
    send_device_otp_email,
    send_login_alert_email,
)

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _get_client_ip():
    return request.headers.get("X-Forwarded-For", request.remote_addr or "127.0.0.1").split(",")[0].strip()


def _get_user_agent():
    return request.headers.get("User-Agent", "Unknown Browser")[:250]


@auth_bp.post("/register")
def register():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    device_id = (data.get("device_id") or "").strip()
    device_name = (data.get("device_name") or "Primary Browser").strip()

    if len(username) < 3:
        return jsonify({"error": "Username must be at least 3 characters"}), 400
    if not EMAIL_RE.match(email):
        return jsonify({"error": "Please provide a valid email address"}), 400
    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400

    try:
        user_id = database.create_user(username, email, hash_password(password))
    except sqlite3.IntegrityError:
        return jsonify({"error": "Username or email already registered"}), 409

    ip = _get_client_ip()
    ua = _get_user_agent()

    # Automatically trust registering device
    if device_id:
        database.trust_device(user_id, device_id, device_name, ip, ua)

    database.log_security_event(user_id, "account_created", ip, ua, f"Initial device: {device_name}")

    token = create_token(user_id, username)
    return jsonify({
        "token": token,
        "user": {"id": user_id, "username": username, "email": email},
    }), 201


@auth_bp.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    identifier = (data.get("username") or data.get("email") or "").strip()
    password = data.get("password") or ""
    device_id = (data.get("device_id") or "").strip()
    device_name = (data.get("device_name") or "Web Browser").strip()

    ip = _get_client_ip()
    ua = _get_user_agent()

    user = database.get_user_by_username_or_email(identifier)
    if user is None or not verify_password(password, user["password_hash"]):
        if user:
            database.log_security_event(user["id"], "login_failed", ip, ua, "Invalid password attempt")
        return jsonify({"error": "Invalid credentials"}), 401

    # Check if this device is trusted and MFA is not strictly enforced on every login
    if not REQUIRE_MFA_EVERY_LOGIN and device_id and database.is_device_trusted(user["id"], device_id):
        database.update_device_activity(user["id"], device_id, ip, ua)
        database.log_security_event(user["id"], "login_success", ip, ua, f"Trusted device: {device_name}")
        token = create_token(user["id"], user["username"])
        return jsonify({
            "token": token,
            "user": {"id": user["id"], "username": user["username"], "email": user["email"]},
            "mfa_required": False,
        })

    # Device is NEW or REQUIRE_MFA_EVERY_LOGIN is active -> Generate and send 6-digit OTP challenge
    otp_code = f"{secrets.randbelow(900000) + 100000}"
    temp_token = uuid.uuid4().hex

    database.create_device_otp(user["id"], device_id, otp_code, temp_token, ttl_minutes=OTP_EXPIRY_MINUTES)
    database.log_security_event(user["id"], "login_mfa_challenge", ip, ua, f"Security challenge for device: {device_name}")

    # Dispatch email (or print clearly to terminal in dev mode)
    send_device_otp_email(user["email"], user["username"], otp_code, device_name, ip)

    is_dev_mode = not SMTP_HOST or not SMTP_USER
    return jsonify({
        "mfa_required": True,
        "temp_token": temp_token,
        "masked_email": mask_email(user["email"]),
        "device_name": device_name,
        "expires_in_minutes": OTP_EXPIRY_MINUTES,
        "dev_mode": is_dev_mode,
        "dev_otp": otp_code if (is_dev_mode and EXPOSE_DEV_OTP_IN_JSON) else None,
    })


@auth_bp.post("/verify-otp")
def verify_otp():
    data = request.get_json(silent=True) or {}
    temp_token = (data.get("temp_token") or "").strip()
    otp_code = (data.get("otp") or "").strip()
    device_id = (data.get("device_id") or "").strip()
    device_name = (data.get("device_name") or "Web Browser").strip()
    trust_device = data.get("trust_device", True)

    ip = _get_client_ip()
    ua = _get_user_agent()

    if not temp_token or not otp_code:
        return jsonify({"error": "Missing verification code or session token"}), 400

    challenge = database.get_device_otp_by_token(temp_token)
    if challenge is None:
        return jsonify({"error": "Verification code has expired or is invalid. Please log in again."}), 400

    if challenge["attempts"] >= 5:
        database.consume_device_otp(challenge["id"])
        database.log_security_event(challenge["user_id"], "otp_lockout", ip, ua, "Too many failed OTP attempts")
        return jsonify({"error": "Too many failed attempts. Please request a new verification code."}), 429

    if otp_code != challenge["otp_code"]:
        database.increment_otp_attempts(challenge["id"])
        database.log_security_event(challenge["user_id"], "otp_failed", ip, ua, "Incorrect OTP submitted")
        return jsonify({"error": "Incorrect verification code. Please check your email."}), 400

    # Verification successful: consume OTP
    database.consume_device_otp(challenge["id"])

    # Trust device if user requested
    if trust_device and device_id:
        database.trust_device(challenge["user_id"], device_id, device_name, ip, ua)
        # Send security notification email
        send_login_alert_email(challenge["email"], challenge["username"], device_name, ip)

    database.log_security_event(challenge["user_id"], "login_mfa_success", ip, ua, f"Device verified: {device_name}")

    token = create_token(challenge["user_id"], challenge["username"])
    return jsonify({
        "token": token,
        "user": {
            "id": challenge["user_id"],
            "username": challenge["username"],
            "email": challenge["email"],
        },
    })


@auth_bp.post("/resend-otp")
def resend_otp():
    data = request.get_json(silent=True) or {}
    temp_token = (data.get("temp_token") or "").strip()
    device_name = (data.get("device_name") or "Web Browser").strip()

    if not temp_token:
        return jsonify({"error": "Missing session token"}), 400

    challenge = database.get_device_otp_by_token(temp_token)
    if challenge is None:
        return jsonify({"error": "Session expired. Please enter your credentials again."}), 400

    new_otp = f"{secrets.randbelow(900000) + 100000}"
    ip = _get_client_ip()

    database.create_device_otp(
        challenge["user_id"],
        challenge["device_id"],
        new_otp,
        temp_token,
        ttl_minutes=OTP_EXPIRY_MINUTES,
    )

    send_device_otp_email(challenge["email"], challenge["username"], new_otp, device_name, ip)

    is_dev_mode = not SMTP_HOST or not SMTP_USER
    return jsonify({
        "sent": True,
        "masked_email": mask_email(challenge["email"]),
        "dev_mode": is_dev_mode,
        "dev_otp": new_otp if (is_dev_mode and EXPOSE_DEV_OTP_IN_JSON) else None,
    })


@auth_bp.get("/devices")
@login_required
def list_devices():
    user = g.current_user
    current_device_id = request.headers.get("X-Device-Id")
    raw_device_name = request.headers.get("X-Device-Name", "")
    current_device_name = urllib.parse.unquote(raw_device_name).strip() if raw_device_name else "Web Browser"
    ip = _get_client_ip()
    ua = _get_user_agent()

    # If the user is authenticated from this browser, keep its device record registered & fresh
    if current_device_id:
        database.trust_device(user["id"], current_device_id, current_device_name or "Web Browser", ip, ua)

    devices = database.list_trusted_devices(user["id"])
    return jsonify([
        {
            "id": d["id"],
            "device_id": d["device_id"],
            "device_name": d["device_name"],
            "ip_address": d["ip_address"],
            "last_used_at": d["last_used_at"],
            "created_at": d["created_at"],
        }
        for d in devices
    ])


@auth_bp.delete("/devices/<string:device_identifier>")
@login_required
def revoke_device(device_identifier):
    user = g.current_user
    count = database.revoke_trusted_device(user["id"], device_identifier)
    if count == 0:
        return jsonify({"error": "Device not found"}), 404

    database.log_security_event(
        user["id"],
        "device_revoked",
        _get_client_ip(),
        _get_user_agent(),
        f"Revoked device identifier: {device_identifier}",
    )
    return jsonify({"revoked": device_identifier})


@auth_bp.get("/security-logs")
@login_required
def get_security_logs():
    user = g.current_user
    logs = database.list_security_logs(user["id"], limit=30)
    return jsonify([
        {
            "id": row["id"],
            "event_type": row["event_type"],
            "ip_address": row["ip_address"],
            "user_agent": row["user_agent"],
            "details": row["details"],
            "created_at": row["created_at"],
        }
        for row in logs
    ])
