"""Fausse API Anthropic pour tester le traducteur : renvoie « [dst] texte ». Pannes simulées via MOCK_MODE."""
import json, os, sys
from http.server import BaseHTTPRequestHandler, HTTPServer
calls = {"n": 0}
MODE = os.environ.get("MOCK_MODE", "ok")  # ok | flaky | badlen | 401
class H(BaseHTTPRequestHandler):
    def do_POST(self):
        calls["n"] += 1
        body = json.loads(self.rfile.read(int(self.headers["content-length"])))
        assert self.headers["x-api-key"] == "test-key" or MODE == "401"
        def send(code, obj, extra=None):
            raw = json.dumps(obj).encode()
            self.send_response(code); self.send_header("content-type", "application/json")
            for k, v in (extra or {}).items(): self.send_header(k, v)
            self.end_headers(); self.wfile.write(raw)
        if MODE == "401":
            return send(401, {"error": {"type": "authentication_error", "message": "invalid x-api-key"}})
        if MODE == "flaky" and calls["n"] % 2 == 1:
            return send(429, {"error": {"message": "rate limited"}}, {"retry-after": "0"})
        payload = json.loads(body["messages"][0]["content"])
        assert body["tool_choice"]["name"] == "submit_translations"
        segs = payload["segments"]
        out = [f"[{payload['target_language'][:2].lower()}] {s}" for s in segs]
        if MODE == "badlen" and calls["n"] == 1:
            out = out[:-1]
        sys.stderr.write(f"mock call {calls['n']}: {len(segs)} segs, context={len(payload['context'])}\n")
        send(200, {"stop_reason": "tool_use", "content": [{"type": "tool_use", "name": "submit_translations", "input": {"translations": out}}]})
    def log_message(self, *a): pass
HTTPServer(("127.0.0.1", int(os.environ.get("MOCK_PORT", "8099"))), H).serve_forever()
