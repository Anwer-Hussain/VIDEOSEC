"""
Email notification and OTP service for VIDEOSEC.

Supports real SMTP delivery when configured in .env / environment variables.
In development mode (when SMTP is not configured), it logs the formatted email
and OTP directly to the server console/logs so testing is seamless out of the box.
"""

import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import logging

from config import (
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASSWORD,
    SMTP_FROM,
    SMTP_USE_TLS,
)

logger = logging.getLogger("videosec.email")


def mask_email(email: str) -> str:
    """Returns a masked version of email, e.g. 'alexander@example.com' -> 'a***r@example.com'"""
    if not email or "@" not in email:
        return email
    local, domain = email.split("@", 1)
    if len(local) <= 2:
        masked_local = local[0] + "*"
    else:
        masked_local = local[0] + "*" * (len(local) - 2) + local[-1]
    return f"{masked_local}@{domain}"


def send_email(to_email: str, subject: str, html_body: str, text_body: str = "") -> dict:
    """
    Sends an email using configured SMTP settings.
    Falls back to console output if SMTP credentials are not configured.
    """
    if not text_body:
        text_body = html_body

    if not SMTP_HOST or not SMTP_USER:
        # Development / Demo mode: print clearly to terminal safely on Windows
        header_text = (
            "\n" + "=" * 64 + "\n"
            + " [VIDEOSEC SECURITY NOTICE - DEV MODE EMAIL]\n"
            + f" To: {to_email}\n"
            + f" Subject: {subject}\n"
            + "-" * 64 + "\n"
            + text_body.strip() + "\n"
            + "=" * 64 + "\n"
        )
        try:
            print(header_text, flush=True)
        except UnicodeEncodeError:
            safe_text = header_text.encode("ascii", "replace").decode("ascii")
            print(safe_text, flush=True)
        return {"sent": True, "simulated": True, "error": None}

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = SMTP_FROM
        msg["To"] = to_email

        msg.attach(MIMEText(text_body, "plain"))
        msg.attach(MIMEText(html_body, "html"))

        if SMTP_PORT == 465:
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=context, timeout=10) as server:
                server.login(SMTP_USER, SMTP_PASSWORD)
                server.sendmail(SMTP_FROM, [to_email], msg.as_string())
        else:
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
                if SMTP_USE_TLS:
                    context = ssl.create_default_context()
                    server.starttls(context=context)
                server.login(SMTP_USER, SMTP_PASSWORD)
                server.sendmail(SMTP_FROM, [to_email], msg.as_string())

        return {"sent": True, "simulated": False, "error": None}
    except Exception as e:
        logger.error(f"Failed to send email via SMTP to {to_email}: {e}")
        # Print fallback so user is never blocked
        print("\n" + "!" * 64)
        print(f" [SMTP ERROR: {e}] - FALLBACK DISPLAY TO CONSOLE:")
        print(f" To: {to_email} | Subject: {subject}")
        print(text_body.strip())
        print("!" * 64 + "\n", flush=True)
        return {"sent": False, "simulated": True, "error": str(e)}


def send_device_otp_email(to_email: str, username: str, otp_code: str, device_name: str, ip_address: str):
    """Dispatches a 6-digit verification code to the user's email."""
    subject = f"🔐 VIDEOSEC Verification Code: {otp_code}"

    text_body = f"""
Hello {username},

A login attempt was initiated from an unrecognized device:
Device: {device_name}
IP Address: {ip_address}

Your one-time 6-digit verification code is:

    {otp_code}

This code expires in 10 minutes. If this wasn't you, someone may have compromised your password. Please change your password immediately.
"""

    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: 'Segoe UI', Arial, sans-serif; background-color: #0b0e1b; color: #f0f2fd; margin: 0; padding: 24px; }}
        .box {{ max-width: 480px; margin: 0 auto; background: #161a2e; border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; padding: 32px; }}
        .header {{ font-size: 20px; font-weight: bold; color: #a78bfa; margin-bottom: 12px; }}
        .code {{ font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #22d3ee; background: rgba(34,211,238,0.1); border: 1px dashed #22d3ee; border-radius: 10px; padding: 16px; text-align: center; margin: 24px 0; }}
        .meta {{ font-size: 13px; color: #9aa0c3; line-height: 1.6; background: rgba(255,255,255,0.04); padding: 12px 16px; border-radius: 8px; }}
        .warning {{ font-size: 12px; color: #f87171; margin-top: 20px; }}
      </style>
    </head>
    <body>
      <div class="box">
        <div class="header">🛡️ VIDEOSEC Security Verification</div>
        <p>Hello <strong>{username}</strong>,</p>
        <p>A login was requested from a new or unrecognized browser:</p>
        <div class="meta">
          <strong>Device:</strong> {device_name}<br>
          <strong>IP Address:</strong> {ip_address}
        </div>
        <div class="code">{otp_code}</div>
        <p style="font-size: 13px; color: #9aa0c3;">This code is valid for 10 minutes. Never share this code with anyone.</p>
        <div class="warning">
          ⚠️ If you did not attempt this login, your password may be compromised. Someone may be trying to access your encrypted videos.
        </div>
      </div>
    </body>
    </html>
    """

    return send_email(to_email, subject, html_body, text_body)


def send_login_alert_email(to_email: str, username: str, device_name: str, ip_address: str):
    """Sends a security notice when a new device is trusted and logged in."""
    subject = f"🔔 Security Alert: New device logged into VIDEOSEC ({device_name})"

    text_body = f"""
Hello {username},

Your VIDEOSEC account was successfully logged in from a new device:
Device: {device_name}
IP Address: {ip_address}

If this was you, no action is needed.
If this wasn't you, log into your account immediately to revoke active devices and update your password.
"""

    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: 'Segoe UI', Arial, sans-serif; background-color: #0b0e1b; color: #f0f2fd; margin: 0; padding: 24px; }}
        .box {{ max-width: 480px; margin: 0 auto; background: #161a2e; border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; padding: 32px; }}
        .header {{ font-size: 20px; font-weight: bold; color: #22d3ee; margin-bottom: 12px; }}
        .meta {{ font-size: 13px; color: #9aa0c3; line-height: 1.6; background: rgba(255,255,255,0.04); padding: 12px 16px; border-radius: 8px; margin: 16px 0; }}
      </style>
    </head>
    <body>
      <div class="box">
        <div class="header">🔔 New Device Authorized</div>
        <p>Hello <strong>{username}</strong>,</p>
        <p>A new device has been authorized to access your VIDEOSEC encrypted vault:</p>
        <div class="meta">
          <strong>Device:</strong> {device_name}<br>
          <strong>IP Address:</strong> {ip_address}
        </div>
        <p style="font-size: 13px; color: #9aa0c3;">If this was you, you can safely ignore this notification. If you did not authorize this, log in and revoke this device immediately under Security & Devices.</p>
      </div>
    </body>
    </html>
    """

    return send_email(to_email, subject, html_body, text_body)
