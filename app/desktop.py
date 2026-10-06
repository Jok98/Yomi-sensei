"""Owned loopback backend for the Electron desktop process."""
from __future__ import annotations

import json
import socket
import sys
import threading

import uvicorn

from app.main import app


def main() -> None:
    listener = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    listener.bind(("127.0.0.1", 0))
    listener.listen(128)
    server = uvicorn.Server(uvicorn.Config(app, log_level="warning", timeout_graceful_shutdown=2))

    def watch_parent() -> None:
        sys.stdin.buffer.read()
        server.should_exit = True

    threading.Thread(target=watch_parent, daemon=True).start()
    print("YOMI_BACKEND " + json.dumps({"port": listener.getsockname()[1]}), flush=True)
    try:
        server.run(sockets=[listener])
    finally:
        listener.close()


if __name__ == "__main__":
    main()
