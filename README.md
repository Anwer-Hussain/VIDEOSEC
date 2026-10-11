# VIDEOSEC — Secure Video Data Encryption

A web-based upgrade of the original Tkinter **Video Encryption Decryption**
desktop app. VIDEOSEC adds user accounts, real AES-256 encryption, a
database, and a browser dashboard for managing encrypted videos.

```
VIDEOSEC/
├── legacy/     ← original Tkinter desktop app, kept for reference
├── backend/    ← Flask REST API (auth, AES encryption, SQLite, storage)
└── frontend/   ← React + Vite single-page app
```

## What changed vs. the legacy app

| Problem in legacy app                                   | Fixed in VIDEOSEC                                            |
|-----------------------------------------------------------|----------------------------------------------------------------|
| Desktop-only, Tkinter GUI                                  | Browser-based React frontend                                   |
| Local file selection only                                  | Upload via browser, stored server-side                         |
| No accounts / login                                        | Register + login with JWT sessions                             |
| No database                                                 | SQLite database for users & video metadata                     |
| "Encryption" divided pixels by random noise (not reversible) | Real AES-256-CBC encryption, fully reversible                  |
| "Decryption" just showed the video in grayscale             | Genuine decryption restores the exact original file (SHA-256 verified) |
| Output video reused a static `sample.jpg` for every frame  | N/A — real ciphertext is stored and restored byte-for-byte     |
| No key management                                            | Per-video random AES key, wrapped with a server master key (envelope encryption) |
| No cloud/object storage                                     | Local `storage/encrypted/` folder simulating object storage — swap for S3/GCS by editing `crypto_utils.py` + route file paths |

## Quick start

### 1. Backend (Flask API)

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS/Linux

pip install -r requirements.txt

# Optional but recommended: copy .env.example to .env and fill in real
# secrets, then load it (e.g. `pip install python-dotenv` and add
# `from dotenv import load_dotenv; load_dotenv()` at the top of app.py),
# or just export the variables in your shell. The app runs with safe
# dev-only defaults if you skip this.

python app.py
```

The API runs at `http://localhost:5000`. It creates `videosec.db`,
`uploads/`, and `storage/encrypted/` automatically on first run.

### 2. Frontend (React)

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The Vite dev server proxies `/api` requests
to the Flask backend, so both must be running.

### 3. Using the app

1. Register an account.
2. Go to **Encrypt Video**, choose a video file, upload it — it's
   AES-256 encrypted the instant it lands on the server.
3. Go to **My Videos** to see everything you've stored.
4. Click **Decrypt & Download** to get the exact original file back.

## How the encryption actually works

Each video gets its own random 256-bit AES key and IV, generated with
`os.urandom`. The video bytes are encrypted with AES-256-CBC. That
per-video key is then itself encrypted ("wrapped") with a single
server-side master key before being saved to the database — so the
database never holds a directly usable key. On download, the video's
wrapped key is unwrapped, the ciphertext is decrypted, and the result is
checked against a SHA-256 hash taken at upload time to catch corruption
or tampering. See `backend/crypto_utils.py` for the full implementation.

## Next steps if you want to extend this further

- Swap SQLite for PostgreSQL/MongoDB Atlas (only `database.py` needs to change).
- Swap local `storage/encrypted/` for AWS S3 / GCS (only the storage
  read/write lines in `routes/video_routes.py` need to change).
- Add a proper secrets manager for `VIDEOSEC_MASTER_KEY_HEX` instead of
  an env var.
- Add HTTPS/TLS termination (e.g. via nginx) before deploying anywhere
  public — right now this is configured for local development only.
