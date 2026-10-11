"""
JWT-based authentication helpers for VIDEOSEC.

Passwords are hashed with werkzeug's generate_password_hash (bundled with
Flask, uses PBKDF2-SHA256 with a random per-password salt), never stored
in plaintext.
"""

import datetime
from functools import wraps

import jwt
from flask import request, jsonify, g
from werkzeug.security import generate_password_hash, check_password_hash

from config import JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRY_HOURS
import database


def hash_password(password: str) -> str:
    return generate_password_hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return check_password_hash(password_hash, password)


def create_token(user_id: int, username: str) -> str:
    payload = {
        "sub": str(user_id),
        "username": username,
        "iat": datetime.datetime.utcnow(),
        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=JWT_EXPIRY_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str):
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])


def login_required(fn):
    """Route decorator: requires a valid 'Authorization: Bearer <token>' header."""

    @wraps(fn)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid Authorization header"}), 401

        token = auth_header.split(" ", 1)[1]
        try:
            payload = decode_token(token)
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Session expired, please log in again"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid authentication token"}), 401

        user = database.get_user_by_id(int(payload["sub"]))
        if user is None:
            return jsonify({"error": "User no longer exists"}), 401

        g.current_user = user
        return fn(*args, **kwargs)

    return wrapper
