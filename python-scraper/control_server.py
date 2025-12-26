import os
import json
import threading
import subprocess
from urllib.parse import parse_qs
from http.server import HTTPServer, SimpleHTTPRequestHandler

def resolve_shared_dir():
    env = os.environ.get('SHARED_DIR')
    if env:
        return env
    if os.path.isdir('/app') and os.access('/app', os.W_OK):
        return '/app/shared'
    return os.path.join(os.path.dirname(__file__), '.shared')

SHARED_DIR = resolve_shared_dir()
SCRAPER_PORT = int(os.environ.get('SCRAPER_PORT', '4000'))

class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        root = SHARED_DIR
        if path.startswith('/'): path = path[1:]
        return os.path.join(root, path)

    def do_GET(self):
        if self.path.startswith('/progress'):
            try:
                p = os.path.join(SHARED_DIR, 'scraper-progress.json')
                data = {}
                if os.path.exists(p):
                    with open(p, 'r') as f:
                        data = json.load(f)
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'ok': True, 'data': data}).encode('utf-8'))
                return
            except Exception:
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'ok': True, 'data': {}}).encode('utf-8'))
                return
        return super().do_GET()

    def do_POST(self):
        if self.path.startswith('/run'):
            length = int(self.headers.get('Content-Length', 0))
            raw = self.rfile.read(length).decode('utf-8') if length else ''
            try:
                data = json.loads(raw) if raw else {}
            except Exception:
                data = parse_qs(raw)
            page_limit = int(str(data.get('pageLimit', data.get('page_limit', 1))).strip('[]')) if data else 1
            base_url = (data.get('baseUrl') or data.get('base_url') or '').strip('[]') if data else ''
            env = os.environ.copy()
            if base_url: env['SCRAPER_BASE_URL'] = base_url
            env['PAGE_LIMIT'] = str(page_limit)
            progress_path = os.path.join(SHARED_DIR, 'scraper-progress.json')
            live_log_path = os.path.join(SHARED_DIR, 'scraper-live.log')
            def run_job():
                try:
                    with open(progress_path, 'w') as pf:
                        json.dump({'running': True, 'pagesTarget': page_limit, 'postsFound': 0}, pf)
                    # clear live log and write start banner
                    with open(live_log_path, 'w') as ll:
                        ll.write('=== manual run start ===\n')
                    env_run = env.copy()
                    p = subprocess.Popen(['python3', '/app/python-scraper/main.py'], env=env_run, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
                    try:
                        with open(live_log_path, 'a') as ll:
                            ll.write('--- scrape ---\n')
                    except Exception:
                        pass
                    posts_count = 0
                    for line in p.stdout:
                        try:
                            with open(live_log_path, 'a') as ll:
                                ll.write(line)
                        except Exception:
                            pass
                        try:
                            obj = json.loads(line.strip())
                            c = int(obj.get('count', 0))
                            if c:
                                posts_count = c
                                with open(progress_path, 'w') as pf:
                                    json.dump({'running': True, 'pagesTarget': page_limit, 'postsFound': posts_count}, pf)
                        except Exception:
                            pass
                    p.wait()
                    with open(progress_path, 'w') as pf:
                        json.dump({'running': False, 'pagesTarget': page_limit, 'postsFound': posts_count}, pf)
                    try:
                        with open(live_log_path, 'a') as ll:
                            ll.write('=== manual run complete ===\n')
                    except Exception:
                        pass
                except Exception:
                    try:
                        with open(progress_path, 'w') as pf:
                            json.dump({'running': False, 'error': True}, pf)
                    except Exception:
                        pass
                    try:
                        with open(live_log_path, 'a') as ll:
                            ll.write('!!! manual run error !!!\n')
                    except Exception:
                        pass
            threading.Thread(target=run_job, daemon=True).start()
            self.send_response(202)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'accepted': True}).encode('utf-8'))
            return
        if self.path.startswith('/config'):
            length = int(self.headers.get('Content-Length', 0))
            raw = self.rfile.read(length).decode('utf-8') if length else ''
            try:
                data = json.loads(raw) if raw else {}
            except Exception:
                data = parse_qs(raw)
            base_url = (data.get('baseUrl') or data.get('base_url') or '').strip('[]') if data else ''
            interval = int(str(data.get('intervalSeconds', data.get('interval_seconds', 0))).strip('[]')) if data else 0
            cfg = {}
            if base_url: cfg['SCRAPER_BASE_URL'] = base_url
            if interval: cfg['DAILY_INTERVAL_SECONDS'] = interval
            try:
                with open(os.path.join(SHARED_DIR, 'scraper-config.json'), 'w') as f:
                    json.dump(cfg, f)
            except Exception:
                pass
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'updated': True, 'config': cfg}).encode('utf-8'))
            return
        if self.path.startswith('/progress'):
            try:
                p = os.path.join(SHARED_DIR, 'scraper-progress.json')
                data = {}
                if os.path.exists(p):
                    with open(p, 'r') as f:
                        data = json.load(f)
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'ok': True, 'data': data}).encode('utf-8'))
                return
            except Exception:
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'ok': True, 'data': {}}).encode('utf-8'))
                return
        self.send_response(404)
        self.end_headers()

def main():
    os.makedirs(SHARED_DIR, exist_ok=True)
    server = HTTPServer(('', SCRAPER_PORT), Handler)
    server.serve_forever()

if __name__ == '__main__':
    main()
