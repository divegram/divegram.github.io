"""Локальный сервер для разработки: python serve.py -> http://127.0.0.1:8000
Отдаёт только файлы сайта (не отдаёт .git, serve.py, _headers и другие служебные файлы)."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit
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
PUBLIC_DIRS = {"css", "js", "img", "fonts", "models", ".well-known"}
PUBLIC_FILES = set(ROUTES.values()) | {"robots.txt", "sitemap.xml"}

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
}


def is_public(rel: str) -> bool:
    parts = Path(unquote(rel).lstrip("/")).parts
    if not parts or ".." in parts:
        return False
    return parts[0] in PUBLIC_DIRS or (len(parts) == 1 and parts[0] in PUBLIC_FILES)


class SiteHandler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        clean = urlsplit(path).path
        route = ROUTES.get(clean)
        if route:
            return str(ROOT / route)
        if not is_public(clean):
            return str(ROOT / "__not_found__")
        return super().translate_path(path)

    def list_directory(self, path):
        self.send_error(404, "Not found")  # листинг папок отключён

    def end_headers(self):
        for key, value in SECURITY_HEADERS.items():
            self.send_header(key, value)
        super().end_headers()


if __name__ == "__main__":
    assert all((ROOT / page).is_file() for page in ROUTES.values())
    os.chdir(ROOT)
    print("DiveGram: http://127.0.0.1:8000 (Ctrl+C to stop)")
    ThreadingHTTPServer(("127.0.0.1", 8000), SiteHandler).serve_forever()
