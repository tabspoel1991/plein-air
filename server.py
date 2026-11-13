"""Kleine lokale dev server voor Plein Air (alleen Python standaardbibliotheek).

Start:  start.bat   (of: python server.py 8000)
Serveert de map als website op http://localhost:8000 en zet caching uit,
zodat elke wijziging direct zichtbaar is na verversen.
"""
import http.server
import os
import re
import sys
from functools import partial

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000


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

    # Alleen voor tools/masks.html: masks opslaan in assets/masks/ (en nergens anders).
    def do_PUT(self):
        name = self.path.split("?")[0]
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
