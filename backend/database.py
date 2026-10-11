"""
Lightweight SQLite persistence layer for VIDEOSEC.

Using Python's built-in sqlite3 module keeps the project dependency-free
for the database layer. Swapping this out for PostgreSQL / MongoDB Atlas
later just means replacing the functions in this file - every route
calls into these functions rather than writing SQL directly.
"""

import sqlite3
import datetime
from contextlib import contextmanager

from config import DB_PATH


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


@contextmanager
def db_cursor():
    conn = get_connection()
    try:
        cur = conn.cursor()
        yield cur
        conn.commit()
    finally:
        conn.close()


def init_db():
    with db_cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS videos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                original_filename TEXT NOT NULL,
                stored_filename TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'encrypted',
                wrapped_key TEXT NOT NULL,
                iv TEXT NOT NULL,
                sha256_original TEXT NOT NULL,
                size_bytes INTEGER NOT NULL,
                uploaded_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS encrypted_files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                owner_id INTEGER NOT NULL,
                original_filename TEXT NOT NULL,
                stored_filename TEXT NOT NULL,
                wrapped_key TEXT NOT NULL,
                iv TEXT NOT NULL,
                sha256_original TEXT NOT NULL,
                size_bytes INTEGER NOT NULL,
                uploaded_at TEXT NOT NULL,
                FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS encrypted_file_shares (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_id INTEGER NOT NULL,
                owner_id INTEGER NOT NULL,
                shared_with_user_id INTEGER,
                share_token TEXT UNIQUE NOT NULL,
                pin_hash TEXT,
                permission TEXT NOT NULL DEFAULT 'view_only',
                max_views INTEGER,
                view_count INTEGER NOT NULL DEFAULT 0,
                expires_at TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (file_id) REFERENCES encrypted_files (id) ON DELETE CASCADE,
                FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE,
                FOREIGN KEY (shared_with_user_id) REFERENCES users (id) ON DELETE CASCADE
            )
            """
        )
        cur.execute(
            "CREATE INDEX IF NOT EXISTS idx_encrypted_file_shares_recipient "
            "ON encrypted_file_shares (shared_with_user_id, created_at)"
        )
        cur.execute(
            "CREATE INDEX IF NOT EXISTS idx_encrypted_file_shares_owner "
            "ON encrypted_file_shares (owner_id, created_at)"
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS video_shares (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                video_id INTEGER NOT NULL,
                owner_id INTEGER NOT NULL,
                shared_with_user_id INTEGER,
                share_token TEXT UNIQUE NOT NULL,
                pin_hash TEXT,
                permission TEXT NOT NULL DEFAULT 'view_only',
                max_views INTEGER,
                view_count INTEGER NOT NULL DEFAULT 0,
                expires_at TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (video_id) REFERENCES videos (id) ON DELETE CASCADE,
                FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE,
                FOREIGN KEY (shared_with_user_id) REFERENCES users (id) ON DELETE CASCADE
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS trusted_devices (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                device_id TEXT NOT NULL,
                device_name TEXT NOT NULL,
                ip_address TEXT,
                user_agent TEXT,
                last_used_at TEXT NOT NULL,
                created_at TEXT NOT NULL,
                UNIQUE (user_id, device_id),
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS device_otps (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                device_id TEXT NOT NULL,
                otp_code TEXT NOT NULL,
                temp_token TEXT UNIQUE NOT NULL,
                attempts INTEGER NOT NULL DEFAULT 0,
                expires_at TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS security_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                event_type TEXT NOT NULL,
                ip_address TEXT,
                user_agent TEXT,
                details TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )
            """
        )



# ---------------------------------------------------------------- users ---
def create_user(username, email, password_hash):
    with db_cursor() as cur:
        cur.execute(
            "INSERT INTO users (username, email, password_hash, created_at) "
            "VALUES (?, ?, ?, ?)",
            (username, email, password_hash, datetime.datetime.utcnow().isoformat()),
        )
        return cur.lastrowid


def get_user_by_username_or_email(identifier):
    with db_cursor() as cur:
        cur.execute(
            "SELECT * FROM users WHERE username = ? OR email = ?",
            (identifier, identifier),
        )
        return cur.fetchone()


def get_user_by_id(user_id):
    with db_cursor() as cur:
        cur.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        return cur.fetchone()


# --------------------------------------------------------------- videos ---
def create_video(user_id, original_filename, stored_filename, wrapped_key,
                  iv, sha256_original, size_bytes):
    with db_cursor() as cur:
        cur.execute(
            """
            INSERT INTO videos
                (user_id, original_filename, stored_filename, status,
                 wrapped_key, iv, sha256_original, size_bytes, uploaded_at)
            VALUES (?, ?, ?, 'encrypted', ?, ?, ?, ?, ?)
            """,
            (
                user_id, original_filename, stored_filename, wrapped_key,
                iv, sha256_original, size_bytes,
                datetime.datetime.utcnow().isoformat(),
            ),
        )
        return cur.lastrowid


def list_videos_for_user(user_id):
    with db_cursor() as cur:
        cur.execute(
            "SELECT id, original_filename, status, size_bytes, uploaded_at "
            "FROM videos WHERE user_id = ? ORDER BY uploaded_at DESC",
            (user_id,),
        )
        return cur.fetchall()


def get_video(video_id, user_id):
    with db_cursor() as cur:
        cur.execute(
            "SELECT * FROM videos WHERE id = ? AND user_id = ?",
            (video_id, user_id),
        )
        return cur.fetchone()


def delete_video(video_id, user_id):
    with db_cursor() as cur:
        cur.execute(
            "DELETE FROM videos WHERE id = ? AND user_id = ?",
            (video_id, user_id),
        )
        return cur.rowcount


def get_video_by_id(video_id):
    with db_cursor() as cur:
        cur.execute("SELECT * FROM videos WHERE id = ?", (video_id,))
        return cur.fetchone()


# ---------------------------------------------------------- encrypted files ---
def create_encrypted_file(owner_id, original_filename, stored_filename,
                          wrapped_key, iv, sha256_original, size_bytes):
    with db_cursor() as cur:
        cur.execute(
            """
            INSERT INTO encrypted_files
                (owner_id, original_filename, stored_filename, wrapped_key,
                 iv, sha256_original, size_bytes, uploaded_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                owner_id, original_filename, stored_filename, wrapped_key,
                iv, sha256_original, size_bytes,
                datetime.datetime.utcnow().isoformat(),
            ),
        )
        return cur.lastrowid


def list_encrypted_files(owner_id):
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT id, original_filename, size_bytes, uploaded_at
            FROM encrypted_files
            WHERE owner_id = ?
            ORDER BY uploaded_at DESC
            """,
            (owner_id,),
        )
        return cur.fetchall()


def get_encrypted_file(file_id, owner_id):
    with db_cursor() as cur:
        cur.execute(
            "SELECT * FROM encrypted_files WHERE id = ? AND owner_id = ?",
            (file_id, owner_id),
        )
        return cur.fetchone()


def delete_encrypted_file(file_id, owner_id):
    with db_cursor() as cur:
        cur.execute(
            "DELETE FROM encrypted_files WHERE id = ? AND owner_id = ?",
            (file_id, owner_id),
        )
        return cur.rowcount


def create_encrypted_file_share(file_id, owner_id, shared_with_user_id,
                                share_token, pin_hash, permission, max_views,
                                expires_at):
    with db_cursor() as cur:
        cur.execute(
            """
            INSERT INTO encrypted_file_shares
                (file_id, owner_id, shared_with_user_id, share_token, pin_hash,
                 permission, max_views, expires_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                file_id, owner_id, shared_with_user_id, share_token, pin_hash,
                permission, max_views, expires_at,
                datetime.datetime.utcnow().isoformat(),
            ),
        )
        return cur.lastrowid


def get_encrypted_file_share_by_token(share_token):
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT s.*, f.original_filename, f.stored_filename, f.size_bytes,
                   f.wrapped_key, f.iv, f.sha256_original,
                   owner.username AS owner_username,
                   recipient.username AS recipient_username
            FROM encrypted_file_shares s
            JOIN encrypted_files f ON s.file_id = f.id
            JOIN users owner ON s.owner_id = owner.id
            LEFT JOIN users recipient ON s.shared_with_user_id = recipient.id
            WHERE s.share_token = ?
            """,
            (share_token,),
        )
        return cur.fetchone()


def list_encrypted_file_shares_for_recipient(user_id):
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT s.id, s.share_token, s.permission, s.max_views, s.view_count,
                   s.expires_at, s.created_at, s.pin_hash IS NOT NULL AS has_pin,
                   f.id AS file_id, f.original_filename, f.size_bytes,
                   owner.username AS owner_username
            FROM encrypted_file_shares s
            JOIN encrypted_files f ON s.file_id = f.id
            JOIN users owner ON s.owner_id = owner.id
            WHERE s.shared_with_user_id = ?
            ORDER BY s.created_at DESC
            """,
            (user_id,),
        )
        return cur.fetchall()


def list_encrypted_file_shares_by_owner(owner_id):
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT s.id, s.share_token, s.permission, s.max_views, s.view_count,
                   s.expires_at, s.created_at, s.pin_hash IS NOT NULL AS has_pin,
                   f.id AS file_id, f.original_filename, f.size_bytes,
                   recipient.username AS recipient_username
            FROM encrypted_file_shares s
            JOIN encrypted_files f ON s.file_id = f.id
            LEFT JOIN users recipient ON s.shared_with_user_id = recipient.id
            WHERE s.owner_id = ?
            ORDER BY s.created_at DESC
            """,
            (owner_id,),
        )
        return cur.fetchall()


def increment_encrypted_file_share_view_count(share_id):
    with db_cursor() as cur:
        cur.execute(
            "UPDATE encrypted_file_shares SET view_count = view_count + 1 WHERE id = ?",
            (share_id,),
        )
        return cur.rowcount == 1


def consume_encrypted_file_share_view(share_id, max_views):
    with db_cursor() as cur:
        if max_views is None:
            cur.execute(
                "UPDATE encrypted_file_shares SET view_count = view_count + 1 WHERE id = ?",
                (share_id,),
            )
        else:
            cur.execute(
                """
                UPDATE encrypted_file_shares
                SET view_count = view_count + 1
                WHERE id = ? AND view_count < ?
                """,
                (share_id, max_views),
            )
        return cur.rowcount == 1


def delete_encrypted_file_share(share_id, owner_id):
    with db_cursor() as cur:
        cur.execute(
            "DELETE FROM encrypted_file_shares WHERE id = ? AND owner_id = ?",
            (share_id, owner_id),
        )
        return cur.rowcount


def update_encrypted_file_share(share_id, owner_id, permission=None,
                                expires_at=None, pin_hash=None):
    with db_cursor() as cur:
        updates = []
        params = []
        if permission is not None:
            updates.append("permission = ?")
            params.append(permission)
        if expires_at is not None:
            updates.append("expires_at = ?")
            params.append(expires_at)
        if pin_hash is not None:
            updates.append("pin_hash = ?")
            params.append(pin_hash)
        if not updates:
            return 0
        params.extend([share_id, owner_id])
        cur.execute(
            f"UPDATE encrypted_file_shares SET {', '.join(updates)} "
            "WHERE id = ? AND owner_id = ?",
            tuple(params),
        )
        return cur.rowcount


# -------------------------------------------------------------- shares ---
def create_share(video_id, owner_id, shared_with_user_id, share_token,
                 pin_hash, permission, max_views, expires_at):
    with db_cursor() as cur:
        cur.execute(
            """
            INSERT INTO video_shares
                (video_id, owner_id, shared_with_user_id, share_token,
                 pin_hash, permission, max_views, expires_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                video_id, owner_id, shared_with_user_id, share_token,
                pin_hash, permission, max_views, expires_at,
                datetime.datetime.utcnow().isoformat(),
            ),
        )
        return cur.lastrowid


def get_share_by_token(share_token):
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT s.*, v.original_filename, v.stored_filename, v.size_bytes,
                   v.wrapped_key, v.iv, v.sha256_original,
                   u.username AS owner_username
            FROM video_shares s
            JOIN videos v ON s.video_id = v.id
            JOIN users u ON s.owner_id = u.id
            WHERE s.share_token = ?
            """,
            (share_token,),
        )
        return cur.fetchone()


def get_share_by_id(share_id):
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT s.*, v.original_filename, v.stored_filename, v.size_bytes,
                   v.wrapped_key, v.iv, v.sha256_original,
                   u.username AS owner_username
            FROM video_shares s
            JOIN videos v ON s.video_id = v.id
            JOIN users u ON s.owner_id = u.id
            WHERE s.id = ?
            """,
            (share_id,),
        )
        return cur.fetchone()


def list_shares_for_recipient(user_id):
    """Lists all videos shared directly with a recipient user."""
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT s.id, s.share_token, s.permission, s.max_views, s.view_count,
                   s.expires_at, s.created_at, s.pin_hash IS NOT NULL AS has_pin,
                   v.id AS video_id, v.original_filename, v.size_bytes,
                   u.username AS owner_username
            FROM video_shares s
            JOIN videos v ON s.video_id = v.id
            JOIN users u ON s.owner_id = u.id
            WHERE s.shared_with_user_id = ?
            ORDER BY s.created_at DESC
            """,
            (user_id,),
        )
        return cur.fetchall()


def list_shares_by_owner(owner_id):
    """Lists all shares created by a user."""
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT s.id, s.share_token, s.permission, s.max_views, s.view_count,
                   s.expires_at, s.created_at, s.pin_hash IS NOT NULL AS has_pin,
                   v.id AS video_id, v.original_filename,
                   recipient.username AS recipient_username
            FROM video_shares s
            JOIN videos v ON s.video_id = v.id
            LEFT JOIN users recipient ON s.shared_with_user_id = recipient.id
            WHERE s.owner_id = ?
            ORDER BY s.created_at DESC
            """,
            (owner_id,),
        )
        return cur.fetchall()


def increment_share_view_count(share_id):
    with db_cursor() as cur:
        cur.execute(
            "UPDATE video_shares SET view_count = view_count + 1 WHERE id = ?",
            (share_id,),
        )


def delete_share(share_id, owner_id):
    with db_cursor() as cur:
        cur.execute(
            "DELETE FROM video_shares WHERE id = ? AND owner_id = ?",
            (share_id, owner_id),
        )
        return cur.rowcount


def update_share(share_id, owner_id, permission=None, expires_at=None, pin_hash=None):
    with db_cursor() as cur:
        updates = []
        params = []
        if permission is not None:
            updates.append("permission = ?")
            params.append(permission)
        if expires_at is not None:
            updates.append("expires_at = ?")
            params.append(expires_at)
        if pin_hash is not None:
            updates.append("pin_hash = ?")
            params.append(pin_hash)
        if not updates:
            return 0
        params.extend([share_id, owner_id])
        cur.execute(
            f"UPDATE video_shares SET {', '.join(updates)} WHERE id = ? AND owner_id = ?",
            tuple(params),
        )
        return cur.rowcount


# --------------------------------------------------- Security & Devices ---
def is_device_trusted(user_id: int, device_id: str) -> bool:
    if not device_id:
        return False
    with db_cursor() as cur:
        cur.execute(
            "SELECT 1 FROM trusted_devices WHERE user_id = ? AND device_id = ?",
            (user_id, device_id),
        )
        return cur.fetchone() is not None


def trust_device(user_id: int, device_id: str, device_name: str, ip_address: str = None, user_agent: str = None):
    now = datetime.datetime.utcnow().isoformat()
    with db_cursor() as cur:
        cur.execute(
            """
            INSERT INTO trusted_devices (user_id, device_id, device_name, ip_address, user_agent, last_used_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id, device_id) DO UPDATE SET
                device_name = excluded.device_name,
                ip_address = excluded.ip_address,
                user_agent = excluded.user_agent,
                last_used_at = excluded.last_used_at
            """,
            (user_id, device_id, device_name or "Unknown Browser", ip_address, user_agent, now, now),
        )


def update_device_activity(user_id: int, device_id: str, ip_address: str = None, user_agent: str = None):
    now = datetime.datetime.utcnow().isoformat()
    with db_cursor() as cur:
        cur.execute(
            """
            UPDATE trusted_devices
            SET last_used_at = ?, ip_address = COALESCE(?, ip_address), user_agent = COALESCE(?, user_agent)
            WHERE user_id = ? AND device_id = ?
            """,
            (now, ip_address, user_agent, user_id, device_id),
        )


def list_trusted_devices(user_id: int):
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT id, device_id, device_name, ip_address, user_agent, last_used_at, created_at
            FROM trusted_devices
            WHERE user_id = ?
            ORDER BY last_used_at DESC
            """,
            (user_id,),
        )
        return cur.fetchall()


def revoke_trusted_device(user_id: int, device_identifier):
    with db_cursor() as cur:
        cur.execute(
            "DELETE FROM trusted_devices WHERE user_id = ? AND (device_id = ? OR id = ?)",
            (user_id, str(device_identifier), str(device_identifier)),
        )
        return cur.rowcount


def create_device_otp(user_id: int, device_id: str, otp_code: str, temp_token: str, ttl_minutes: int = 10):
    now = datetime.datetime.utcnow()
    expires_at = (now + datetime.timedelta(minutes=ttl_minutes)).isoformat()
    now_iso = now.isoformat()
    with db_cursor() as cur:
        # Clear out any stale OTPs for this user & device
        cur.execute(
            "DELETE FROM device_otps WHERE user_id = ? AND (device_id = ? OR expires_at < ?)",
            (user_id, device_id, now_iso),
        )
        cur.execute(
            """
            INSERT INTO device_otps (user_id, device_id, otp_code, temp_token, attempts, expires_at, created_at)
            VALUES (?, ?, ?, ?, 0, ?, ?)
            """,
            (user_id, device_id, otp_code, temp_token, expires_at, now_iso),
        )


def get_device_otp_by_token(temp_token: str):
    now_iso = datetime.datetime.utcnow().isoformat()
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT o.*, u.username, u.email, u.id AS user_id
            FROM device_otps o
            JOIN users u ON o.user_id = u.id
            WHERE o.temp_token = ? AND o.expires_at > ?
            """,
            (temp_token, now_iso),
        )
        return cur.fetchone()


def increment_otp_attempts(otp_id: int):
    with db_cursor() as cur:
        cur.execute("UPDATE device_otps SET attempts = attempts + 1 WHERE id = ?", (otp_id,))


def consume_device_otp(otp_id: int):
    with db_cursor() as cur:
        cur.execute("DELETE FROM device_otps WHERE id = ?", (otp_id,))


def log_security_event(user_id: int, event_type: str, ip_address: str = None, user_agent: str = None, details: str = None):
    now_iso = datetime.datetime.utcnow().isoformat()
    with db_cursor() as cur:
        cur.execute(
            """
            INSERT INTO security_logs (user_id, event_type, ip_address, user_agent, details, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (user_id, event_type, ip_address, user_agent, details, now_iso),
        )


def list_security_logs(user_id: int, limit: int = 30):
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT id, event_type, ip_address, user_agent, details, created_at
            FROM security_logs
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT ?
            """,
            (user_id, limit),
        )
        return cur.fetchall()



