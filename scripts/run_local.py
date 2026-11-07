#!/usr/bin/env python3
"""Start a static localhost-only HTTP server for PokeFC; no backend or database."""
import http.server, pathlib, socketserver, os
os.chdir(pathlib.Path(__file__).resolve().parent.parent)
class Handler(http.server.SimpleHTTPRequestHandler):
 def end_headers(self):
  self.send_header('Cache-Control','no-store')
  super().end_headers()
with socketserver.TCPServer(('127.0.0.1',8765),Handler) as server:
 print('PokeFC: http://127.0.0.1:8765/ (Ctrl+C to stop)',flush=True)
 server.serve_forever()
