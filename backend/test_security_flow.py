"""
Automated verification test for VIDEOSEC new device detection, OTP flow,
and step-up download protection.
"""

import os
import sys
import unittest
import json

from app import create_app
import database


class SecurityFlowTestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.client = self.app.test_client()
        database.init_db()

    def test_security_flow(self):
        import uuid
        test_suffix = uuid.uuid4().hex[:6]
        username = f"sec_user_{test_suffix}"
        email = f"sec_{test_suffix}@example.com"
        password = "Password123!"
        dev_alpha = f"dev_alpha_{test_suffix}"
        dev_beta = f"dev_beta_{test_suffix}"

        reg_res = self.client.post(
            "/api/auth/register",
            json={
                "username": username,
                "email": email,
                "password": password,
                "device_id": dev_alpha,
                "device_name": "Test Laptop Alpha",
            },
        )
        self.assertEqual(reg_res.status_code, 201)

        # 2. Login from trusted device (Alpha)
        login_res = self.client.post(
            "/api/auth/login",
            json={
                "username": username,
                "password": password,
                "device_id": dev_alpha,
                "device_name": "Test Laptop Alpha",
            },
        )
        self.assertEqual(login_res.status_code, 200)
        login_data = login_res.get_json()
        self.assertFalse(login_data.get("mfa_required"))
        self.assertIn("token", login_data)
        token_alpha = login_data["token"]
        print("[PASS] Login from trusted device succeeded without OTP.")

        # 3. Login from an UNRECOGNIZED / NEW device (Beta - simulating attacker or new laptop)
        login_beta_res = self.client.post(
            "/api/auth/login",
            json={
                "username": username,
                "password": password,
                "device_id": dev_beta,
                "device_name": "Untrusted Device Beta",
            },
        )
        self.assertEqual(login_beta_res.status_code, 200)
        beta_data = login_beta_res.get_json()
        self.assertTrue(beta_data.get("mfa_required"))
        self.assertIn("temp_token", beta_data)
        # Ensure the OTP is NOT returned in the API response to the client
        self.assertNotIn("dev_otp", beta_data)
        temp_token = beta_data["temp_token"]
        # Fetch expected OTP from the secure database challenge for testing
        challenge = database.get_device_otp_by_token(temp_token)
        otp = challenge["otp_code"]
        print(f"[PASS] Login from new device blocked with OTP challenge. Zero leakage in API response!")

        # 4. Attempt to verify with WRONG OTP
        wrong_res = self.client.post(
            "/api/auth/verify-otp",
            json={
                "temp_token": temp_token,
                "otp": "000000",
                "device_id": dev_beta,
                "device_name": "Untrusted Device Beta",
                "trust_device": True,
            },
        )
        self.assertEqual(wrong_res.status_code, 400)
        print("[PASS] Wrong OTP rejected correctly.")

        # 5. Verify with CORRECT OTP and trust this device
        verify_res = self.client.post(
            "/api/auth/verify-otp",
            json={
                "temp_token": temp_token,
                "otp": otp,
                "device_id": dev_beta,
                "device_name": "Untrusted Device Beta",
                "trust_device": True,
            },
        )
        self.assertEqual(verify_res.status_code, 200)
        verify_data = verify_res.get_json()
        self.assertIn("token", verify_data)
        print("[PASS] Correct OTP verified successfully and token issued.")

        # 6. Subsequent login from Device Beta should now be TRUSTED (No OTP needed!)
        subsequent_res = self.client.post(
            "/api/auth/login",
            json={
                "username": username,
                "password": password,
                "device_id": dev_beta,
                "device_name": "Untrusted Device Beta",
            },
        )
        self.assertEqual(subsequent_res.status_code, 200)
        self.assertFalse(subsequent_res.get_json().get("mfa_required"))
        print("[PASS] Subsequent login from trusted Device Beta completed without OTP.")

        # 7. Check Security Logs & Device List
        devices_res = self.client.get(
            "/api/auth/devices",
            headers={"Authorization": f"Bearer {token_alpha}"},
        )
        self.assertEqual(devices_res.status_code, 200)
        devices = devices_res.get_json()
        self.assertGreaterEqual(len(devices), 2)
        print(f"[PASS] Found {len(devices)} trusted devices in list.")

        logs_res = self.client.get(
            "/api/auth/security-logs",
            headers={"Authorization": f"Bearer {token_alpha}"},
        )
        # 8. Test Step-Up Download Protection
        # Request download without confirmation password -> must be 403 Forbidden
        dl_unauth = self.client.post(
            "/api/videos/9999/download",
            headers={"Authorization": f"Bearer {token_alpha}"},
        )
        self.assertEqual(dl_unauth.status_code, 403)
        self.assertIn("Security confirmation required", dl_unauth.get_json()["error"])
        print("[PASS] Unauthorized download attempt without password blocked with 403.")

        # Request download with invalid confirmation password -> must be 403 Forbidden
        dl_wrong = self.client.post(
            "/api/videos/9999/download",
            headers={
                "Authorization": f"Bearer {token_alpha}",
                "X-Confirm-Password": "WrongPassword!",
            },
        )
        self.assertEqual(dl_wrong.status_code, 403)
        print("[PASS] Download attempt with wrong password blocked with 403.")

        # Request download with correct confirmation password -> passes auth gate (returns 404 since video 9999 does not exist)
        dl_correct = self.client.post(
            "/api/videos/9999/download",
            headers={
                "Authorization": f"Bearer {token_alpha}",
                "X-Confirm-Password": password,
            },
        )
        self.assertEqual(dl_correct.status_code, 404)
        print("[PASS] Download with valid confirmation password successfully passed auth gate.")

        print("\nALL SECURITY TESTS PASSED PERFECTLY!")


if __name__ == "__main__":
    unittest.main()
