import io
import unittest
import uuid

from app import create_app
import database
from config import FILE_STORAGE_DIR


class EncryptedFileShareTestCase(unittest.TestCase):
    def setUp(self):
        self.client = create_app().test_client()
        self.owner_id, self.owner_username, self.owner_headers = self._register("owner")
        self.recipient_id, self.recipient_username, self.recipient_headers = self._register("recipient")
        suffix = uuid.uuid4().hex[:10]
        self.filename = f"share-{suffix}.pdf"
        upload = self.client.post(
            "/api/files/upload",
            headers=self.owner_headers,
            data={"file": (io.BytesIO(b"private shared document"), self.filename)},
            content_type="multipart/form-data",
        )
        self.assertEqual(upload.status_code, 201)
        self.file_id = upload.get_json()["id"]
        self.created_shares = []
        self.created_files = []

    def _register(self, label):
        suffix = uuid.uuid4().hex[:10]
        response = self.client.post(
            "/api/auth/register",
            json={
                "username": f"{label}_{suffix}",
                "email": f"{label}_{suffix}@example.com",
                "password": "ShareTestPassword123!",
                "device_id": f"{label}_device_{suffix}",
            },
        )
        self.assertEqual(response.status_code, 201)
        data = response.get_json()
        return (
            data["user"]["id"],
            data["user"]["username"],
            {"Authorization": f"Bearer {data['token']}"},
        )

    def tearDown(self):
        for share_id in self.created_shares:
            database.delete_encrypted_file_share(share_id, self.owner_id)
        if hasattr(self, "file_id"):
            record = database.get_encrypted_file(self.file_id, self.owner_id)
            if record:
                (FILE_STORAGE_DIR / record["stored_filename"]).unlink(missing_ok=True)
                database.delete_encrypted_file(self.file_id, self.owner_id)

    def test_recipient_pin_view_limit_and_revocation(self):
        response = self.client.post(
            f"/api/files/{self.file_id}/share",
            headers=self.owner_headers,
            json={
                "recipient": self.recipient_username,
                "pin": "7159",
                "permission": "view_only",
                "max_views": 1,
                "expires_hours": 24,
            },
        )
        self.assertEqual(response.status_code, 201)
        share = response.get_json()
        self.created_shares.append(share["share_id"])
        token = share["share_token"]

        anonymous_info = self.client.get(f"/api/files/share/{token}/info")
        self.assertEqual(anonymous_info.status_code, 401)
        info = self.client.get(
            f"/api/files/share/{token}/info", headers=self.recipient_headers
        )
        self.assertEqual(info.status_code, 200)
        self.assertTrue(info.get_json()["has_pin"])

        other_id, other_username, other_headers = self._register("different")
        self.assertTrue(other_id)
        self.assertNotEqual(other_username, self.recipient_username)
        wrong_account = self.client.get(
            f"/api/files/share/{token}/info", headers=other_headers
        )
        self.assertEqual(wrong_account.status_code, 403)

        wrong_pin = self.client.post(
            f"/api/files/share/{token}/view",
            headers=self.recipient_headers,
            json={"pin": "0000"},
        )
        self.assertEqual(wrong_pin.status_code, 403)

        allowed = self.client.post(
            f"/api/files/share/{token}/view",
            headers=self.recipient_headers,
            json={"pin": "7159"},
        )
        self.assertEqual(allowed.status_code, 200)
        self.assertEqual(allowed.data, b"private shared document")

        download_disabled = self.client.post(
            f"/api/files/share/{token}/download",
            headers=self.recipient_headers,
            json={"pin": "7159"},
        )
        self.assertEqual(download_disabled.status_code, 403)

        exhausted = self.client.post(
            f"/api/files/share/{token}/view",
            headers=self.recipient_headers,
            json={"pin": "7159"},
        )
        self.assertEqual(exhausted.status_code, 403)

        received = self.client.get(
            "/api/files/shared-with-me", headers=self.recipient_headers
        )
        self.assertEqual(received.status_code, 200)
        self.assertEqual(received.get_json()[0]["share_token"], token)

        denied_revoke = self.client.delete(
            f"/api/files/shares/{share['share_id']}", headers=self.recipient_headers
        )
        self.assertEqual(denied_revoke.status_code, 404)
        revoked = self.client.delete(
            f"/api/files/shares/{share['share_id']}", headers=self.owner_headers
        )
        self.assertEqual(revoked.status_code, 200)
        self.created_shares.remove(share["share_id"])
        self.assertEqual(self.client.get(f"/api/files/share/{token}/info").status_code, 404)
        self.assertEqual(database.list_shares_by_owner(self.owner_id), [])

    def test_open_link_download_permission(self):
        response = self.client.post(
            f"/api/files/{self.file_id}/share",
            headers=self.owner_headers,
            json={"permission": "view_and_download"},
        )
        self.assertEqual(response.status_code, 201)
        share = response.get_json()
        self.created_shares.append(share["share_id"])

        restricted = self.client.patch(
            f"/api/files/shares/{share['share_id']}",
            headers=self.owner_headers,
            json={"permission": "view_only"},
        )
        self.assertEqual(restricted.status_code, 200)
        blocked_download = self.client.post(
            f"/api/files/share/{share['share_token']}/download", json={}
        )
        self.assertEqual(blocked_download.status_code, 403)

        restored = self.client.patch(
            f"/api/files/shares/{share['share_id']}",
            headers=self.owner_headers,
            json={"permission": "view_and_download"},
        )
        self.assertEqual(restored.status_code, 200)

        downloaded = self.client.post(
            f"/api/files/share/{share['share_token']}/download", json={}
        )
        self.assertEqual(downloaded.status_code, 200)
        self.assertEqual(downloaded.data, b"private shared document")

        own_shares = self.client.get("/api/files/my-shares", headers=self.owner_headers)
        self.assertEqual(own_shares.status_code, 200)
        self.assertEqual(len(own_shares.get_json()), 1)


if __name__ == "__main__":
    unittest.main()
