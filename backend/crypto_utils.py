"""
Real, reversible AES-256 encryption for video files.

This replaces the legacy desktop app's approach (dividing each grayscale
frame by random noise, which was never invertible) with standard,
industry-accepted AES-256-CBC encryption applied directly to the video's
raw bytes, plus a basic key-wrapping scheme:

  1. Every video gets its own random 256-bit AES data key + random IV.
  2. The video bytes are encrypted with that data key (AES-256-CBC, PKCS7
     padding).
  3. The data key itself is then "wrapped" (encrypted) with a single
     server-side master key before being stored in the database, so the
     database never contains a usable key in plaintext.

This is a standard "envelope encryption" pattern used by real cloud KMS
systems (AWS KMS, GCP KMS, etc.), scaled down for a student project.
"""

import os
import json
import hashlib
import base64

from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives import padding, hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

from config import MASTER_KEY_HEX

MASTER_KEY = bytes.fromhex(MASTER_KEY_HEX)
assert len(MASTER_KEY) == 32, "VIDEOSEC_MASTER_KEY_HEX must be 32 bytes (64 hex chars)"


def _aes_encrypt(key: bytes, iv: bytes, plaintext: bytes) -> bytes:
    padder = padding.PKCS7(128).padder()
    padded = padder.update(plaintext) + padder.finalize()
    cipher = Cipher(algorithms.AES(key), modes.CBC(iv))
    encryptor = cipher.encryptor()
    return encryptor.update(padded) + encryptor.finalize()


def _aes_decrypt(key: bytes, iv: bytes, ciphertext: bytes) -> bytes:
    cipher = Cipher(algorithms.AES(key), modes.CBC(iv))
    decryptor = cipher.decryptor()
    padded = decryptor.update(ciphertext) + decryptor.finalize()
    unpadder = padding.PKCS7(128).unpadder()
    return unpadder.update(padded) + unpadder.finalize()


def generate_data_key():
    """A fresh random 256-bit key + 128-bit IV for one video."""
    return os.urandom(32), os.urandom(16)


def wrap_key(data_key: bytes) -> str:
    """Encrypt a per-video data key with the server master key for storage."""
    iv = os.urandom(16)
    wrapped = _aes_encrypt(MASTER_KEY, iv, data_key)
    # store iv alongside the wrapped key, base64-encoded, colon-separated
    return base64.b64encode(iv).decode() + ":" + base64.b64encode(wrapped).decode()


def unwrap_key(wrapped_str: str) -> bytes:
    iv_b64, wrapped_b64 = wrapped_str.split(":")
    iv = base64.b64decode(iv_b64)
    wrapped = base64.b64decode(wrapped_b64)
    return _aes_decrypt(MASTER_KEY, iv, wrapped)


def encrypt_video_file(input_path, output_path):
    """
    Encrypts the file at input_path with a fresh random key, writes the
    ciphertext to output_path. Returns (wrapped_key_str, iv_b64, sha256_hex,
    original_size).
    """
    with open(input_path, "rb") as f:
        plaintext = f.read()

    original_size = len(plaintext)
    sha256_hex = hashlib.sha256(plaintext).hexdigest()

    data_key, iv = generate_data_key()
    ciphertext = _aes_encrypt(data_key, iv, plaintext)

    with open(output_path, "wb") as f:
        f.write(ciphertext)

    wrapped_key_str = wrap_key(data_key)
    iv_b64 = base64.b64encode(iv).decode()

    return wrapped_key_str, iv_b64, sha256_hex, original_size


def decrypt_video_bytes(ciphertext: bytes, wrapped_key_str: str, iv_b64: str,
                         expected_sha256=None) -> bytes:
    """
    Decrypts ciphertext fully in memory and returns the plaintext bytes.
    Used for in-browser "View" playback, where we deliberately never want
    a decrypted copy to touch disk - the plaintext exists only for the
    lifetime of the request/response.
    """
    data_key = unwrap_key(wrapped_key_str)
    iv = base64.b64decode(iv_b64)

    plaintext = _aes_decrypt(data_key, iv, ciphertext)

    if expected_sha256 is not None:
        actual = hashlib.sha256(plaintext).hexdigest()
        if actual != expected_sha256:
            raise ValueError("Integrity check failed: file may be corrupted or tampered with")

    return plaintext


def encrypt_bytes(plaintext: bytes):
    """Encrypt arbitrary file bytes with a fresh key and wrapped-key metadata."""
    sha256_hex = hashlib.sha256(plaintext).hexdigest()
    data_key, iv = generate_data_key()
    ciphertext = _aes_encrypt(data_key, iv, plaintext)
    return (
        ciphertext,
        wrap_key(data_key),
        base64.b64encode(iv).decode(),
        sha256_hex,
        len(plaintext),
    )


def decrypt_bytes(ciphertext: bytes, wrapped_key_str: str, iv_b64: str,
                  expected_sha256=None) -> bytes:
    """Decrypt arbitrary file bytes in memory and optionally verify integrity."""
    data_key = unwrap_key(wrapped_key_str)
    iv = base64.b64decode(iv_b64)
    plaintext = _aes_decrypt(data_key, iv, ciphertext)

    if expected_sha256 is not None:
        actual = hashlib.sha256(plaintext).hexdigest()
        if actual != expected_sha256:
            raise ValueError("Integrity check failed: file may be corrupted or tampered with")

    return plaintext


def decrypt_video_file(input_path, output_path, wrapped_key_str, iv_b64,
                        expected_sha256=None):
    """
    Decrypts input_path back to output_path using the stored wrapped key
    + iv. If expected_sha256 is given, verifies integrity after decrypting
    and raises ValueError on mismatch (tamper / corruption detection).
    """
    data_key = unwrap_key(wrapped_key_str)
    iv = base64.b64decode(iv_b64)

    with open(input_path, "rb") as f:
        ciphertext = f.read()

    plaintext = _aes_decrypt(data_key, iv, ciphertext)

    if expected_sha256 is not None:
        actual = hashlib.sha256(plaintext).hexdigest()
        if actual != expected_sha256:
            raise ValueError("Integrity check failed: file may be corrupted or tampered with")

    with open(output_path, "wb") as f:
        f.write(plaintext)

    return output_path


# --- Portable Container (.vsec) Offline Crypto ---
VSEC_MAGIC = b"VSEC01"


def _derive_pin_key(pin: str, salt: bytes) -> bytes:
    """Derives a 256-bit AES key from a user's PIN/passphrase using 100,000 rounds of PBKDF2."""
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=100000,
    )
    return kdf.derive(pin.encode("utf-8"))


def create_vsec_package(plaintext_bytes: bytes, original_filename: str, pin: str) -> bytes:
    """
    Packages a video into an encrypted .vsec container locked with a custom user PIN.
    Format: VSEC01 (6B) + salt (16B) + IV (16B) + meta_length (4B) + JSON metadata + AES-256 ciphertext.
    """
    salt = os.urandom(16)
    iv = os.urandom(16)
    key = _derive_pin_key(pin, salt)
    sha256_hex = hashlib.sha256(plaintext_bytes).hexdigest()

    metadata = {
        "filename": original_filename,
        "sha256": sha256_hex,
        "size": len(plaintext_bytes),
    }
    meta_bytes = json.dumps(metadata).encode("utf-8")
    ciphertext = _aes_encrypt(key, iv, plaintext_bytes)

    return (
        VSEC_MAGIC
        + salt
        + iv
        + len(meta_bytes).to_bytes(4, "big")
        + meta_bytes
        + ciphertext
    )


def unlock_vsec_package(package_bytes: bytes, pin: str) -> tuple[bytes, dict]:
    """
    Decrypts a .vsec container using the provided user PIN.
    Verifies SHA-256 integrity and returns (plaintext_bytes, metadata_dict).
    """
    if not package_bytes.startswith(VSEC_MAGIC):
        raise ValueError("Invalid file format. Not a recognized VIDEOSEC (.vsec) package.")

    offset = len(VSEC_MAGIC)
    salt = package_bytes[offset : offset + 16]
    offset += 16
    iv = package_bytes[offset : offset + 16]
    offset += 16
    meta_len = int.from_bytes(package_bytes[offset : offset + 4], "big")
    offset += 4
    meta_json = package_bytes[offset : offset + meta_len]
    offset += meta_len
    ciphertext = package_bytes[offset:]

    metadata = json.loads(meta_json.decode("utf-8"))
    key = _derive_pin_key(pin, salt)

    try:
        plaintext = _aes_decrypt(key, iv, ciphertext)
    except Exception:
        raise ValueError("Incorrect PIN or corrupted package.")

    actual_sha256 = hashlib.sha256(plaintext).hexdigest()
    if actual_sha256 != metadata.get("sha256"):
        raise ValueError("Integrity verification failed: file content is tampered with or corrupted.")

    return plaintext, metadata

