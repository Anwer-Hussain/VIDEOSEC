"""
VIDEOSEC backend entrypoint.

Run with:  python app.py
Serves the API on http://localhost:5000
"""

from flask import Flask, jsonify

import database
from routes.auth_routes import auth_bp
from routes.file_routes import file_bp
from routes.video_routes import video_bp


def create_app():
    app = Flask(__name__)
    app.config["MAX_CONTENT_LENGTH"] = 500 * 1024 * 1024  # hard cap, see config.py too

    database.init_db()

    app.register_blueprint(auth_bp)
    app.register_blueprint(video_bp)
    app.register_blueprint(file_bp)

    # --- minimal hand-rolled CORS so the Vite dev server (port 5173) can
    # talk to the API without needing the flask-cors package ---
    @app.after_request
    def add_cors_headers(response):
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Device-Id, X-Device-Name"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, DELETE, OPTIONS"
        return response

    @app.route("/api", methods=["OPTIONS"])
    @app.route("/api/<path:_any>", methods=["OPTIONS"])
    def cors_preflight(_any=""):
        return "", 204

    @app.get("/api/health")
    def health():
        return jsonify({"status": "ok", "service": "VIDEOSEC backend"})

    @app.errorhandler(413)
    def too_large(_e):
        return jsonify({"error": "Uploaded file is too large"}), 413

    return app


app = create_app()

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)


