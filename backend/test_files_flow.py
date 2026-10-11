import io
import unittest
import uuid

from app import create_app
import database
from config import FILE_STORAGE_DIR, STORAGE_DIR


class EncryptedFilesFlowTestCase(unittest.TestCase):
    def setUp(self):
        self.client = create_app().test_client()
        suffix = uuid.uuid4().hex[:10]
        self.password = "FileTestPassword123!"
        response = self.client.post(
            "/api/auth/register",
            json={
                "username": f"files_{suffix}",
                "email": f"files_{suffix}@example.com",
                "password": self.password,
                "device_id": f"files_device_{suffix}",
                "device_name": "Files Flow Test",
            },
        )
        self.assertEqual(response.status_code, 201)
        result = response.get_json()
        self.user_id = result["user"]["id"]
        self.headers = {"Authorization": f"Bearer {result['token']}"}
        self.created_files = []
        self.created_videos = []

    def tearDown(self):
        for file_id, stored_filename in self.created_files:
            database.delete_encrypted_file(file_id, self.user_id)
            (FILE_STORAGE_DIR / stored_filename).unlink(missing_ok=True)
        for video_id, stored_filename in self.created_videos:
            database.delete_video(video_id, self.user_id)
            (STORAGE_DIR / stored_filename).unlink(missing_ok=True)

    def upload_file(self, filename, contents):
        response = self.client.post(
            "/api/files/upload",
            headers=self.headers,
            data={"file": (io.BytesIO(contents), filename)},
            content_type="multipart/form-data",
        )
        return response

    def test_file_round_trip_isolated_from_video_flow(self):
        original = b"%PDF-1.7\nprivate contract content\n%%EOF"
        upload = self.upload_file("private-contract.pdf", original)
        self.assertEqual(upload.status_code, 201)
        file_id = upload.get_json()["id"]
        file_record = database.get_encrypted_file(file_id, self.user_id)
        stored_path = FILE_STORAGE_DIR / file_record["stored_filename"]
        self.created_files.append((file_id, file_record["stored_filename"]))

        image_upload = self.upload_file("private-image.png", b"\x89PNG\r\nimage bytes")
        self.assertEqual(image_upload.status_code, 201)
        image_id = image_upload.get_json()["id"]
        image_record = database.get_encrypted_file(image_id, self.user_id)
        self.created_files.append((image_id, image_record["stored_filename"]))

        ciphertext = stored_path.read_bytes()
        self.assertNotEqual(ciphertext, original)
        self.assertNotIn(original, ciphertext)

        listed = self.client.get("/api/files", headers=self.headers)
        self.assertEqual(listed.status_code, 200)
        self.assertCountEqual(
            [item["id"] for item in listed.get_json()], [file_id, image_id]
        )

        wrong_password = self.client.post(
            f"/api/files/{file_id}/download",
            headers=self.headers,
            json={"password": "wrong-password"},
        )
        self.assertEqual(wrong_password.status_code, 403)

        other_suffix = uuid.uuid4().hex[:10]
        other_register = self.client.post(
            "/api/auth/register",
            json={
                "username": f"other_{other_suffix}",
                "email": f"other_{other_suffix}@example.com",
                "password": self.password,
                "device_id": f"other_device_{other_suffix}",
            },
        )
        other_headers = {
            "Authorization": f"Bearer {other_register.get_json()['token']}",
            "X-Confirm-Password": self.password,
        }
        private_file = self.client.post(
            f"/api/files/{file_id}/download", headers=other_headers
        )
        self.assertEqual(private_file.status_code, 404)

        download = self.client.post(
            f"/api/files/{file_id}/download",
            headers=self.headers,
            json={"password": self.password},
        )
        self.assertEqual(download.status_code, 200)
        self.assertEqual(download.data, original)
        self.assertIn("private-contract.pdf", download.headers["Content-Disposition"])

        unsupported_video = self.upload_file("should-stay-video.mp4", b"video bytes")
        self.assertEqual(unsupported_video.status_code, 400)

        video_upload = self.client.post(
            "/api/videos/upload",
            headers=self.headers,
            data={"file": (io.BytesIO(b"existing video flow"), "sample.mp4")},
            content_type="multipart/form-data",
        )
        self.assertEqual(video_upload.status_code, 201)
        video = database.get_video(video_upload.get_json()["id"], self.user_id)
        self.created_videos.append((video["id"], video["stored_filename"]))

        remaining_files = self.client.get("/api/files", headers=self.headers)
        self.assertCountEqual(
            [item["id"] for item in remaining_files.get_json()],
            [file_id, image_id],
        )

        deleted = self.client.delete(f"/api/files/{file_id}", headers=self.headers)
        self.assertEqual(deleted.status_code, 200)
        self.assertFalse(stored_path.exists())
        remaining_files = self.client.get("/api/files", headers=self.headers)
        self.assertEqual(
            [item["id"] for item in remaining_files.get_json()], [image_id]
        )
        self.created_files = [
            item for item in self.created_files if item[0] != file_id
        ]


if __name__ == "__main__":
    unittest.main()
