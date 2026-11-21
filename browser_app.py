"""Serve the canvas on this computer and open it in the default browser."""
from __future__ import annotations

import argparse
import json
import socket
import sys
import threading
import time
import urllib.request
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PORTS = range(8766, 8775)
LOCAL_HTTP = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def healthy(port):
    try:
        with LOCAL_HTTP.open('http://127.0.0.1:%d/api/health' % port, timeout=0.5) as response:
            return json.loads(response.read().decode('utf-8')).get('app') == 'creation-canvas'
    except Exception:
        return False


def find_service():
    for port in PORTS:
        if healthy(port):
            return 'http://127.0.0.1:%d' % port
    return None


def port_free(port):
    with socket.socket() as sock:
        sock.settimeout(0.2)
        return sock.connect_ex(('127.0.0.1', port)) != 0


def open_browser(url, port, timeout=20):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline and not healthy(port):
        time.sleep(0.2)
    webbrowser.open(url)


def main():
    parser = argparse.ArgumentParser(description='映流 · 本机浏览器版')
    parser.add_argument('--port', type=int, help='指定端口；默认在 8766–8774 自动选择')
    parser.add_argument('--no-open', action='store_true', help='不自动打开浏览器')
    args = parser.parse_args()

    if sys.version_info < (3, 10):
        print('需要 Python 3.10 或以上版本，当前为 %s。' % sys.version.split()[0])
        return 1

    if not args.port:
        running = find_service()
        if running:
            print('检测到已运行的映流服务：%s' % running)
            if not args.no_open:
                webbrowser.open(running)
            print('已直接打开现有服务，无需重复启动。')
            return 0

    sys.path.insert(0, str(ROOT))
    from server import make_server

    ports = [args.port] if args.port else [port for port in PORTS if port_free(port)]
    if not ports:
        print('8766–8774 端口都被占用，请先关闭占用程序。')
        return 1

    server = None
    for port in ports:
        try:
            server = make_server(port=port, root=ROOT)
            break
        except OSError as error:
            print('端口 %d 无法使用：%s' % (port, error))
    if server is None:
        print('画布服务未能启动。')
        return 1

    url = 'http://127.0.0.1:%d' % server.server_port
    print('映流浏览器版已启动：%s' % url)
    print('按 Ctrl+C 停止服务；关闭此窗口也会停止。')
    if not args.no_open:
        threading.Thread(target=open_browser, args=(url, server.server_port), daemon=True).start()

    server.app.start_local_engine()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\n正在停止映流服务…')
    finally:
        server.server_close()
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
