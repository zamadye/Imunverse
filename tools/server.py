#!/usr/bin/env python3
"""
server.py — Dev server Imunverse yang tenang.

Menggantikan `python -m http.server` untuk menghindari spam traceback
ConnectionResetError [Errno 104] di log — itu NOISE TIDAK BERBAHAYA:
terjadi saat browser menutup koneksi keep-alive mendadak (mis. jaringan
mobile berubah / tab ditutup). Game tidak terpengaruh; server ini
menelannya dan tetap mencatat request normal.

Jalankan dari root repo:  python3 tools/server.py  [port]
"""
import functools
import http.server
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    """Dev server: matikan cache agar iterasi JS/JSON selalu segar."""

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()


class QuietHTTPServer(http.server.ThreadingHTTPServer):
    allow_reuse_address = True

    def handle_error(self, request, client_address):
        exc = sys.exc_info()[0]
        # Klien memutus koneksi mendadak — normal di jaringan mobile, abaikan.
        if exc in (ConnectionResetError, BrokenPipeError, TimeoutError):
            return
        super().handle_error(request, client_address)


def main():
    handler = functools.partial(NoCacheHandler, directory=ROOT)
    with QuietHTTPServer(("0.0.0.0", PORT), handler) as httpd:
        print(f"Imunverse dev server: http://localhost:{PORT}  (root: {ROOT})")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
