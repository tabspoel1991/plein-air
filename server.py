"""Kleine lokale dev server voor Plein Air (alleen Python standaardbibliotheek).

Start:  start.bat   (of: python server.py 8000)
Serveert de map als website op http://localhost:8000 en zet caching uit,
zodat elke wijziging direct zichtbaar is na verversen.
"""
import http.server
import json
import os
import re
import shutil
import subprocess
import sys
import threading
import urllib.parse
from functools import partial

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
FILM = os.path.join(ROOT, "film")

# Film renderen (zie js/demo/demo.js en tools/render_film.py): de browser stuurt elk frame als
# ruwe RGBA-bytes; die gaan direct naar ffmpeg (geen tussenbestanden: bij 4K zou dat ~60 GB zijn).
RENDER = {"proc": None, "out": None, "frames": 0, "total": 0, "state": "idle", "error": ""}
LOCK = threading.Lock()


def ffmpeg_path():
    return shutil.which("ffmpeg") or os.path.expandvars(r"%LOCALAPPDATA%\Microsoft\WinGet\Linksfmpeg.exe")


class Handler(http.server.SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"  # verbindingen hergebruiken: minder kans op afgebroken downloads
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".glsl": "text/plain",
        ".json": "application/json",
    }

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def reply(self, code, body, ctype="text/plain"):
        data = body.encode() if isinstance(body, str) else body
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path.split("?")[0] == "/render/status":
            st = {k: v for k, v in RENDER.items() if k != "proc"}
            return self.reply(200, json.dumps(st), "application/json")
        return super().do_GET()

    def do_POST(self):
        path, _, query = self.path.partition("?")
        q = {k: v[0] for k, v in urllib.parse.parse_qs(query).items()}
        length = int(self.headers.get("Content-Length", 0) or 0)
        if length:
            self.rfile.read(length)
        with LOCK:
            if path == "/render/start":
                try:
                    w, h, fps = int(q["w"]), int(q["h"]), int(q.get("fps", 30))
                    name = q.get("name", "concept")
                    assert 16 <= w <= 7680 and 16 <= h <= 4320 and 1 <= fps <= 60
                    assert re.fullmatch(r"[a-z0-9x_-]{1,20}", name)
                except Exception:
                    return self.reply(400, "ongeldige parameters")
                if RENDER["proc"]:
                    RENDER["proc"].kill()
                os.makedirs(FILM, exist_ok=True)
                out = os.path.join(FILM, "_master-" + name + ".mp4")
                crf = "12" if w >= 3000 else "14"
                cmd = [ffmpeg_path(), "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgba",
                       "-s", f"{w}x{h}", "-r", str(fps), "-i", "-",
                       "-c:v", "libx264", "-preset", "fast", "-crf", crf, "-pix_fmt", "yuv420p", out]
                RENDER.update(proc=subprocess.Popen(cmd, stdin=subprocess.PIPE), out=out, frames=0,
                              total=int(q.get("total", 0)), state="rendering", error="", size=w * h * 4)
                return self.reply(200, "ok")
            if path == "/render/end":
                p = RENDER["proc"]
                if not p:
                    return self.reply(409, "geen render bezig")
                p.stdin.close()
                code = p.wait()
                RENDER.update(proc=None, state="done" if code == 0 else "error",
                              error="" if code == 0 else f"ffmpeg stopte met code {code}")
                return self.reply(200 if code == 0 else 500, RENDER["state"])
        self.send_error(404)

    # PUT /render/frame: één filmframe. Verder alleen voor tools/masks.html: masks opslaan in assets/masks/.
    def do_PUT(self):
        name = self.path.split("?")[0]
        if name == "/render/frame":
            length = int(self.headers.get("Content-Length", 0) or 0)
            with LOCK:
                p = RENDER["proc"]
                if not p or length != RENDER.get("size"):
                    if length:
                        self.rfile.read(length)
                    return self.reply(409, "geen render bezig of verkeerde framegrootte")
                remaining = length
                try:
                    while remaining:
                        chunk = self.rfile.read(min(remaining, 1 << 22))
                        if not chunk:
                            break
                        p.stdin.write(chunk)
                        remaining -= len(chunk)
                except (BrokenPipeError, OSError) as e:
                    RENDER.update(state="error", error="ffmpeg: " + str(e))
                    return self.reply(500, "ffmpeg fout")
                RENDER["frames"] += 1
            return self.reply(200, "ok")
        if not re.fullmatch(r"/assets/masks/[a-z0-9_-]+\.(png|json)", name):
            self.send_error(403, "Alleen assets/masks/*.png of *.json")
            return
        length = int(self.headers.get("Content-Length", 0))
        if length <= 0 or length > 20_000_000:
            self.send_error(413, "Te groot of leeg")
            return
        data = self.rfile.read(length)
        target = os.path.join(ROOT, "assets", "masks", os.path.basename(name))
        os.makedirs(os.path.dirname(target), exist_ok=True)
        with open(target, "wb") as f:
            f.write(data)
        body = b"ok"
        self.send_response(200)
        self.send_header("Content-Type", "text/plain")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        pass  # stil houden


class Server(http.server.ThreadingHTTPServer):
    request_queue_size = 128  # de browser vraagt ~20 bestanden tegelijk; standaard (5) gaf weigeringen
    daemon_threads = True


if __name__ == "__main__":
    server = Server(("127.0.0.1", PORT), partial(Handler, directory=ROOT))
    print(f"Plein Air draait op http://localhost:{PORT}/  (Ctrl+C om te stoppen)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
