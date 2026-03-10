#!/usr/bin/env python3
"""Start a local server on the first available port. Usage: python3 serve.py [directory]"""
import os
import socket
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler

if len(sys.argv) > 1:
    os.chdir(sys.argv[1])

def find_free_port(start=8000, end=9000):
    for port in range(start, end):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(("", port))
                return port
        except OSError:
            continue
    return None

port = find_free_port()
if port is None:
    print("No free port found between 8000-9000")
    exit(1)

server = HTTPServer(("", port), SimpleHTTPRequestHandler)
print(f"Open in browser: http://localhost:{port}")
print("Press Ctrl+C to stop\n")
server.serve_forever()
