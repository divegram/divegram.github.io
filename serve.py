from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
import os

ROOT = Path(__file__).resolve().parent
ROUTES = {
    "/": "index.html",
    "/download": "download.html",
    "/developers": "developers.html",
    "/supporters": "supporters.html",
    "/faq": "faq.html",
    "/privacy": "privacy.html",
}


class SiteHandler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        route = ROUTES.get(urlsplit(path).path)
        return super().translate_path(f"/{route}" if route else path)


if __name__ == "__main__":
    assert all((ROOT / page).is_file() for page in ROUTES.values())
    os.chdir(ROOT)
    print("DiveGram: http://127.0.0.1:8000 (Ctrl+C to stop)")
    ThreadingHTTPServer(("127.0.0.1", 8000), SiteHandler).serve_forever()
