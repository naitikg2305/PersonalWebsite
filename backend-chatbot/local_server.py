"""Local dev server mimicking the Lambda Function URL: POST /chat {"query": "..."}.

Usage:
    CHATBOT_AWS_PROFILE=personal .venv/bin/python local_server.py
Then run the frontend with NEXT_PUBLIC_API_URL=http://localhost:8000
"""

import json
import os
from http.server import BaseHTTPRequestHandler, HTTPServer

# Never fall through to whatever AWS_PROFILE the shell has (it may be a work account).
os.environ.setdefault("CHATBOT_AWS_PROFILE", "personal")

from lambda_function import handler  # noqa: E402

PORT = int(os.environ.get("PORT", "8000"))


class Handler(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_POST(self):
        body = self.rfile.read(int(self.headers.get("Content-Length", 0))).decode("utf-8")
        result = handler({"body": body}, None)
        self.send_response(result["statusCode"])
        self._cors()
        for key, value in result["headers"].items():
            self.send_header(key, value)
        self.end_headers()
        self.wfile.write(result["body"].encode("utf-8"))


if __name__ == "__main__":
    print(f"Chatbot on http://localhost:{PORT}/chat (AWS profile: {os.environ['CHATBOT_AWS_PROFILE']})")
    HTTPServer(("", PORT), Handler).serve_forever()
