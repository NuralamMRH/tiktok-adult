import os
import re
import json
import time
import sys
from urllib.parse import urljoin, urlparse

BASE_URL = os.environ.get('SCRAPER_BASE_URL', 'https://mmsbaba.com')
PAGE_LIMIT = int(os.environ.get('PAGE_LIMIT', '2'))
try:
    MAX_POSTS = int(os.environ.get('MAX_POSTS', '0') or '0')
except Exception:
    MAX_POSTS = 0
SAVE_DEBUG = os.environ.get('SAVE_DEBUG_HTML', '0') == '1'
OUTPUT_DIR = os.path.dirname(__file__)
USE_SELENIUM = os.environ.get('USE_SELENIUM', '0') == '1'
PAGE1_PATH = os.environ.get('PAGE1_PATH', '/')
PAGEN_TEMPLATE = os.environ.get('PAGEN_TEMPLATE', '/page/{page}/')
PAGINATION_MODE = (os.environ.get('PAGINATION_MODE') or '').strip().lower()
AJAX_PAGINATION_SELECTOR = os.environ.get(
    'AJAX_PAGINATION_SELECTOR',
    'a[data-action="ajax"][data-block-id][data-parameters]',
)
AJAX_PAGINATION_NEXT_SELECTOR = os.environ.get(
    'AJAX_PAGINATION_NEXT_SELECTOR',
    'a.next[data-action="ajax"][data-block-id][data-parameters]',
)
LIST_ENTRY_SELECTOR = os.environ.get('LIST_ENTRY_SELECTOR', 'div.videos a.video')
LIST_TITLE_SELECTOR = os.environ.get('LIST_TITLE_SELECTOR', 'h2.vtitle')
DETAILS_VIDEO_SELECTOR = os.environ.get(
    'DETAILS_VIDEO_SELECTOR',
    'div.box #video-container div.art-video-player video.art-video[preload="metadata"]',
)
DETAILS_TAGS_SELECTOR = os.environ.get(
    'DETAILS_TAGS_SELECTOR',
    'main#primary.site-main article div.scontent div.slinks a',
)
META_DESCRIPTION_SELECTOR = os.environ.get('META_DESCRIPTION_SELECTOR', 'meta[name="description"]')
OG_TITLE_SELECTOR = os.environ.get('OG_TITLE_SELECTOR', 'meta[property="og:title"]')
OG_DESCRIPTION_SELECTOR = os.environ.get('OG_DESCRIPTION_SELECTOR', 'meta[property="og:description"]')
SELENIUM_WAIT_SELECTOR = os.environ.get('SELENIUM_WAIT_SELECTOR', '')
PROGRESS_FILE = (os.environ.get('SCRAPER_PROGRESS_FILE') or '').strip()
PROGRESS_RUN_ID = (os.environ.get('SCRAPER_RUN_ID') or '').strip()
PROGRESS_TARGET_INDEX = (os.environ.get('SCRAPER_TARGET_INDEX') or '').strip()

_base_host = re.sub(r'^https?://', '', BASE_URL).split('/')[0].lower()
IS_MMSBABA = 'mmsbaba.com' in _base_host

def delay(ms):
    time.sleep(ms / 1000.0)

def clean_text(s):
    if not s:
        return ''
    if IS_MMSBABA:
        s = re.sub(r"\s*–?\s*MmsBaba\.Com\s*$", '', s, flags=re.I)
        s = re.sub(r"mmsbaba\.com", '', s, flags=re.I)
    s = s.replace('\u2018', '').replace('\u2019', '').replace('\u201C', '').replace('\u201D', '')
    return s.strip()

def write_external_progress(patch):
    if not PROGRESS_FILE:
        return
    try:
        data = {}
        try:
            if os.path.exists(PROGRESS_FILE):
                with open(PROGRESS_FILE, 'r', encoding='utf-8') as f:
                    data = json.load(f)
        except Exception:
            data = {}
        if not isinstance(data, dict):
            data = {}
        if PROGRESS_RUN_ID:
            data.setdefault('runId', PROGRESS_RUN_ID)
        if PROGRESS_TARGET_INDEX.isdigit():
            data.setdefault('targetIndex', int(PROGRESS_TARGET_INDEX))
        data.update(patch or {})
        with open(PROGRESS_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception:
        pass

def build_page_url(page):
    base = (BASE_URL or '').rstrip('/')
    if page <= 1:
        path = PAGE1_PATH or '/'
        if not path.startswith('/'):
            path = '/' + path
        return base + path
    tmpl = PAGEN_TEMPLATE or '/page/{page}/'
    if not tmpl.startswith('/'):
        tmpl = '/' + tmpl
    path = tmpl.replace('{page}', str(int(page)))
    return base + path

def parse_kvs_data_parameters(s):
    raw = str(s or '').strip()
    if not raw:
        return {}
    raw = raw.strip('`').strip()
    if (raw.startswith('"') and raw.endswith('"')) or (raw.startswith("'") and raw.endswith("'")):
        raw = raw[1:-1].strip()
    out = {}
    for part in raw.split(';'):
        part = part.strip()
        if not part:
            continue
        if ':' not in part:
            continue
        k, v = part.split(':', 1)
        k = str(k or '').strip()
        v = str(v or '').strip()
        if not k:
            continue
        out[k] = v
    return out

def build_kvs_ajax_url(listing_page_url, block_id, data_parameters):
    from urllib.parse import urlencode

    if not listing_page_url:
        return None
    block = str(block_id or '').strip()
    if not block:
        return None
    qp = {'mode': 'async', 'function': 'get_block', 'block_id': block}
    qp.update(parse_kvs_data_parameters(data_parameters))
    base = str(listing_page_url).split('#', 1)[0]
    if '?' in base:
        base = base.split('?', 1)[0]
    return f'{base}?{urlencode(qp, doseq=True)}'

def extract_kvs_ajax_next(html):
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html or '', 'lxml')
    a = soup.select_one(AJAX_PAGINATION_NEXT_SELECTOR) if AJAX_PAGINATION_NEXT_SELECTOR else None
    if not a and AJAX_PAGINATION_SELECTOR:
        candidates = soup.select(AJAX_PAGINATION_SELECTOR) or []
        for c in candidates:
            cls = c.get('class') or []
            if isinstance(cls, str):
                cls = [cls]
            if 'next' in cls:
                a = c
                break
    if not a:
        return None
    block_id = a.get('data-block-id') or ''
    params = a.get('data-parameters') or ''
    if not block_id or not params:
        return None
    return {'block_id': block_id, 'data_parameters': params}

def make_scraper():
    import importlib
    cloudscraper = importlib.import_module('cloudscraper')
    scraper = cloudscraper.create_scraper(browser={'browser': 'chrome', 'platform': 'windows', 'mobile': False})
    scraper.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
    })
    return scraper

def looks_like_blocked_html(html):
    t = (html or '').lower()
    if not t:
        return False
    if '<title>just a moment' in t:
        return True
    if 'cf-browser-verification' in t or 'cf-chl-' in t or 'challenge-platform' in t:
        return True
    if 'cloudflare' in t and ('attention required' in t or 'verify you are human' in t):
        return True
    return False

def fetch_html_selenium(url, wait_css=None):
    import importlib
    try:
        import ssl
        certifi = importlib.import_module('certifi')

        ssl._create_default_https_context = lambda: ssl.create_default_context(cafile=certifi.where())
    except Exception:
        pass
    By = importlib.import_module('selenium.webdriver.common.by').By
    WebDriverWait = importlib.import_module('selenium.webdriver.support.ui').WebDriverWait

    def resolve_first_existing(paths):
        for p in paths:
            try:
                if p and os.path.exists(p):
                    return p
            except Exception:
                continue
        return None

    chrome_bin = resolve_first_existing(
        [
            os.environ.get('CHROME_BIN'),
            '/usr/bin/chromium',
            '/usr/bin/chromium-browser',
            '/usr/bin/google-chrome',
            '/usr/bin/google-chrome-stable',
        ]
    )
    chromedriver_bin = resolve_first_existing(
        [
            os.environ.get('CHROMEDRIVER_BIN'),
            '/usr/bin/chromedriver',
            '/usr/local/bin/chromedriver',
            '/usr/lib/chromium/chromedriver',
        ]
    )

    driver = None
    try:
        webdriver = importlib.import_module('selenium.webdriver')
        ChromeOptions = importlib.import_module('selenium.webdriver.chrome.options').Options
        Service = importlib.import_module('selenium.webdriver.chrome.service').Service

        options = ChromeOptions()
        if chrome_bin:
            try:
                options.binary_location = chrome_bin
            except Exception:
                pass
        options.add_argument('--headless=new')
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        options.add_argument('--disable-gpu')
        options.add_argument('--disable-blink-features=AutomationControlled')
        options.add_argument('--ignore-certificate-errors')
        options.add_argument('--window-size=1920,1080')

        service = Service(executable_path=chromedriver_bin) if chromedriver_bin else Service()
        driver = webdriver.Chrome(service=service, options=options)
    except Exception:
        uc = importlib.import_module('undetected_chromedriver')
        options = uc.ChromeOptions()
        options.add_argument('--headless=new')
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        options.add_argument('--disable-gpu')
        options.add_argument('--disable-blink-features=AutomationControlled')
        options.add_argument('--ignore-certificate-errors')
        options.add_argument('--window-size=1920,1080')
        if chrome_bin:
            try:
                options.binary_location = chrome_bin
            except Exception:
                pass
        driver = uc.Chrome(options=options)
    try:
        driver.get(url)
        if wait_css:
            try:
                WebDriverWait(driver, 20).until(lambda d: d.find_elements(By.CSS_SELECTOR, wait_css))
            except Exception:
                pass
        html = driver.page_source or ''
        if html and not looks_like_blocked_html(html):
            return html
        return None
    finally:
        try:
            driver.quit()
        except Exception:
            pass

def fetch_html(scraper, url, referer=None, wait_css=None, *, allow_blocked_html=False):
    last_html = None
    last_status = None
    if USE_SELENIUM and url:
        try:
            html = fetch_html_selenium(url, wait_css=wait_css or SELENIUM_WAIT_SELECTOR or None)
            if html:
                return html
        except Exception:
            pass
    for attempt in range(1, 4):
        try:
            headers = {}
            if referer:
                headers['Referer'] = referer
            res = scraper.get(url, headers=headers, timeout=30)
            last_status = res.status_code
            if res.status_code == 200:
                txt = res.text
                if txt and not looks_like_blocked_html(txt):
                    return txt
                last_html = txt
        except Exception:
            pass
        delay(800 * attempt + 1200)
    auto_selenium = str(os.environ.get('AUTO_SELENIUM_FALLBACK', '') or '').strip().lower()
    if url and not USE_SELENIUM:
        enable_auto = False
        if auto_selenium in ('1', 'true', 'yes', 'on'):
            enable_auto = True
        elif auto_selenium in ('0', 'false', 'no', 'off'):
            enable_auto = False
        else:
            enable_auto = os.path.exists('/.dockerenv')
        if enable_auto:
            try:
                html = fetch_html_selenium(url, wait_css=wait_css or SELENIUM_WAIT_SELECTOR or None)
                if html:
                    return html
            except Exception:
                pass
    if last_html and last_status == 200:
        if allow_blocked_html:
            return last_html
        if not looks_like_blocked_html(last_html):
            return last_html
        return None
    return None

def save_debug_html(url, html):
    if not SAVE_DEBUG or not html:
        return
    try:
        path_dir = os.path.join(OUTPUT_DIR, 'debug-pages')
        os.makedirs(path_dir, exist_ok=True)
        name = re.sub(r'^https?://', '', url).rstrip('/')
        name = name.replace('/', '__')
        path = os.path.join(path_dir, f'{name}.html')
        with open(path, 'w', encoding='utf-8') as f:
            f.write(html)
    except Exception:
        pass

def remove_debug_pages():
    import shutil
    path_dir = os.path.join(OUTPUT_DIR, 'debug-pages')
    try:
        if os.path.exists(path_dir):
            shutil.rmtree(path_dir)
    except Exception:
        pass

def parse_listing(html):
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html, 'lxml')
    items = []
    for el in soup.select(LIST_ENTRY_SELECTOR):
        a = el if getattr(el, 'name', '') == 'a' else (el.select_one('a[href]') if el else None)
        if not a:
            continue
        href = a.get('href')
        style = a.get('style') or ''
        m = re.search(r"background-image:\s*url\(['\"]?(.*?)['\"]?\)", style, flags=re.I)
        image_url = m.group(1) if m else None
        title_attr = a.get('title') or ''
        title_node = None
        if LIST_TITLE_SELECTOR:
            try:
                title_node = el.select_one(LIST_TITLE_SELECTOR) or a.select_one(LIST_TITLE_SELECTOR)
            except Exception:
                title_node = None
        title_text = title_node.get_text(strip=True) if title_node else ''
        title = clean_text(title_attr or title_text or '')
        if not image_url:
            try:
                img = el.select_one('img') or a.select_one('img')
                if img:
                    image_url = img.get('src') or img.get('data-src') or img.get('data-original')
            except Exception:
                pass
        link = None
        if href:
            if href.startswith('http'):
                link = href
            elif href.startswith('//'):
                scheme = (urlparse(BASE_URL).scheme or 'https').strip(':')
                link = f'{scheme}:{href}'
            else:
                link = urljoin(BASE_URL, href)
        if image_url:
            if image_url.startswith('http'):
                pass
            elif image_url.startswith('//'):
                scheme = (urlparse(BASE_URL).scheme or 'https').strip(':')
                image_url = f'{scheme}:{image_url}'
            else:
                image_url = urljoin(BASE_URL, image_url)
        if link:
            items.append({'title': title or 'No Title', 'link': link, 'image_url': image_url})
    return items

def normalize_media_url(src):
    s = str(src or '').strip()
    if not s:
        return None
    if s.startswith('data:') or s.startswith('blob:'):
        return None
    if s.startswith('//'):
        scheme = (urlparse(BASE_URL).scheme or 'https').strip(':')
        return f'{scheme}:{s}'
    if s.startswith('http://') or s.startswith('https://'):
        out = s
    else:
        out = urljoin(BASE_URL, s)
    if out.lower().endswith(('.mp4/', '.mov/', '.m3u8/')):
        out = out[:-1]
    return out

def first_media_url_from_text(html):
    t = html or ''
    if not t:
        return None
    pats = [
        r'(https?://[^\s"\'<>]+?\.(?:mp4|mov|m3u8)(?:/)?(?:\?[^\s"\'<>]*)?)',
        r'(//[^\s"\'<>]+?\.(?:mp4|mov|m3u8)(?:/)?(?:\?[^\s"\'<>]*)?)',
    ]
    for pat in pats:
        m = re.search(pat, t, flags=re.I)
        if m:
            return normalize_media_url(m.group(1))
    return None

def media_urls_from_text(html, *, limit=80):
    t = html or ''
    if not t:
        return []
    pats = [
        r'(https?://[^\s"\'<>]+?\.(?:mp4|mov|m3u8)(?:/)?(?:\?[^\s"\'<>]*)?)',
        r'(//[^\s"\'<>]+?\.(?:mp4|mov|m3u8)(?:/)?(?:\?[^\s"\'<>]*)?)',
    ]
    out = []
    seen = set()
    for pat in pats:
        for m in re.finditer(pat, t, flags=re.I):
            u = normalize_media_url(m.group(1))
            if not u or u in seen:
                continue
            seen.add(u)
            out.append(u)
            if len(out) >= limit:
                return out
    return out

def extract_video_url_from_soup(soup, html=None):
    candidates = {}

    def score_media_url(u):
        s = str(u or '').strip().lower()
        if not s:
            return -10_000
        score = 0
        if '/get_file/' in s:
            score += 250
            m = re.search(r'/get_file/(\d+)/', s)
            if m:
                try:
                    score += max(0, min(9, int(m.group(1)))) * 20
                except Exception:
                    pass
        if '.m3u8' in s:
            score += 40
        if '.mp4' in s:
            score += 25
        if 'preview.mp4' in s:
            score -= 300
        if 'videos_screenshots' in s or 'screenshots' in s:
            score -= 250
        if '/preview' in s:
            score -= 120
        if 'thumb' in s or 'sprite' in s or 'poster' in s:
            score -= 120
        if 'preview' in s:
            score -= 60
        return score

    def consider(val):
        u = normalize_media_url(val)
        if not u:
            return
        prev = candidates.get(u)
        sc = score_media_url(u)
        if prev is None or sc > prev:
            candidates[u] = sc

    try:
        if DETAILS_VIDEO_SELECTOR:
            v = soup.select_one(DETAILS_VIDEO_SELECTOR)
            if v:
                primary_src = (
                    v.get('src')
                    or v.get('data-src')
                    or v.get('data-lazy-src')
                    or v.get('data-original')
                    or v.get('data-url')
                )
                primary_norm = normalize_media_url(primary_src)
                if primary_norm and '/get_file/' in primary_norm.lower():
                    return primary_norm
                consider(primary_src)
                for s in v.select('source'):
                    consider(s.get('src') or s.get('data-src') or s.get('data-lazy-src'))
    except Exception:
        pass

    for v in soup.select('video'):
        v_src = (
            v.get('src')
            or v.get('data-src')
            or v.get('data-lazy-src')
            or v.get('data-original')
            or v.get('data-url')
            or v.get('data-mp4')
            or v.get('data-video')
        )
        v_norm = normalize_media_url(v_src)
        if v_norm and '/get_file/' in v_norm.lower():
            return v_norm
        consider(v_src)
        for s in v.select('source'):
            consider(s.get('src') or s.get('data-src') or s.get('data-lazy-src'))

    if not candidates:
        try:
            for sc in soup.select('script[type="application/ld+json"]'):
                raw = sc.get_text(strip=True) or ''
                if not raw:
                    continue
                try:
                    obj = json.loads(raw)
                except Exception:
                    continue
                stack = [obj]
                while stack:
                    cur = stack.pop()
                    if isinstance(cur, dict):
                        for k in ('contentUrl', 'embedUrl', 'url'):
                            val = cur.get(k)
                            if isinstance(val, str) and ('.mp4' in val or '.mov' in val or '.m3u8' in val):
                                consider(val)
                                break
                        if candidates:
                            break
                        for vv in cur.values():
                            if isinstance(vv, (dict, list)):
                                stack.append(vv)
                    elif isinstance(cur, list):
                        stack.extend(cur)
                if candidates:
                    break
        except Exception:
            pass

    try:
        for u in media_urls_from_text(html or ''):
            consider(u)
    except Exception:
        pass

    if candidates:
        best = sorted(candidates.items(), key=lambda kv: (kv[1], len(kv[0])), reverse=True)[0][0]
        return best
    return first_media_url_from_text(html or '')

def extract_tags_texts_from_soup(soup):
    out = []

    def add(txt):
        t = clean_text(txt)
        if not t:
            return
        if t not in out:
            out.append(t)

    try:
        links = soup.select(DETAILS_TAGS_SELECTOR) if DETAILS_TAGS_SELECTOR else []
        for a in links:
            add(a.get_text(strip=True) or '')
    except Exception:
        pass

    if not out:
        try:
            for a in soup.select('a[rel~="tag"], a[href*="/tag/"]'):
                add(a.get_text(strip=True) or '')
        except Exception:
            pass

    return out

def parse_post(html, post_url, post_title, listing_image):
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html, 'lxml')
    title_tag = soup.select_one('head title')
    meta_desc_tag = soup.select_one(META_DESCRIPTION_SELECTOR) if META_DESCRIPTION_SELECTOR else None
    og_title_tag = soup.select_one(OG_TITLE_SELECTOR) if OG_TITLE_SELECTOR else None
    og_desc_tag = soup.select_one(OG_DESCRIPTION_SELECTOR) if OG_DESCRIPTION_SELECTOR else None
    title_tag_text = title_tag.get_text(strip=True) if title_tag else ''
    meta_desc = meta_desc_tag.get('content') if meta_desc_tag else ''
    og_title = og_title_tag.get('content') if og_title_tag else ''
    og_desc = og_desc_tag.get('content') if og_desc_tag else ''
    video_url = extract_video_url_from_soup(soup, html=html)
    image_url = listing_image
    if not image_url:
        img = soup.select_one('img')
        if img:
            src = img.get('src') or img.get('data-src')
            if src:
                image_url = src if src.startswith('http') else urljoin(BASE_URL, src)
    return {
        'title': clean_text(post_title),
        'title_raw': post_title or '',
        'link': post_url,
        'video_url': video_url,
        'image_url': image_url,
        'meta_description': clean_text(meta_desc),
        'og_title': clean_text(og_title or title_tag_text),
        'og_description': clean_text(og_desc or meta_desc),
    }

def scrape_tags(scraper):
    url = urljoin(BASE_URL, '/tags/')
    html = fetch_html(scraper, url, BASE_URL)
    if not html:
        return []
    save_debug_html(url, html)
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html, 'lxml')
    out = []
    for a in soup.select('.tag-list a'):
        href = a.get('href')
        num = a.select_one('span.num')
        count = 0
        if num:
            try:
                count = int(num.get_text(strip=True))
            except Exception:
                count = 0
        text = a.get_text(strip=True)
        if num:
            text = text.replace(num.get_text(strip=True), '')
        name = clean_text(text)
        if href:
            out.append({'name': name, 'count': count, 'url': href})
    return out

def read_existing():
    path = os.path.join(OUTPUT_DIR, 'enhanced-extract-results.json')
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            if isinstance(data, list):
                return {'posts': data, 'tags': []}
            return {'posts': data.get('posts', []), 'tags': data.get('tags', [])}
    except Exception:
        return {'posts': [], 'tags': []}

def write_results(posts, tags, extra_summary=None):
    with open(os.path.join(OUTPUT_DIR, 'enhanced-extract-results.json'), 'w', encoding='utf-8') as f:
        json.dump({'posts': posts, 'tags': tags}, f, ensure_ascii=False, indent=2)
    summary = {
        'total_posts': len(posts),
        'new_posts': len([p for p in posts if p.get('new_run_flag')]),
        'posts_with_videos': len([p for p in posts if p.get('video_url') or p.get('video_src')]),
        'posts_with_images': len([p for p in posts if p.get('image_url')]),
        'errors': len([p for p in posts if p.get('error')]),
    }
    if isinstance(extra_summary, dict):
        summary.update(extra_summary)
    with open(os.path.join(OUTPUT_DIR, 'scraping-summary.json'), 'w', encoding='utf-8') as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)
    try:
        root_dir = os.path.abspath(os.path.join(OUTPUT_DIR, '..'))
        with open(os.path.join(root_dir, 'scraping-summary.json'), 'w', encoding='utf-8') as f2:
            json.dump(summary, f2, ensure_ascii=False, indent=2)
    except Exception:
        pass
    try:
        shared_dir = os.environ.get('SHARED_DIR', '/app/shared')
        os.makedirs(shared_dir, exist_ok=True)
        with open(os.path.join(shared_dir, 'scraping-summary.json'), 'w', encoding='utf-8') as f3:
            json.dump(summary, f3, ensure_ascii=False, indent=2)
    except Exception:
        pass

def scrape():
    scraper = make_scraper()
    existing = read_existing()
    existing_posts = existing.get('posts') or []
    existing_tags = existing.get('tags') or []
    page_order = str(os.environ.get('SCRAPE_PAGE_ORDER') or '').strip().lower()
    is_desc = page_order in ('desc', 'reverse', 'last-to-first', 'last_to_first')
    base_host = urlparse(BASE_URL).netloc.lower()
    if base_host.startswith('www.'):
        base_host = base_host[4:]
    filtered_existing_posts = []
    for p in existing_posts:
        if not isinstance(p, dict):
            continue
        link = p.get('link')
        if not link:
            continue
        try:
            h = urlparse(str(link)).netloc.lower()
        except Exception:
            h = ''
        if h.startswith('www.'):
            h = h[4:]
        if not h or base_host not in h:
            continue
        if p.get('new_run_flag'):
            p['new_run_flag'] = False
        filtered_existing_posts.append(p)
    existing_links = set([p['link'] for p in filtered_existing_posts if p.get('link')])
    new_results = []
    start_page = 1
    start_page_env = str(os.environ.get('SCRAPE_START_PAGE', '') or '').strip()
    if start_page_env.isdigit():
        start_page = max(1, int(start_page_env))
    else:
        try:
            summ_path = os.path.join(OUTPUT_DIR, 'scraping-summary.json')
            if os.path.exists(summ_path):
                with open(summ_path, 'r', encoding='utf-8') as sf:
                    summ = json.load(sf) or {}
                last_page = summ.get('last_page')
                if last_page is None:
                    last_page = summ.get('lastPage')
                prior_limit = summ.get('page_limit')
                if prior_limit is None:
                    prior_limit = summ.get('pageLimit')
                try:
                    prior_limit = int(prior_limit) if str(prior_limit).strip() != '' else None
                except Exception:
                    prior_limit = None
                try:
                    last_page = int(last_page) if str(last_page).strip() != '' else None
                except Exception:
                    last_page = None
                if prior_limit == int(PAGE_LIMIT) and last_page and 1 <= last_page <= int(PAGE_LIMIT):
                    start_page = last_page
        except Exception:
            pass
    if is_desc and start_page == 1 and not start_page_env.isdigit():
        start_page = int(PAGE_LIMIT)
    pages_processed = max(0, (int(PAGE_LIMIT) - start_page) if is_desc else (start_page - 1))
    auto_selenium_on_empty = str(os.environ.get('AUTO_SELENIUM_ON_EMPTY', '') or '').strip().lower()
    if auto_selenium_on_empty in ('1', 'true', 'yes', 'on'):
        enable_auto_selenium_on_empty = True
    elif auto_selenium_on_empty in ('0', 'false', 'no', 'off'):
        enable_auto_selenium_on_empty = False
    else:
        enable_auto_selenium_on_empty = os.path.exists('/.dockerenv')
    write_external_progress(
        {
            'running': True,
            'phase': 'scrape',
            'baseUrl': BASE_URL,
            'pageLimit': PAGE_LIMIT,
            'pagesCompleted': pages_processed,
            'postsProcessed': 0,
            'postsFound': 0,
        }
    )
    def process_listing_html(page, page_url, html):
        nonlocal pages_processed
        page_posts_processed = 0
        items = parse_listing(html)
        if not items and enable_auto_selenium_on_empty:
            try:
                html2 = fetch_html_selenium(
                    page_url,
                    wait_css=LIST_ENTRY_SELECTOR or SELENIUM_WAIT_SELECTOR or None,
                )
                if html2:
                    save_debug_html(page_url, html2)
                    html = html2
                    items = parse_listing(html)
            except Exception:
                pass
        filtered = [i for i in items if i['link'] not in existing_links]
        skipped_existing = max(0, len(items) - len(filtered))
        write_external_progress(
            {
                'running': True,
                'phase': 'scrape',
                'page': page,
                'pagesCompleted': pages_processed,
                'pageUrl': page_url,
                'htmlBytes': len(html or ''),
                'listingItems': len(items),
                'newItems': len(filtered),
                'skippedExisting': skipped_existing,
                'pagePostsProcessed': 0,
                'pagePostsTotal': len(filtered),
                'postsFound': len(filtered_existing_posts) + len(new_results),
            }
        )
        for post in filtered:
            if MAX_POSTS > 0 and len(new_results) >= MAX_POSTS:
                break
            page_posts_processed += 1
            post_html = fetch_html(scraper, post['link'], BASE_URL, wait_css=DETAILS_VIDEO_SELECTOR or 'video')
            save_debug_html(post['link'], post_html)
            if not post_html:
                new_results.append({
                    'title': clean_text(post['title']),
                    'title_raw': post['title'],
                    'link': post['link'],
                    'video_url': None,
                    'image_url': post.get('image_url'),
                    'meta_description': None,
                    'og_title': None,
                    'og_description': None,
                    'error': 'Failed to fetch HTML'
                })
            else:
                data = parse_post(post_html, post['link'], post['title'], post.get('image_url'))
                data['new_run_flag'] = True
                new_results.append(data)
            write_external_progress(
                {
                    'running': True,
                    'phase': 'scrape',
                    'page': page,
                    'pagesCompleted': pages_processed,
                    'postsProcessed': len(new_results),
                    'pagePostsProcessed': page_posts_processed,
                    'currentPostUrl': post.get('link'),
                }
            )
            try:
                existing_links.add(post.get('link'))
            except Exception:
                pass
            if len(new_results) % 10 == 0:
                try:
                    now_txt = time.strftime('%Y-%m-%d %H:%M:%S')
                    write_results(
                        filtered_existing_posts + new_results,
                        existing_tags,
                        {
                            'pages_completed': pages_processed,
                            'page_limit': PAGE_LIMIT,
                            'last_run_at': now_txt,
                            'last_page': page,
                            'last_post_url': post.get('link'),
                        },
                    )
                except Exception:
                    pass
            delay(800)
        delay(1200)
        try:
            now_txt = time.strftime('%Y-%m-%d %H:%M:%S')
            write_results(
                filtered_existing_posts + new_results,
                existing_tags,
                {
                    'pages_completed': pages_processed,
                    'page_limit': PAGE_LIMIT,
                    'last_run_at': now_txt,
                    'last_page': page,
                    'last_post_url': None,
                },
            )
        except Exception:
            pass

    is_kvs_ajax = PAGINATION_MODE in ('kvs_ajax', 'kvs-ajax', 'ajax')
    if is_kvs_ajax and not is_desc:
        listing_root_url = build_page_url(1)
        page = 1
        page_url = listing_root_url
        html = fetch_html(
            scraper,
            page_url,
            BASE_URL,
            wait_css=LIST_ENTRY_SELECTOR or None,
            allow_blocked_html=True,
        )
        while True:
            if MAX_POSTS > 0 and len(new_results) >= MAX_POSTS:
                break
            save_debug_html(page_url, html)
            if not html:
                break
            pages_processed += 1
            if page >= start_page:
                process_listing_html(page, page_url, html)
            if page >= int(PAGE_LIMIT):
                break
            nxt = extract_kvs_ajax_next(html)
            if not nxt:
                break
            next_url = build_kvs_ajax_url(listing_root_url, nxt.get('block_id'), nxt.get('data_parameters'))
            if not next_url:
                break
            page += 1
            page_url = next_url
            html = fetch_html(
                scraper,
                page_url,
                listing_root_url,
                wait_css=LIST_ENTRY_SELECTOR or None,
                allow_blocked_html=True,
            )
    else:
        page_iter = range(start_page, 0, -1) if is_desc else range(start_page, PAGE_LIMIT + 1)
        for page in page_iter:
            if MAX_POSTS > 0 and len(new_results) >= MAX_POSTS:
                break
            page_url = build_page_url(page)
            html = fetch_html(
                scraper,
                page_url,
                BASE_URL,
                wait_css=LIST_ENTRY_SELECTOR or None,
                allow_blocked_html=True,
            )
            save_debug_html(page_url, html)
            if not html:
                continue
            pages_processed += 1
            process_listing_html(page, page_url, html)
    tags = scrape_tags(scraper)
    merged_posts = filtered_existing_posts + new_results
    write_results(merged_posts, tags, {
        'pages_completed': pages_processed,
        'page_limit': PAGE_LIMIT,
        'last_run_at': time.strftime('%Y-%m-%d %H:%M:%S')
    })
    write_external_progress(
        {
            'running': False,
            'phase': 'scrape_done',
            'baseUrl': BASE_URL,
            'pageLimit': PAGE_LIMIT,
            'pagesCompleted': pages_processed,
            'postsProcessed': len(new_results),
            'postsFound': len(merged_posts),
            'finishedAt': time.strftime('%Y-%m-%d %H:%M:%S'),
        }
    )
    return merged_posts

def run_flask_server():
    import sqlite3
    import uuid
    import threading
    import subprocess
    from datetime import datetime, timezone
    from flask import Flask, jsonify, request, send_from_directory

    runtime_dir = os.environ.get('SHARED_DIR') or os.path.join(OUTPUT_DIR, '.shared')
    os.makedirs(runtime_dir, exist_ok=True)
    db_path = os.path.join(runtime_dir, 'scraper-jobs.db')
    progress_path = os.path.join(runtime_dir, 'scraper-progress.json')
    live_log_path = os.path.join(runtime_dir, 'scraper-live.log')
    scraper_log_path = os.path.join(runtime_dir, 'scraper.log')
    try:
        if not os.path.exists(progress_path):
            with open(progress_path, 'w', encoding='utf-8') as f:
                json.dump({}, f, ensure_ascii=False, indent=2)
    except Exception:
        pass
    try:
        if not os.path.exists(live_log_path):
            with open(live_log_path, 'w', encoding='utf-8') as f:
                f.write('')
    except Exception:
        pass
    try:
        if not os.path.exists(scraper_log_path):
            with open(scraper_log_path, 'w', encoding='utf-8') as f:
                f.write('')
    except Exception:
        pass

    allowed_files = {
        'scraper-live.log',
        'scraper.log',
        'scraper-progress.json',
        'scraper-config.json',
        'scraper-status.json',
        'scraping-summary.json',
        'publisher-status.json',
        'publisher.log',
    }

    def utc_now_iso():
        return datetime.now(timezone.utc).isoformat()

    def parse_dt(val):
        if not val:
            return None
        try:
            return datetime.fromisoformat(val.replace('Z', '+00:00'))
        except Exception:
            return None

    def json_dumps(obj):
        return json.dumps(obj, ensure_ascii=False)

    def db():
        conn = sqlite3.connect(db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    def init_db():
        conn = db()
        cur = conn.cursor()
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS jobs (
              id TEXT PRIMARY KEY,
              name TEXT,
              targets_json TEXT NOT NULL,
              interval_seconds INTEGER,
              run_at TEXT,
              next_run_at TEXT,
              enabled INTEGER NOT NULL DEFAULT 1,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS runs (
              id TEXT PRIMARY KEY,
              job_id TEXT,
              status TEXT NOT NULL,
              started_at TEXT,
              finished_at TEXT,
              request_json TEXT NOT NULL,
              result_json TEXT,
              error TEXT
            )
            """
        )
        try:
            cur.execute("ALTER TABLE runs ADD COLUMN pid INTEGER")
        except Exception:
            pass
        conn.commit()
        conn.close()

    def write_progress(data):
        try:
            with open(progress_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception:
            pass

    def read_progress():
        try:
            if os.path.exists(progress_path):
                with open(progress_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
        except Exception:
            pass
        return {}

    progress_lock = threading.Lock()

    def patch_progress(patch):
        try:
            with progress_lock:
                data = read_progress()
                if not isinstance(data, dict):
                    data = {}
                for k, v in (patch or {}).items():
                    if v is None:
                        data.pop(k, None)
                    else:
                        data[k] = v
                with open(progress_path, 'w', encoding='utf-8') as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception:
            pass

    log_lock = threading.Lock()

    def append_log(line, *, live=False):
        try:
            with log_lock:
                p = live_log_path if live else scraper_log_path
                with open(p, 'a', encoding='utf-8') as f:
                    f.write(line.rstrip('\n') + '\n')
        except Exception:
            pass

    def read_json_file(path):
        try:
            if os.path.exists(path):
                with open(path, 'r', encoding='utf-8') as f:
                    return json.load(f)
        except Exception:
            return None
        return None

    def filter_posts(posts, query):
        if not query:
            return posts
        q = str(query).strip().lower()
        if not q:
            return posts
        out = []
        for p in posts or []:
            title = str(p.get('title') or p.get('caption') or '').lower()
            slinks = ' '.join([str(x) for x in (p.get('slinks_texts') or [])]).lower()
            if q in title or q in slinks:
                out.append(p)
        return out

    runner_lock = threading.Lock()
    cancel_lock = threading.Lock()
    canceled_run_ids = set()
    active_run_procs = {}

    def pid_is_running(pid):
        if not pid:
            return False
        try:
            os.kill(int(pid), 0)
            return True
        except Exception:
            return False

    def is_canceled(run_id):
        with cancel_lock:
            return run_id in canceled_run_ids

    def request_cancel(run_id):
        with cancel_lock:
            canceled_run_ids.add(run_id)
            p = active_run_procs.get(run_id)
        pid = None
        if not p:
            try:
                row = get_run_row(run_id)
                if row:
                    try:
                        pid = row['pid']
                    except Exception:
                        pid = None
            except Exception:
                pid = None
        if p:
            try:
                import signal

                os.killpg(p.pid, signal.SIGTERM)
            except Exception:
                try:
                    p.terminate()
                except Exception:
                    pass
            try:
                p.wait(timeout=5)
            except Exception:
                try:
                    import signal

                    os.killpg(p.pid, signal.SIGKILL)
                except Exception:
                    try:
                        p.kill()
                    except Exception:
                        pass
                try:
                    p.wait(timeout=5)
                except Exception:
                    pass
            pid = p.pid
        elif pid:
            try:
                import signal

                os.killpg(int(pid), signal.SIGTERM)
            except Exception:
                try:
                    import signal

                    os.kill(int(pid), signal.SIGTERM)
                except Exception:
                    pass

        if pid:
            def finalize():
                for _ in range(30):
                    if not pid_is_running(pid):
                        break
                    time.sleep(0.25)
                if pid_is_running(pid):
                    return
                try:
                    conn = db()
                    cur = conn.cursor()
                    cur.execute("SELECT status FROM runs WHERE id=?", (run_id,))
                    row = cur.fetchone()
                    status = row['status'] if row else None
                    if status in ('running', 'canceling'):
                        finished = utc_now_iso()
                        try:
                            cur.execute("UPDATE runs SET status=?, finished_at=?, error=?, pid=? WHERE id=?", ('canceled', finished, 'canceled', None, run_id))
                        except Exception:
                            cur.execute("UPDATE runs SET status=?, finished_at=?, error=? WHERE id=?", ('canceled', finished, 'canceled', run_id))
                        conn.commit()
                    conn.close()
                except Exception:
                    try:
                        conn.close()
                    except Exception:
                        pass
                try:
                    pr = read_progress()
                    if isinstance(pr, dict) and pr.get('runId') == run_id:
                        patch_progress({'running': False, 'phase': 'run_canceled', 'finishedAt': utc_now_iso()})
                except Exception:
                    pass

            threading.Thread(target=finalize, daemon=True).start()
        return pid

    def execute_target(target, run_id, *, target_index=0, targets_total=1):
        def normalize_text(v):
            s = str(v or '').strip()
            if not s:
                return ''
            s = s.replace('`', '').strip()
            if (s.startswith('"') and s.endswith('"')) or (s.startswith("'") and s.endswith("'")):
                s = s[1:-1].strip()
            s = s.replace('`', '').strip()
            return s

        base_url = normalize_text(target.get('baseUrl') or target.get('base_url') or '')
        page_limit = int(target.get('pageLimit') or target.get('page_limit') or 1)
        page_order = normalize_text(target.get('pageOrder') or target.get('page_order') or 'asc').lower()
        max_posts_raw = target.get('maxPosts')
        if max_posts_raw is None:
            max_posts_raw = target.get('max_posts')
        try:
            max_posts = int(max_posts_raw) if str(max_posts_raw).strip() != '' else 0
        except Exception:
            max_posts = 0
        query = str(target.get('query') or '').strip()
        mode = str(target.get('mode') or 'scrape').strip().lower()
        use_selenium = bool(target.get('useSelenium') or target.get('use_selenium') or False)
        cfg = target.get('config') or {}
        pagination = target.get('pagination') or cfg.get('pagination') or {}
        listing_cfg = target.get('listing') or cfg.get('listing') or {}
        details_cfg = target.get('details') or cfg.get('details') or {}

        env = os.environ.copy()
        if base_url:
            env['SCRAPER_BASE_URL'] = base_url
        env['PAGE_LIMIT'] = str(page_limit)
        if page_order:
            env['SCRAPE_PAGE_ORDER'] = str(page_order)
        env['MAX_POSTS'] = str(max_posts)
        env['USE_SELENIUM'] = '1' if use_selenium else '0'
        if isinstance(pagination, dict):
            page1 = normalize_text(pagination.get('page1'))
            pageN = normalize_text(pagination.get('pageN') or pagination.get('page_n'))
            pagination_mode = normalize_text(pagination.get('mode') or pagination.get('type'))
            ajax_sel = normalize_text(
                pagination.get('ajaxLinkSelector')
                or pagination.get('ajax_link_selector')
                or pagination.get('paginationSelector')
                or pagination.get('pagination_selector')
            )
            ajax_next_sel = normalize_text(
                pagination.get('ajaxNextSelector')
                or pagination.get('ajax_next_selector')
                or pagination.get('nextSelector')
                or pagination.get('next_selector')
            )
            if page1:
                env['PAGE1_PATH'] = str(page1)
            if pageN:
                env['PAGEN_TEMPLATE'] = str(pageN)
            if pagination_mode:
                env['PAGINATION_MODE'] = str(pagination_mode).lower()
            if ajax_sel:
                env['AJAX_PAGINATION_SELECTOR'] = str(ajax_sel)
            if ajax_next_sel:
                env['AJAX_PAGINATION_NEXT_SELECTOR'] = str(ajax_next_sel)
        if isinstance(listing_cfg, dict):
            entry_sel = listing_cfg.get('entrySelector') or listing_cfg.get('entry_selector')
            title_sel = listing_cfg.get('titleSelector') or listing_cfg.get('title_selector')
            if entry_sel:
                env['LIST_ENTRY_SELECTOR'] = str(entry_sel)
                env['SELENIUM_WAIT_SELECTOR'] = str(entry_sel)
            if title_sel:
                env['LIST_TITLE_SELECTOR'] = str(title_sel)
        if isinstance(details_cfg, dict):
            video_sel = details_cfg.get('videoSelector') or details_cfg.get('video_selector')
            tags_sel = details_cfg.get('tagsSelector') or details_cfg.get('tags_selector')
            meta_desc_sel = details_cfg.get('metaDescriptionSelector') or details_cfg.get('meta_description_selector')
            og_title_sel = details_cfg.get('ogTitleSelector') or details_cfg.get('og_title_selector')
            og_desc_sel = details_cfg.get('ogDescriptionSelector') or details_cfg.get('og_description_selector')
            if video_sel:
                env['DETAILS_VIDEO_SELECTOR'] = str(video_sel)
            if tags_sel:
                env['DETAILS_TAGS_SELECTOR'] = str(tags_sel)
            if meta_desc_sel:
                env['META_DESCRIPTION_SELECTOR'] = str(meta_desc_sel)
            if og_title_sel:
                env['OG_TITLE_SELECTOR'] = str(og_title_sel)
            if og_desc_sel:
                env['OG_DESCRIPTION_SELECTOR'] = str(og_desc_sel)
        env['SCRAPER_PROGRESS_FILE'] = progress_path
        env['SCRAPER_RUN_ID'] = run_id
        env['SCRAPER_TARGET_INDEX'] = str(int(target_index or 0))
        env['SCRAPER_TARGETS_TOTAL'] = str(int(targets_total or 1))

        cmd = [sys.executable, os.path.abspath(__file__)]
        append_log(
            f'{utc_now_iso()} run={run_id} target start baseUrl={base_url} pageLimit={page_limit} maxPosts={max_posts} mode={mode}',
            live=True,
        )

        def run_cmd(extra_env=None, *, timeout_seconds=900):
            import selectors

            env_run = env.copy()
            if extra_env:
                env_run.update(extra_env)
            p = subprocess.Popen(
                cmd,
                cwd=OUTPUT_DIR,
                env=env_run,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                start_new_session=True,
            )
            with cancel_lock:
                active_run_procs[run_id] = p
            try:
                conn = db()
                cur = conn.cursor()
                try:
                    cur.execute("UPDATE runs SET pid=? WHERE id=?", (int(p.pid), run_id))
                except Exception:
                    pass
                conn.commit()
                conn.close()
            except Exception:
                try:
                    conn.close()
                except Exception:
                    pass
            sel = selectors.DefaultSelector()
            if p.stdout:
                sel.register(p.stdout, selectors.EVENT_READ)
            started_at = time.time()
            while True:
                if is_canceled(run_id):
                    append_log(f'{utc_now_iso()} run={run_id} cancel requested', live=True)
                    try:
                        import signal

                        os.killpg(p.pid, signal.SIGTERM)
                    except Exception:
                        try:
                            p.terminate()
                        except Exception:
                            pass
                    try:
                        p.wait(timeout=5)
                    except Exception:
                        try:
                            import signal

                            os.killpg(p.pid, signal.SIGKILL)
                        except Exception:
                            try:
                                p.kill()
                            except Exception:
                                pass
                        try:
                            p.wait(timeout=5)
                        except Exception:
                            pass
                    try:
                        sel.close()
                    except Exception:
                        pass
                    with cancel_lock:
                        active_run_procs.pop(run_id, None)
                    return 130
                if timeout_seconds and (time.time() - started_at) > float(timeout_seconds):
                    append_log(f'{utc_now_iso()} run={run_id} target timeout after {timeout_seconds}s', live=True)
                    try:
                        import signal

                        os.killpg(p.pid, signal.SIGTERM)
                    except Exception:
                        try:
                            p.terminate()
                        except Exception:
                            pass
                    try:
                        p.wait(timeout=5)
                    except Exception:
                        try:
                            import signal

                            os.killpg(p.pid, signal.SIGKILL)
                        except Exception:
                            try:
                                p.kill()
                            except Exception:
                                pass
                        try:
                            p.wait(timeout=5)
                        except Exception:
                            pass
                    try:
                        sel.close()
                    except Exception:
                        pass
                    with cancel_lock:
                        active_run_procs.pop(run_id, None)
                    return 124

                for key, _ in sel.select(timeout=0.2):
                    try:
                        line = key.fileobj.readline()
                    except Exception:
                        line = ''
                    if line:
                        append_log(line.rstrip('\n'), live=True)

                if p.poll() is not None:
                    break

            try:
                while True:
                    drained_any = False
                    for key, _ in sel.select(timeout=0):
                        try:
                            line = key.fileobj.readline()
                        except Exception:
                            line = ''
                        if line:
                            drained_any = True
                            append_log(line.rstrip('\n'), live=True)
                    if not drained_any:
                        break
            except Exception:
                pass

            try:
                sel.close()
            except Exception:
                pass
            with cancel_lock:
                active_run_procs.pop(run_id, None)
            try:
                conn = db()
                cur = conn.cursor()
                try:
                    cur.execute("UPDATE runs SET pid=? WHERE id=?", (None, run_id))
                except Exception:
                    pass
                conn.commit()
                conn.close()
            except Exception:
                try:
                    conn.close()
                except Exception:
                    pass
            if is_canceled(run_id):
                return 130
            return p.returncode or 0

        if mode == 'details':
            try:
                scrape_timeout = int(page_limit) * 30 + 600
            except Exception:
                scrape_timeout = 900
            scrape_timeout = max(900, min(14400, int(scrape_timeout or 900)))
            exit_code = run_cmd({}, timeout_seconds=scrape_timeout)
            enhanced = read_json_file(os.path.join(OUTPUT_DIR, 'enhanced-extract-results.json')) or {}
            posts = enhanced.get('posts') if isinstance(enhanced, dict) else None
            posts = posts or []
            candidate = filter_posts(posts, query)
            if not candidate:
                candidate = posts
            listing_posts = []
            for p in candidate:
                if not isinstance(p, dict):
                    continue
                link = p.get('link')
                if not link:
                    continue
                listing_posts.append(
                    {
                        'link': link,
                        'title': p.get('title') or p.get('title_raw'),
                        'image_url': p.get('image_url'),
                    }
                )
                if max_posts > 0 and len(listing_posts) >= max_posts:
                    break
            try:
                with open(os.path.join(OUTPUT_DIR, 'listing-posts.json'), 'w', encoding='utf-8') as f:
                    json.dump({'count': len(listing_posts), 'posts': listing_posts}, f, ensure_ascii=False, indent=2)
                append_log(f'{utc_now_iso()} run={run_id} listing_posts written count={len(listing_posts)}', live=True)
            except Exception as e:
                append_log(f'{utc_now_iso()} run={run_id} failed to write listing-posts.json error={e}', live=True)
            try:
                details_timeout = int(len(listing_posts)) * 10 + 600
            except Exception:
                details_timeout = 1800
            details_timeout = max(1800, min(14400, int(details_timeout or 1800)))
            exit_code = run_cmd({'DETAILS': '1'}, timeout_seconds=details_timeout)
        else:
            exit_code = run_cmd({}, timeout_seconds=900)

        append_log(f'{utc_now_iso()} run={run_id} target done exit={exit_code}', live=True)

        details = read_json_file(os.path.join(OUTPUT_DIR, 'post-details.json')) or {}
        enhanced = read_json_file(os.path.join(OUTPUT_DIR, 'enhanced-extract-results.json')) or {}
        summary = read_json_file(os.path.join(OUTPUT_DIR, 'scraping-summary.json')) or {}

        posts = details.get('posts') if isinstance(details, dict) else None
        if not posts:
            posts = enhanced.get('posts') if isinstance(enhanced, dict) else None
        posts = posts or []
        filtered = filter_posts(posts, query)
        def calc_counts(arr):
            a = arr or []
            posts_total = len(a)
            posts_with_images = len([p for p in a if isinstance(p, dict) and p.get('image_url')])
            posts_with_videos = len([p for p in a if isinstance(p, dict) and (p.get('video_src') or p.get('video_url'))])
            posts_publishable = len([p for p in a if isinstance(p, dict) and p.get('link') and (p.get('video_src') or p.get('video_url'))])
            return {
                'postsTotal': posts_total,
                'postsWithImages': posts_with_images,
                'postsWithVideos': posts_with_videos,
                'postsPublishable': posts_publishable,
            }
        err = None
        if exit_code != 0:
            err = f'exitCode={exit_code}'
        if not err and not posts:
            try:
                pages_completed = int((summary or {}).get('pages_completed') or 0)
            except Exception:
                pages_completed = 0
            if pages_completed <= 0:
                err = 'no_pages_fetched (possible network/anti-bot block; try useSelenium=true)'
        return {
            'baseUrl': base_url,
            'pageLimit': page_limit,
            'query': query,
            'exitCode': exit_code,
            'error': err,
            'postsTotal': len(posts),
            'postsMatched': len(filtered),
            'posts': filtered,
            'summary': summary,
            'countsAll': calc_counts(posts),
            'countsMatched': calc_counts(filtered),
        }

    def set_run_status(run_id, status, *, started_at=None, finished_at=None, result=None, error=None):
        conn = db()
        cur = conn.cursor()
        fields = ['status=?']
        vals = [status]
        if started_at is not None:
            fields.append('started_at=?')
            vals.append(started_at)
        if finished_at is not None:
            fields.append('finished_at=?')
            vals.append(finished_at)
        if result is not None:
            fields.append('result_json=?')
            vals.append(json_dumps(result))
        if error is not None:
            fields.append('error=?')
            vals.append(error)
        vals.append(run_id)
        cur.execute(f"UPDATE runs SET {', '.join(fields)} WHERE id=?", vals)
        conn.commit()
        conn.close()

    def create_run(job_id, payload):
        conn = db()
        cur = conn.cursor()
        run_id = uuid.uuid4().hex
        cur.execute(
            "INSERT INTO runs (id, job_id, status, started_at, finished_at, request_json, result_json, error) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (run_id, job_id, 'queued', None, None, json_dumps(payload), None, None),
        )
        conn.commit()
        conn.close()
        return run_id

    def run_worker(run_id, payload):
        with runner_lock:
            with cancel_lock:
                canceled_run_ids.discard(run_id)
            started = utc_now_iso()
            set_run_status(run_id, 'running', started_at=started)
            append_log(f'{utc_now_iso()} run={run_id} start', live=True)
            try:
                targets = payload.get('targets') or []
                patch_progress(
                    {
                        'running': True,
                        'phase': 'run',
                        'runId': run_id,
                        'startedAt': started,
                        'finishedAt': None,
                        'error': None,
                        'targetsTotal': len(targets),
                        'targetIndex': None,
                        'baseUrl': None,
                        'pageLimit': None,
                        'pagesCompleted': None,
                        'postsProcessed': None,
                        'postsFound': None,
                        'page': None,
                        'pageUrl': None,
                        'listingItems': None,
                        'newItems': None,
                        'skippedExisting': None,
                        'pagePostsProcessed': None,
                        'pagePostsTotal': None,
                        'detailsIndex': None,
                        'detailsTotal': None,
                        'detailsCompleted': None,
                        'currentPostUrl': None,
                        'htmlBytes': None,
                    }
                )
                results = []
                any_failed = False
                first_error = None
                for i, t in enumerate(targets):
                    if is_canceled(run_id):
                        finished = utc_now_iso()
                        out = {'runId': run_id, 'targets': results, 'finishedAt': finished}
                        patch_progress({'running': False, 'phase': 'run_canceled', 'runId': run_id, 'finishedAt': finished})
                        set_run_status(run_id, 'canceled', finished_at=finished, result=out, error='canceled')
                        append_log(f'{utc_now_iso()} run={run_id} canceled', live=True)
                        return
                    patch_progress({'running': True, 'phase': 'target', 'runId': run_id, 'targetIndex': i, 'targetsTotal': len(targets)})
                    res = execute_target(t, run_id, target_index=i, targets_total=len(targets))
                    results.append(res)
                    if isinstance(res, dict):
                        if res.get('exitCode') == 130 or res.get('error') == 'canceled':
                            finished = utc_now_iso()
                            out = {'runId': run_id, 'targets': results, 'finishedAt': finished}
                            patch_progress({'running': False, 'phase': 'run_canceled', 'runId': run_id, 'finishedAt': finished})
                            set_run_status(run_id, 'canceled', finished_at=finished, result=out, error='canceled')
                            append_log(f'{utc_now_iso()} run={run_id} canceled', live=True)
                            return
                        if res.get('exitCode') not in (None, 0):
                            any_failed = True
                            if not first_error:
                                first_error = f'target exitCode={res.get("exitCode")}'
                        if res.get('error'):
                            any_failed = True
                            if not first_error:
                                first_error = str(res.get('error'))
                finished = utc_now_iso()
                out = {'runId': run_id, 'targets': results, 'finishedAt': finished}
                patch_progress({'running': False, 'phase': 'run_done', 'runId': run_id, 'finishedAt': finished})
                if any_failed:
                    set_run_status(run_id, 'failed', finished_at=finished, result=out, error=first_error or 'target_failed')
                    append_log(f'{utc_now_iso()} run={run_id} failed error={first_error}', live=True)
                else:
                    set_run_status(run_id, 'succeeded', finished_at=finished, result=out, error=None)
                    append_log(f'{utc_now_iso()} run={run_id} succeeded', live=True)
            except Exception as e:
                finished = utc_now_iso()
                patch_progress({'running': False, 'phase': 'run_error', 'runId': run_id, 'finishedAt': finished, 'error': str(e)})
                set_run_status(run_id, 'failed', finished_at=finished, error=str(e))
                append_log(f'{utc_now_iso()} run={run_id} failed error={e}', live=True)

    scheduler_stop = threading.Event()

    def schedule_loop():
        while not scheduler_stop.is_set():
            try:
                now = datetime.now(timezone.utc)
                conn = db()
                cur = conn.cursor()
                cur.execute(
                    "SELECT id, targets_json, interval_seconds FROM jobs WHERE enabled=1 AND next_run_at IS NOT NULL AND next_run_at <= ?",
                    (now.isoformat(),),
                )
                rows = cur.fetchall()
                for r in rows:
                    job_id = r['id']
                    targets = json.loads(r['targets_json'] or '[]')
                    payload = {'targets': targets, 'jobId': job_id}
                    run_id = create_run(job_id, payload)
                    interval = r['interval_seconds']
                    next_dt = None
                    if interval and int(interval) > 0:
                        next_dt = (now.timestamp() + int(interval))
                        next_dt = datetime.fromtimestamp(next_dt, tz=timezone.utc).isoformat()
                    cur.execute(
                        "UPDATE jobs SET next_run_at=?, updated_at=? WHERE id=?",
                        (next_dt, utc_now_iso(), job_id),
                    )
                    conn.commit()
                    threading.Thread(target=run_worker, args=(run_id, payload), daemon=True).start()
                conn.close()
            except Exception:
                try:
                    conn.close()
                except Exception:
                    pass
            scheduler_stop.wait(1.0)

    init_db()
    threading.Thread(target=schedule_loop, daemon=True).start()

    app = Flask(__name__)

    def presets():
        return [
            {
                'id': 'mmsbaba',
                'label': 'mmsbaba.com',
                'baseUrl': 'https://mmsbaba.com',
                'pagination': {
                    'page1': '/',
                    'pageN': '/page/{page}/',
                    'examplePage2': 'https://mmsbaba.com/page/2/',
                },
                'listing': {
                    'entrySelector': 'div.videos a.video',
                    'fields': [
                        {'name': 'link', 'source': 'a.href'},
                        {'name': 'image_url', 'source': 'a.style background-image url(...)'},
                        {'name': 'title', 'source': 'a.title OR h2.vtitle'},
                    ],
                },
                'details': {
                    'videoSelector': 'div.box #video-container div.art-video-player video.art-video[preload="metadata"]',
                    'meta': [
                        {'name': 'meta_description', 'source': 'meta[name="description"]'},
                        {'name': 'og_title', 'source': 'meta[property="og:title"] OR <title>'},
                        {'name': 'og_description', 'source': 'meta[property="og:description"] OR meta_description'},
                    ],
                    'tagsSelector': 'main#primary.site-main article div.scontent div.slinks a',
                    'fields': [
                        {'name': 'video_src', 'source': 'video.src'},
                        {'name': 'slinks_texts', 'source': 'tagsSelector texts'},
                    ],
                },
                'collectedPostFields': [
                    'title',
                    'link',
                    'image_url',
                    'meta_description',
                    'og_title',
                    'og_description',
                    'video_src',
                    'slinks_texts',
                ],
                'recommendedTargets': [
                    {
                        'baseUrl': 'https://mmsbaba.com',
                        'pageLimit': 1,
                        'query': '',
                        'mode': 'details',
                        'autoPublish': False,
                    }
                ],
            }
            ,
            {
                'id': 'banglachotikahinii_videos',
                'label': 'banglachotikahinii.com/videos',
                'baseUrl': 'https://www.banglachotikahinii.com/videos',
                'pagination': {
                    'mode': 'kvs_ajax',
                    'page1': '/',
                    'paginationSelector': '#list_videos_most_recent_videos_pagination a[data-action="ajax"][data-block-id][data-parameters]',
                    'nextSelector': '#list_videos_most_recent_videos_pagination a.next[data-action="ajax"][data-block-id][data-parameters]',
                },
                'listing': {
                    'entrySelector': '#list_videos_most_recent_videos_items a[href]',
                    'titleSelector': 'div.title',
                    'fields': [
                        {'name': 'link', 'source': 'a.href'},
                        {'name': 'image_url', 'source': 'img.src'},
                        {'name': 'title', 'source': 'div.title OR a.title'},
                    ],
                },
                'details': {
                    'videoSelector': 'div.col-video #kt_player .fp-player video.fp-engine[src], div.col-video #kt_player .fp-player video[src], div.col-video #kt_player video[src], div.col-video video[src], #kt_player video[src], video[src]',
                    'meta': [
                        {'name': 'meta_description', 'source': 'meta[name="description"]'},
                        {'name': 'og_title', 'source': 'meta[property="og:title"] OR <title>'},
                        {'name': 'og_description', 'source': 'meta[property="og:description"] OR meta_description'},
                    ],
                    'tagsSelector': 'div.col-video .top-options .buttons-row a, div.top-options .buttons-row a, a.btn.button[href*="/tags/"]',
                    'fields': [
                        {'name': 'video_src', 'source': 'video.src'},
                        {'name': 'slinks_texts', 'source': 'tagsSelector texts'},
                    ],
                },
                'collectedPostFields': [
                    'title',
                    'link',
                    'image_url',
                    'meta_description',
                    'og_title',
                    'og_description',
                    'video_src',
                    'slinks_texts',
                ],
                'recommendedTargets': [
                    {
                        'baseUrl': 'https://www.banglachotikahinii.com/videos',
                        'pageLimit': 2,
                        'query': '',
                        'mode': 'details',
                        'autoPublish': False,
                    }
                ],
            }
        ]

    def get_run_row(run_id):
        conn = db()
        cur = conn.cursor()
        cur.execute("SELECT * FROM runs WHERE id=?", (run_id,))
        row = cur.fetchone()
        conn.close()
        return row

    def flatten_run_posts(result, target_index=None):
        if not isinstance(result, dict):
            return []
        targets = result.get('targets')
        if not isinstance(targets, list):
            return []
        selected = targets
        if isinstance(target_index, int) and 0 <= target_index < len(targets):
            selected = [targets[target_index]]
        posts = []
        for t in selected:
            if isinstance(t, dict) and isinstance(t.get('posts'), list):
                posts.extend(t.get('posts'))
        return posts

    @app.get('/')
    def ui_index():
        try:
            ui_path = os.path.join(os.path.dirname(__file__), 'scraper-ui.html')
            with open(ui_path, 'r', encoding='utf-8') as f:
                return f.read()
        except Exception:
            pass
        preset_json = json.dumps(presets(), ensure_ascii=False)
        return f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Python Scraper UI</title>
    <style>
      body {{ font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; margin: 0; background: #0b1220; color: #e5e7eb; }}
      a {{ color: #93c5fd; }}
      .wrap {{ max-width: 1100px; margin: 0 auto; padding: 20px; }}
      .row {{ display: flex; gap: 12px; flex-wrap: wrap; }}
      .card {{ background: #111827; border: 1px solid #1f2937; border-radius: 12px; padding: 14px; }}
      .card h2 {{ margin: 0 0 10px 0; font-size: 16px; }}
      input, select, button, textarea {{ border-radius: 10px; border: 1px solid #334155; background: #0b1220; color: #e5e7eb; padding: 10px; }}
      input, select {{ min-width: 220px; }}
      textarea {{ width: 100%; min-height: 220px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; }}
      button {{ cursor: pointer; }}
      button.secondary {{ background: #0b1220; }}
      button.primary {{ background: #2563eb; border-color: #2563eb; }}
      .muted {{ color: #94a3b8; font-size: 12px; }}
      .mono {{ font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; }}
      .list {{ max-height: 240px; overflow: auto; border-radius: 10px; border: 1px solid #1f2937; }}
      .list button {{ width: 100%; text-align: left; border: 0; border-bottom: 1px solid #1f2937; border-radius: 0; padding: 10px; background: transparent; }}
      .list button:hover {{ background: #0b1220; }}
      .badge {{ display: inline-block; padding: 2px 8px; border-radius: 999px; border: 1px solid #334155; font-size: 12px; margin-left: 6px; }}
      pre {{ white-space: pre-wrap; word-break: break-word; background: #0b1220; border: 1px solid #1f2937; padding: 10px; border-radius: 10px; }}
      .toast {{ position: sticky; top: 12px; z-index: 50; margin-top: 12px; padding: 10px 12px; border-radius: 12px; border: 1px solid #334155; background: #0b1220; }}
      .toast.info {{ border-color: #334155; color: #e5e7eb; }}
      .toast.success {{ border-color: #22c55e; color: #bbf7d0; }}
      .toast.error {{ border-color: #ef4444; color: #fecaca; }}
    </style>
  </head>
  <body>
    <div class="wrap">
      <h1 style="margin: 0 0 10px 0;">Python Scraper UI (macOS local)</h1>
      <div class="muted">Server runs from <span class="mono">{runtime_dir}</span></div>

      <div id="toast" class="toast info" style="display: none;"></div>

      <div class="row" style="margin-top: 16px; align-items: flex-start;">
        <div style="flex: 2; min-width: 360px; display: flex; flex-direction: column; gap: 12px;">
          <div class="card" style="flex: 1;">
          <h2>Targets</h2>
          <div class="row">
            <select id="preset"></select>
            <button class="secondary" id="loadPreset">Load Preset</button>
            <button class="secondary" id="importPreset">Import Preset JSON</button>
            <button class="secondary" id="addTarget">Add Target</button>
          </div>
          <div id="targets" style="margin-top: 10px; display: grid; gap: 10px;"></div>
          <div class="row" style="margin-top: 10px;">
            <button class="primary" id="runNow">Run All Targets Once</button>
            <button class="secondary" id="createJob">Create Scheduled Job</button>
          </div>
          <div class="row" style="margin-top: 10px;">
            <input id="jobName" placeholder="Job name (optional)" />
            <input id="jobInterval" type="number" placeholder="Interval seconds (optional)" />
            <input id="jobRunAt" type="datetime-local" />
          </div>
          </div>

          <div class="row">
            <div class="card" style="flex: 1; min-width: 360px;">
              <h2>Runs</h2>
              <div class="list" id="runs"></div>
              <div class="row" style="margin-top: 10px;">
                <button class="secondary" id="refresh">Refresh</button>
                <button class="secondary" id="copyResult">Copy Result</button>
                <button class="secondary" id="publishSanity">Publish to Sanity</button>
              </div>
            </div>
            <div class="card" style="flex: 1; min-width: 360px;">
              <h2>Result</h2>
              <pre id="runSummary" style="max-height: 140px; overflow: auto;"></pre>
              <textarea id="result" spellcheck="false"></textarea>
              <div class="muted" id="status" style="margin-top: 8px;"></div>
            </div>
          </div>

          <div class="card" style="flex: 1;">
          <h2>Jobs</h2>
          <div class="row" style="margin: 10px 0;">
            <button class="secondary" id="runAllJobs">Run All Jobs Once</button>
          </div>
          <div class="list" id="jobs"></div>
          </div>
        </div>

        <div style="flex: 1; min-width: 360px; display: flex; flex-direction: column; gap: 12px;">
          <div class="card" style="flex: 1;">
            <h2>Live Log</h2>
            <pre id="log" style="max-height: 420px; overflow: auto;"></pre>
            <div class="row" style="margin-top: 10px;">
              <button class="secondary" id="loadLog">Reload Log</button>
            </div>
          </div>
          <div class="card" style="flex: 1;">
            <h2>Progress</h2>
            <pre id="progress" style="max-height: 240px; overflow: auto;"></pre>
            <div class="row" style="margin-top: 10px;">
              <button class="secondary" id="loadProgress">Reload Progress</button>
            </div>
          </div>
        </div>
      </div>

      <div class="row" style="margin-top: 16px;">
        <div class="card" style="flex: 1; min-width: 360px;">
          <h2 id="exampleTitle">Example Preset</h2>
          <pre id="example"></pre>
        </div>
      </div>
    </div>

    <script>
      const PRESETS = {preset_json};
      const state = {{
        targets: [],
        selectedRunId: '',
        selectedRun: null,
        editJobId: '',
      }};

      function el(id) {{ return document.getElementById(id); }}
      let toastTimer = null;
      function setStatus(t) {{ el('status').textContent = t || ''; }}
      function notify(t, kind) {{
        const msg = String(t || '');
        setStatus(msg);
        const toast = el('toast');
        if (toast) {{
          toast.textContent = msg;
          toast.className = 'toast ' + (kind || 'info');
          toast.style.display = msg ? 'block' : 'none';
          if (toastTimer) clearTimeout(toastTimer);
          toastTimer = setTimeout(() => {{
            toast.style.display = 'none';
          }}, kind === 'error' ? 8000 : 2500);
        }}
        const fn = kind === 'error' ? console.error : console.log;
        fn('[scraper-ui]', msg);
        if (kind === 'error') {{
          try {{ alert(msg); }} catch {{}}
        }}
      }}
      function escText(s) {{
        return String(s ?? '').replace(/[&<>]/g, (c) => ({{ '&': '&amp;', '<': '&lt;', '>': '&gt;' }}[c]));
      }}
      function escAttr(s) {{
        return escText(s).replace(/"/g, '&quot;');
      }}

      function renderPresets() {{
        const p = el('preset');
        p.innerHTML = '';
        for (const x of PRESETS) {{
          const opt = document.createElement('option');
          opt.value = x.id;
          opt.textContent = x.label;
          p.appendChild(opt);
        }}
      }}

      function presetById(id) {{
        return PRESETS.find(x => x.id === id) || PRESETS[0];
      }}

      function normalizeTextInput(v) {{
        let s = String(v ?? '').trim();
        if (!s) return '';
        s = s.replace(/`/g, '').trim();
        if ((s.startsWith('\"') && s.endsWith('\"')) || (s.startsWith(\"'\") && s.endsWith(\"'\"))) {{
          s = s.slice(1, -1).trim();
        }}
        return s;
      }}

      function normalizeConfigObject(obj) {{
        if (!obj || typeof obj !== 'object') return {{ pagination: {{}}, listing: {{}}, details: {{}} }};
        const cfg = obj;
        return {{
          pagination: cfg.pagination && typeof cfg.pagination === 'object' ? cfg.pagination : {{}},
          listing: cfg.listing && typeof cfg.listing === 'object' ? cfg.listing : {{}},
          details: cfg.details && typeof cfg.details === 'object' ? cfg.details : {{}},
        }};
      }}

      function currentExamplePreset() {{
        const pr = presetById(el('preset').value);
        const t = state.targets && state.targets[0] ? state.targets[0] : null;
        if (!t) return pr;
        const cfg = normalizeConfigObject(t.config || {{}});
        return {{
          id: 'current_target',
          label: 'Current target',
          baseUrl: normalizeTextInput(t.baseUrl || pr.baseUrl || ''),
          pagination: cfg.pagination,
          listing: cfg.listing,
          details: cfg.details,
          recommendedTargets: [
            {{
              baseUrl: normalizeTextInput(t.baseUrl || pr.baseUrl || ''),
              pageLimit: Number(t.pageLimit ?? 1),
              query: String(t.query || ''),
              mode: String(t.mode || 'details'),
              pageOrder: String(t.pageOrder || 'asc'),
              autoPublish: !!t.autoPublish,
              useSelenium: !!t.useSelenium,
              maxPosts: Number(t.maxPosts ?? 0),
            }},
          ],
        }};
      }}

      function renderExample() {{
        const ex = currentExamplePreset();
        const title = el('exampleTitle');
        if (title) title.textContent = 'Example Preset (' + String(ex.label || 'custom') + ')';
        el('example').textContent = JSON.stringify(ex, null, 2);
      }}

      function targetRow(t, idx) {{
        const wrap = document.createElement('div');
        wrap.className = 'card';
        wrap.style.padding = '10px';
        wrap.innerHTML = `
          <div class="row">
            <input data-k="baseUrl" placeholder="Base URL" value="${{escAttr(t.baseUrl || '')}}" />
            <input data-k="pageLimit" type="number" placeholder="Page limit" value="${{escAttr(t.pageLimit ?? 1)}}" />
            <input data-k="maxPosts" type="number" placeholder="Max posts (0=unlimited)" value="${{escAttr(t.maxPosts ?? 0)}}" />
            <textarea data-k="query" placeholder="Query filter text (title/tags contains)" style="min-height: 40px;">${{escText(t.query || '')}}</textarea>
          </div>
          <div class="row" style="margin-top: 8px;">
            <select data-k="mode">
              <option value="scrape" ${{t.mode === 'scrape' ? 'selected' : ''}}>scrape</option>
              <option value="details" ${{t.mode === 'details' ? 'selected' : ''}}>details</option>
            </select>
            <select data-k="pageOrder">
              <option value="asc" ${{(t.pageOrder || 'asc') === 'asc' ? 'selected' : ''}}>first→last</option>
              <option value="desc" ${{t.pageOrder === 'desc' ? 'selected' : ''}}>last→first</option>
            </select>
            <select data-k="autoPublish">
              <option value="false" ${{!t.autoPublish ? 'selected' : ''}}>autoPublish=false</option>
              <option value="true" ${{t.autoPublish ? 'selected' : ''}}>autoPublish=true</option>
            </select>
            <select data-k="useSelenium">
              <option value="false" ${{!t.useSelenium ? 'selected' : ''}}>useSelenium=false</option>
              <option value="true" ${{t.useSelenium ? 'selected' : ''}}>useSelenium=true</option>
            </select>
            <button class="secondary" data-act="run-one">Run This Target Once</button>
            <button class="secondary" data-act="remove">Remove</button>
          </div>
          <div style="margin-top: 8px;">
            <div class="muted" style="margin-bottom: 8px;">Advanced config (paste preset JSON or config JSON)</div>
            <div class="row">
              <select data-k="paginationMode">
                <option value="" ${{!(t.config?.pagination?.mode) ? 'selected' : ''}}>pagination.mode (default)</option>
                <option value="url" ${{(t.config?.pagination?.mode || '') === 'url' ? 'selected' : ''}}>url template</option>
                <option value="kvs_ajax" ${{(t.config?.pagination?.mode || '') === 'kvs_ajax' ? 'selected' : ''}}>kvs_ajax</option>
              </select>
              <input data-k="page1Path" placeholder="pagination.page1 (e.g. /)" value="${{escAttr(t.config?.pagination?.page1 || '')}}" />
              <input data-k="pageNTemplate" placeholder="pagination.pageN (e.g. /page/{{page}}/)" value="${{escAttr(t.config?.pagination?.pageN || '')}}" />
            </div>
            <div class="row" style="margin-top: 8px;">
              <input data-k="ajaxPaginationSelector" placeholder="pagination.paginationSelector (AJAX links)" value="${{escAttr(t.config?.pagination?.paginationSelector || '')}}" />
              <input data-k="ajaxNextSelector" placeholder="pagination.nextSelector (AJAX next)" value="${{escAttr(t.config?.pagination?.nextSelector || '')}}" />
            </div>
            <textarea data-k="configJson" spellcheck="false" style="min-height: 180px; margin-top: 8px;">${{escText(JSON.stringify(t.config || {{}}, null, 2))}}</textarea>
          </div>
        `;
        wrap.querySelector('[data-act="remove"]').onclick = () => {{
          state.targets.splice(idx, 1);
          if (state.targets.length === 0) state.targets.push(defaultTarget());
          renderTargets();
        }};
        wrap.querySelector('[data-act="run-one"]').onclick = async () => {{
          notify('starting run (single target)...', 'info');
          const r = await apiPost('api/runs', {{ targets: [serializeTarget(t)] }});
          if (r.ok && r.data?.runId) {{
            notify('run accepted ' + r.data.runId, 'success');
            await refreshRuns();
            await loadRun(r.data.runId);
          }} else {{
            notify('run failed ' + (r.error || ''), 'error');
          }}
        }};
        for (const input of wrap.querySelectorAll('input, select, textarea')) {{
          const k = input.getAttribute('data-k');
          if (k === 'configJson') {{
            input.onchange = (e) => {{
              const v = e.target.value || '';
              try {{
                const parsed = JSON.parse(v || '{{}}');
                if (parsed && typeof parsed === 'object') {{
                  const looksLikePreset =
                    parsed.baseUrl &&
                    (parsed.pagination || parsed.listing || parsed.details || parsed.recommendedTargets);
                  if (looksLikePreset) {{
                    const currentBase = normalizeTextInput(t.baseUrl || '');
                    const importedBase = normalizeTextInput(parsed.baseUrl || '');
                    if (!currentBase && importedBase) t.baseUrl = importedBase;
                    if (parsed.pageLimit != null) t.pageLimit = Number(parsed.pageLimit || 1);
                    if (parsed.mode) t.mode = String(parsed.mode);
                    if (parsed.pageOrder) t.pageOrder = String(parsed.pageOrder);
                    if (parsed.autoPublish != null) t.autoPublish = !!parsed.autoPublish;
                    t.config = {{ pagination: parsed.pagination, listing: parsed.listing, details: parsed.details }};
                    notify('preset imported into target', 'success');
                    renderTargets();
                    return;
                  }}
                  t.config = parsed;
                  notify('config updated', 'success');
                }} else {{
                  notify('config must be a JSON object', 'error');
                }}
              }} catch {{
                notify('config JSON invalid', 'error');
              }}
            }};
          }} else {{
            input.oninput = (e) => {{
              const v = e.target.value;
              if (k === 'pageLimit') t.pageLimit = Number(v || 1);
              else if (k === 'maxPosts') t.maxPosts = Number(v || 0);
              else if (k === 'autoPublish') t.autoPublish = v === 'true';
              else if (k === 'useSelenium') t.useSelenium = v === 'true';
              else if (k === 'baseUrl') t.baseUrl = normalizeTextInput(v);
              else if (k === 'paginationMode') {{
                t.config = t.config && typeof t.config === 'object' ? t.config : {{}};
                t.config.pagination = t.config.pagination && typeof t.config.pagination === 'object' ? t.config.pagination : {{}};
                const mode = String(v || '').trim();
                if (!mode) delete t.config.pagination.mode;
                else t.config.pagination.mode = mode;
                const ta = wrap.querySelector('textarea[data-k=\"configJson\"]');
                if (ta) ta.value = JSON.stringify(t.config || {{}}, null, 2);
                renderExample();
                return;
              }}
              else if (k === 'page1Path') {{
                t.config = t.config && typeof t.config === 'object' ? t.config : {{}};
                t.config.pagination = t.config.pagination && typeof t.config.pagination === 'object' ? t.config.pagination : {{}};
                t.config.pagination.page1 = String(v || '');
                const ta = wrap.querySelector('textarea[data-k=\"configJson\"]');
                if (ta) ta.value = JSON.stringify(t.config || {{}}, null, 2);
                renderExample();
                return;
              }}
              else if (k === 'pageNTemplate') {{
                t.config = t.config && typeof t.config === 'object' ? t.config : {{}};
                t.config.pagination = t.config.pagination && typeof t.config.pagination === 'object' ? t.config.pagination : {{}};
                t.config.pagination.pageN = String(v || '');
                const ta = wrap.querySelector('textarea[data-k=\"configJson\"]');
                if (ta) ta.value = JSON.stringify(t.config || {{}}, null, 2);
                renderExample();
                return;
              }}
              else if (k === 'ajaxPaginationSelector') {{
                t.config = t.config && typeof t.config === 'object' ? t.config : {{}};
                t.config.pagination = t.config.pagination && typeof t.config.pagination === 'object' ? t.config.pagination : {{}};
                t.config.pagination.paginationSelector = String(v || '');
                const ta = wrap.querySelector('textarea[data-k=\"configJson\"]');
                if (ta) ta.value = JSON.stringify(t.config || {{}}, null, 2);
                renderExample();
                return;
              }}
              else if (k === 'ajaxNextSelector') {{
                t.config = t.config && typeof t.config === 'object' ? t.config : {{}};
                t.config.pagination = t.config.pagination && typeof t.config.pagination === 'object' ? t.config.pagination : {{}};
                t.config.pagination.nextSelector = String(v || '');
                const ta = wrap.querySelector('textarea[data-k=\"configJson\"]');
                if (ta) ta.value = JSON.stringify(t.config || {{}}, null, 2);
                renderExample();
                return;
              }}
              else if (k === 'query') {{
                const vv = String(v || '').trim();
                const looksLikePresetJson =
                  (vv.startsWith('{{') || vv.startsWith('[')) &&
                  (vv.includes('\"pagination\"') || vv.includes('\"listing\"') || vv.includes('\"details\"') || vv.includes('\"recommendedTargets\"'));
                if (looksLikePresetJson) {{
                  e.target.value = '';
                  t.query = '';
                  notify('Query filter expects plain text (e.g. a keyword), not the preset JSON.', 'error');
                  return;
                }}
                t.query = v;
              }}
              else t[k] = v;
              renderExample();
            }};
          }}
        }}
        return wrap;
      }}

      function defaultTarget() {{
        const pr = presetById(el('preset').value);
        return {{
          baseUrl: pr.baseUrl || 'https://mmsbaba.com',
          pageLimit: 1,
          pageOrder: 'asc',
          maxPosts: 0,
          query: '',
          mode: 'details',
          autoPublish: false,
          useSelenium: false,
          config: {{ pagination: pr.pagination, listing: pr.listing, details: pr.details }},
        }};
      }}

      function renderTargets() {{
        const cont = el('targets');
        cont.innerHTML = '';
        state.targets.forEach((t, idx) => cont.appendChild(targetRow(t, idx)));
      }}

      async function apiGet(url) {{
        try {{
          console.log('[scraper-ui]', 'GET', url);
          const r = await fetch(url, {{ cache: 'no-store' }});
          const j = await r.json().catch(() => ({{}}));
          if (!r.ok) throw new Error(j?.error || ('HTTP ' + r.status));
          return j;
        }} catch (e) {{
          console.error('[scraper-ui]', 'GET failed', url, e);
          return {{ ok: false, error: String(e?.message || e) }};
        }}
      }}
      async function apiPost(url, body) {{
        try {{
          console.log('[scraper-ui]', 'POST', url, body || {{}});
          const r = await fetch(url, {{
            method: 'POST',
            headers: {{ 'Content-Type': 'application/json' }},
            body: JSON.stringify(body || {{}}),
          }});
          const j = await r.json().catch(() => ({{}}));
          if (!r.ok) throw new Error(j?.error || ('HTTP ' + r.status));
          return j;
        }} catch (e) {{
          console.error('[scraper-ui]', 'POST failed', url, e);
          return {{ ok: false, error: String(e?.message || e) }};
        }}
      }}
      async function apiDelete(url) {{
        try {{
          console.log('[scraper-ui]', 'DELETE', url);
          const r = await fetch(url, {{ method: 'DELETE' }});
          const j = await r.json().catch(() => ({{}}));
          if (!r.ok) throw new Error(j?.error || ('HTTP ' + r.status));
          return j;
        }} catch (e) {{
          console.error('[scraper-ui]', 'DELETE failed', url, e);
          return {{ ok: false, error: String(e?.message || e) }};
        }}
      }}

      function toDateTimeLocalValue(iso) {{
        if (!iso) return '';
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return '';
        const pad = (n) => String(n).padStart(2, '0');
        const yyyy = d.getFullYear();
        const mm = pad(d.getMonth() + 1);
        const dd = pad(d.getDate());
        const hh = pad(d.getHours());
        const mi = pad(d.getMinutes());
        return `${{yyyy}}-${{mm}}-${{dd}}T${{hh}}:${{mi}}`;
      }}

      async function refreshRuns() {{
        const r = await apiGet('api/runs');
        const rows = r.data || [];
        const list = el('runs');
        list.innerHTML = '';
        for (const x of rows) {{
          const row = document.createElement('div');
          row.style.display = 'flex';
          row.style.gap = '8px';
          row.style.alignItems = 'center';
          row.style.padding = '10px';
          row.style.borderBottom = '1px solid #1f2937';

          const title = document.createElement('div');
          title.style.flex = '1';
          title.textContent = x.id + ' ';
          const badge = document.createElement('span');
          badge.className = 'badge';
          badge.textContent = x.status;
          title.appendChild(badge);

          const viewBtn = document.createElement('button');
          viewBtn.className = 'secondary';
          viewBtn.textContent = 'View';
          viewBtn.onclick = async () => {{
            state.selectedRunId = x.id;
            await loadRun(x.id);
          }};

          let stopBtn = null;
          let resumeBtn = null;
          if (x.status === 'running') {{
            stopBtn = document.createElement('button');
            stopBtn.className = 'secondary';
            stopBtn.textContent = 'Stop';
            stopBtn.onclick = async () => {{
              const rr = await apiPost('api/runs/' + x.id + '/stop', {{}});
              notify(rr.ok ? 'stop requested' : ('stop failed ' + (rr.error || '')), rr.ok ? 'success' : 'error');
              await refreshRuns();
            }};

            resumeBtn = document.createElement('button');
            resumeBtn.className = 'secondary';
            resumeBtn.textContent = 'Resume';
            resumeBtn.disabled = true;
          }}

          const delBtn = document.createElement('button');
          delBtn.className = 'secondary';
          delBtn.textContent = 'Delete';
          delBtn.disabled = x.status === 'running';
          delBtn.onclick = async () => {{
            if (!confirm('Delete run?')) return;
            const rr = await apiDelete('api/runs/' + x.id);
            notify(rr.ok ? 'run deleted' : ('run delete failed ' + (rr.error || '')), rr.ok ? 'success' : 'error');
            if (rr.ok && state.selectedRunId === x.id) {{
              state.selectedRunId = '';
              state.selectedRun = null;
              el('result').value = '';
              el('runSummary').textContent = '';
            }}
            await refreshRuns();
          }};

          row.appendChild(title);
          row.appendChild(viewBtn);
          if (stopBtn) row.appendChild(stopBtn);
          if (resumeBtn) row.appendChild(resumeBtn);
          row.appendChild(delBtn);
          list.appendChild(row);
        }}
      }}

      async function refreshJobs() {{
        const r = await apiGet('api/jobs');
        const rows = r.data || [];
        const list = el('jobs');
        list.innerHTML = '';
        for (const x of rows) {{
          const row = document.createElement('div');
          row.style.display = 'flex';
          row.style.gap = '8px';
          row.style.alignItems = 'center';
          row.style.padding = '10px';
          row.style.borderBottom = '1px solid #1f2937';

          const title = document.createElement('div');
          title.style.flex = '1';
          title.textContent = (x.name || x.id) + ' ';
          const badge = document.createElement('span');
          badge.className = 'badge';
          badge.textContent = x.next_run_at ? ('next ' + x.next_run_at) : 'no schedule';
          title.appendChild(badge);

          const runBtn = document.createElement('button');
          runBtn.className = 'secondary';
          runBtn.textContent = 'Run';
          runBtn.onclick = async () => {{
            const rr = await apiPost('api/jobs/' + x.id + '/run', {{}});
            notify(rr.ok ? ('job run accepted ' + (rr.data?.runId || '')) : ('job run failed ' + (rr.error || '')), rr.ok ? 'success' : 'error');
            await refreshRuns();
          }};

          const editBtn = document.createElement('button');
          editBtn.className = 'secondary';
          editBtn.textContent = 'Edit';
          editBtn.onclick = async () => {{
            state.editJobId = x.id;
            el('jobName').value = x.name || '';
            el('jobInterval').value = x.interval_seconds != null ? String(x.interval_seconds) : '';
            el('jobRunAt').value = toDateTimeLocalValue(x.run_at);
            state.targets = Array.isArray(x.targets) && x.targets.length ? x.targets : [defaultTarget()];
            renderTargets();
            el('createJob').textContent = 'Save Job';
            notify('job loaded for edit', 'success');
          }};

          const delBtn = document.createElement('button');
          delBtn.className = 'secondary';
          delBtn.textContent = 'Delete';
          delBtn.onclick = async () => {{
            if (!confirm('Delete job?')) return;
            const rr = await apiDelete('api/jobs/' + x.id);
            notify(rr.ok ? 'job deleted' : ('job delete failed ' + (rr.error || '')), rr.ok ? 'success' : 'error');
            if (rr.ok && state.editJobId === x.id) {{
              state.editJobId = '';
              el('createJob').textContent = 'Create Scheduled Job';
              el('jobName').value = '';
              el('jobInterval').value = '';
              el('jobRunAt').value = '';
            }}
            await refreshJobs();
          }};

          row.appendChild(title);
          row.appendChild(runBtn);
          row.appendChild(editBtn);
          row.appendChild(delBtn);
          list.appendChild(row);
        }}
      }}

      async function loadRun(id) {{
        const r = await apiGet('api/runs/' + id);
        state.selectedRun = r.data || null;
        const result = state.selectedRun?.result || null;
        el('result').value = result ? JSON.stringify(result, null, 2) : JSON.stringify(state.selectedRun, null, 2);
        try {{
          const targets = Array.isArray(result?.targets) ? result.targets : [];
          const totals = {{
            targets: targets.length,
            postsTotal: 0,
            postsMatched: 0,
            postsWithImages: 0,
            postsWithVideos: 0,
            postsPublishable: 0,
          }};
          for (const t of targets) {{
            const all = t?.countsAll || null;
            const matched = t?.countsMatched || null;
            if (all || matched) {{
              const a = all || {{}};
              const m = matched || all || {{}};
              totals.postsTotal += Number(a.postsTotal || 0);
              totals.postsWithImages += Number(a.postsWithImages || 0);
              totals.postsWithVideos += Number(a.postsWithVideos || 0);
              totals.postsPublishable += Number(m.postsPublishable || 0);
            }} else {{
              const posts = Array.isArray(t?.posts) ? t.posts : [];
              totals.postsTotal += posts.length;
              totals.postsMatched += posts.length;
              totals.postsWithImages += posts.filter(p => p?.image_url).length;
              totals.postsWithVideos += posts.filter(p => (p?.video_src || p?.video_url)).length;
              totals.postsPublishable += posts.filter(p => p?.link && (p?.video_src || p?.video_url)).length;
            }}
          }}
          const lines = [
            'Targets: ' + String(totals.targets),
            'Posts (total): ' + String(totals.postsTotal),
            'Images: ' + String(totals.postsWithImages),
            'Video sources: ' + String(totals.postsWithVideos),
            'Publishable (has video): ' + String(totals.postsPublishable),
          ];
          el('runSummary').textContent = lines.join('\\n');
        }} catch {{
          el('runSummary').textContent = '';
        }}
      }}

      async function loadLog() {{
        try {{
          const r = await fetch('scraper-live.log', {{ cache: 'no-store' }});
          el('log').textContent = await r.text();
        }} catch {{
          el('log').textContent = '';
        }}
      }}

      async function loadProgress() {{
        try {{
          const r = await apiGet('progress');
          el('progress').textContent = JSON.stringify(r.data || {{}}, null, 2);
        }} catch {{
          el('progress').textContent = '';
        }}
      }}

      el('addTarget').onclick = () => {{
        state.targets.push(defaultTarget());
        renderTargets();
        notify('target added', 'success');
      }};

      el('loadPreset').onclick = () => {{
        const pr = presetById(el('preset').value);
        state.targets = (pr.recommendedTargets || []).map(x => ({{...x, maxPosts: x.maxPosts ?? 0, useSelenium: !!x.useSelenium, config: {{ pagination: pr.pagination, listing: pr.listing, details: pr.details }} }}));
        if (state.targets.length === 0) state.targets = [defaultTarget()];
        renderExample();
        renderTargets();
        notify('preset loaded', 'success');
      }};

      el('importPreset').onclick = () => {{
        const raw = prompt('Paste preset JSON (can include recommendedTargets for multi-domain)') || '';
        if (!raw.trim()) return;
        try {{
          const parsed = JSON.parse(raw);
          if (!parsed || typeof parsed !== 'object') {{
            notify('preset JSON must be an object', 'error');
            return;
          }}
          const pr = parsed;
          const config = {{ pagination: pr.pagination, listing: pr.listing, details: pr.details }};
          const targets = Array.isArray(pr.recommendedTargets) ? pr.recommendedTargets : (Array.isArray(pr.targets) ? pr.targets : null);
          if (targets && targets.length) {{
            state.targets = targets.map(x => ({{...x, maxPosts: x.maxPosts ?? 0, useSelenium: !!x.useSelenium, config }}));
          }} else {{
            state.targets = [{{ 
              baseUrl: normalizeTextInput(pr.baseUrl || 'https://mmsbaba.com'), 
              pageLimit: pr.pageLimit ?? 1, 
              maxPosts: pr.maxPosts ?? 0,
              query: pr.query || '', 
              mode: pr.mode || 'details', 
              autoPublish: !!pr.autoPublish,
              useSelenium: !!pr.useSelenium,
              config,
            }}];
          }}
          renderExample();
          renderTargets();
          notify('preset imported', 'success');
        }} catch {{
          notify('preset JSON invalid', 'error');
        }}
      }};

      function serializeTargets() {{
        const out = [];
        for (const t of (state.targets || [])) {{
          if (!t || typeof t !== 'object') continue;
          out.push(serializeTarget(t));
        }}
        return out;
      }}

      function serializeTarget(t) {{
        const cfg = normalizeConfigObject(t.config || {{}});
        return {{
          ...t,
          baseUrl: normalizeTextInput(t.baseUrl || ''),
          config: cfg,
        }};
      }}

      el('runNow').onclick = async () => {{
        notify('starting run...', 'info');
        const r = await apiPost('api/runs', {{ targets: serializeTargets() }});
        if (r.ok && r.data?.runId) {{
          notify('run accepted ' + r.data.runId, 'success');
          await refreshRuns();
          await loadRun(r.data.runId);
        }} else {{
          notify('run failed ' + (r.error || ''), 'error');
        }}
      }};

      el('runAllJobs').onclick = async () => {{
        notify('running all jobs...', 'info');
        const jr = await apiGet('api/jobs');
        const jobs = Array.isArray(jr.data) ? jr.data : [];
        if (!jobs.length) {{
          notify('no jobs found', 'error');
          return;
        }}
        let okCount = 0;
        let failCount = 0;
        for (const j of jobs) {{
          const rr = await apiPost('api/jobs/' + j.id + '/run', {{}});
          if (rr.ok) okCount++;
          else failCount++;
        }}
        notify('jobs run requested ok=' + okCount + ' failed=' + failCount, failCount ? 'error' : 'success');
        await refreshRuns();
      }};

      el('createJob').onclick = async () => {{
        const name = el('jobName').value || '';
        const intervalSeconds = el('jobInterval').value ? Number(el('jobInterval').value) : null;
        const runAtLocal = el('jobRunAt').value || '';
        const runAt = runAtLocal ? new Date(runAtLocal).toISOString() : null;
        const payload = {{ name, intervalSeconds, runAt, targets: serializeTargets() }};
        if (state.editJobId) {{
          notify('saving job...', 'info');
          const r = await apiPost('api/jobs/' + state.editJobId, payload);
          notify(r.ok ? 'job updated' : ('job update failed ' + (r.error || '')), r.ok ? 'success' : 'error');
          if (r.ok) {{
            state.editJobId = '';
            el('createJob').textContent = 'Create Scheduled Job';
          }}
        }} else {{
          notify('creating job...', 'info');
          const r = await apiPost('api/jobs', payload);
          notify(r.ok ? ('job created ' + (r.data?.id || '')) : ('job create failed ' + (r.error || '')), r.ok ? 'success' : 'error');
        }}
        await refreshJobs();
      }};

      el('refresh').onclick = async () => {{
        notify('refreshing...', 'info');
        await refreshRuns();
        await refreshJobs();
        notify('refreshed', 'success');
      }};

      el('copyResult').onclick = async () => {{
        const t = el('result').value || '';
        if (!t) return;
        try {{
          await navigator.clipboard.writeText(t);
          notify('copied', 'success');
        }} catch {{
          notify('copy failed', 'error');
        }}
      }};

      el('publishSanity').onclick = async () => {{
        if (!state.selectedRunId) {{
          notify('select a run first', 'error');
          return;
        }}
        notify('publishing...', 'info');
        const publishPath = '/api/admin/scraper/publish-sanity';
        const isLocalScraper = location.port === '4000' && (location.hostname === 'localhost' || location.hostname === '127.0.0.1');
        const publishUrl = isLocalScraper ? `${{location.protocol}}//${{location.hostname}}:3000${{publishPath}}` : publishPath;
        const r = await apiPost(publishUrl, {{ runId: state.selectedRunId }});
        const d = r.data || {{}};
        notify(r.ok ? (`published posted=${{d.posted || 0}} skipped=${{d.skipped || 0}} failed=${{d.failed || 0}}`) : ('publish failed ' + (r.error || '')), r.ok ? 'success' : 'error');
        await loadLog();
      }};

      el('loadLog').onclick = loadLog;
      el('loadProgress').onclick = loadProgress;

      renderPresets();
      renderExample();
      state.targets = [defaultTarget()];
      renderTargets();
      refreshRuns();
      refreshJobs();
      loadLog();
      loadProgress();
      setInterval(() => {{
        refreshRuns();
      }}, 2000);
      setInterval(() => {{
        loadLog();
      }}, 2500);
      setInterval(() => {{
        loadProgress();
      }}, 1200);
    </script>
  </body>
</html>"""

    @app.get('/api/presets')
    def api_presets():
        return jsonify({'ok': True, 'data': presets()})

    @app.post('/api/publishable-posts')
    def api_publishable_posts():
        try:
            data = request.get_json(silent=True) or {}
            run_id = str(data.get('runId') or '').strip()
            target_index = data.get('targetIndex')
            if target_index is not None:
                try:
                    target_index = int(target_index)
                except Exception:
                    target_index = None
            if not run_id:
                return jsonify({'ok': False, 'error': 'runId required'}), 400
            row = get_run_row(run_id)
            if not row:
                return jsonify({'ok': False, 'error': 'run not found'}), 404
            row = dict(row)
            result = None
            if row.get('result_json'):
                try:
                    result = json.loads(row['result_json'])
                except Exception:
                    result = None
            posts = flatten_run_posts(result, target_index=target_index)
            if not posts:
                return jsonify({'ok': False, 'error': 'no posts in run result'}), 400
            out_posts = []
            for p in posts:
                if not isinstance(p, dict):
                    continue
                link = p.get('link')
                video_src = p.get('video_src') or p.get('video_url')
                if not link or not video_src:
                    continue
                out_posts.append(
                    {
                        'title': p.get('title'),
                        'link': link,
                        'image_url': p.get('image_url'),
                        'meta_description': p.get('meta_description'),
                        'og_title': p.get('og_title'),
                        'og_description': p.get('og_description'),
                        'video_src': video_src,
                        'slinks_texts': p.get('slinks_texts') or [],
                    }
                )
            if not out_posts:
                return jsonify({'ok': False, 'error': 'no publishable posts (missing link/video_src)'}), 400
            return jsonify({'ok': True, 'data': {'count': len(out_posts), 'posts': out_posts}})
        except Exception as e:
            return jsonify({'ok': False, 'error': str(e)}), 500

    @app.get('/api/media')
    def api_media():
        try:
            from urllib.parse import urlparse
            from flask import Response
            import ipaddress

            url = str(request.args.get('url') or '').strip()
            referer = str(request.args.get('referer') or '').strip()
            if not url:
                return jsonify({'ok': False, 'error': 'url required'}), 400
            p = urlparse(url)
            if p.scheme not in ('http', 'https') or not p.netloc:
                return jsonify({'ok': False, 'error': 'invalid url'}), 400
            host = (p.hostname or '').strip().lower()
            if not host:
                return jsonify({'ok': False, 'error': 'invalid url'}), 400
            if host in ('localhost', '127.0.0.1', '0.0.0.0', '::1'):
                return jsonify({'ok': False, 'error': 'blocked host'}), 400
            try:
                ip = ipaddress.ip_address(host)
                if ip.is_private or ip.is_loopback or ip.is_link_local:
                    return jsonify({'ok': False, 'error': 'blocked host'}), 400
            except Exception:
                pass

            if referer:
                rp = urlparse(referer)
                rh = (rp.hostname or '').strip().lower()
                if rh and rh != host:
                    return jsonify({'ok': False, 'error': 'referer host mismatch'}), 400

            scraper = make_scraper()
            headers = {}
            if referer:
                headers['Referer'] = referer
            r = scraper.get(url, headers=headers, timeout=90, stream=True)
            if r.status_code != 200:
                return jsonify({'ok': False, 'error': f'fetch_failed status={r.status_code}'}), 502

            def gen():
                for chunk in r.iter_content(chunk_size=1024 * 64):
                    if chunk:
                        yield chunk

            ct = r.headers.get('content-type') or 'application/octet-stream'
            return Response(gen(), mimetype=ct)
        except Exception as e:
            return jsonify({'ok': False, 'error': str(e)}), 500

    @app.post('/api/publish-sanity')
    def api_publish_sanity():
        return jsonify({'ok': False, 'error': 'publishing moved to web API'}), 410

    @app.get('/health')
    def health():
        return jsonify({'ok': True})

    @app.get('/progress')
    def progress():
        return jsonify({'ok': True, 'data': read_progress()})

    @app.post('/config')
    def config_set():
        data = request.get_json(silent=True) or {}
        base_url = str(data.get('baseUrl') or data.get('base_url') or '').strip()
        interval = data.get('intervalSeconds') or data.get('interval_seconds')
        cfg = {}
        if base_url:
            cfg['SCRAPER_BASE_URL'] = base_url
        if interval is not None and str(interval).strip() != '':
            try:
                cfg['DAILY_INTERVAL_SECONDS'] = int(interval)
            except Exception:
                pass
        try:
            with open(os.path.join(runtime_dir, 'scraper-config.json'), 'w', encoding='utf-8') as f:
                json.dump(cfg, f, ensure_ascii=False, indent=2)
        except Exception:
            pass
        return jsonify({'updated': True, 'config': cfg})

    @app.post('/run')
    def run_legacy():
        data = request.get_json(silent=True) or {}
        base_url = str(data.get('baseUrl') or data.get('base_url') or '').strip()
        page_limit = int(data.get('pageLimit') or data.get('page_limit') or 1)
        payload = {'targets': [{'baseUrl': base_url, 'pageLimit': page_limit}], 'jobId': None}
        run_id = create_run(None, payload)
        threading.Thread(target=run_worker, args=(run_id, payload), daemon=True).start()
        return jsonify({'accepted': True, 'runId': run_id}), 202

    @app.get('/api/jobs')
    def jobs_list():
        conn = db()
        cur = conn.cursor()
        cur.execute("SELECT * FROM jobs ORDER BY created_at DESC LIMIT 100")
        rows = [dict(r) for r in cur.fetchall()]
        conn.close()
        for j in rows:
            j['targets'] = json.loads(j.get('targets_json') or '[]')
            j.pop('targets_json', None)
        return jsonify({'ok': True, 'data': rows})

    @app.post('/api/jobs')
    def jobs_create():
        data = request.get_json(silent=True) or {}
        targets = data.get('targets') or []
        interval = data.get('intervalSeconds') or data.get('interval_seconds')
        run_at = data.get('runAt') or data.get('run_at')
        job_id = uuid.uuid4().hex
        created = utc_now_iso()
        next_run_at = None
        dt = parse_dt(run_at)
        if dt:
            next_run_at = dt.astimezone(timezone.utc).isoformat()
        elif interval and int(interval) > 0:
            next_run_at = (datetime.now(timezone.utc).timestamp() + int(interval))
            next_run_at = datetime.fromtimestamp(next_run_at, tz=timezone.utc).isoformat()
        conn = db()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO jobs (id, name, targets_json, interval_seconds, run_at, next_run_at, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                job_id,
                str(data.get('name') or ''),
                json_dumps(targets),
                int(interval) if interval is not None and str(interval).strip() != '' else None,
                run_at if run_at else None,
                next_run_at,
                1,
                created,
                created,
            ),
        )
        conn.commit()
        conn.close()
        return jsonify({'ok': True, 'data': {'id': job_id}})

    @app.post('/api/jobs/<job_id>')
    def jobs_update(job_id):
        data = request.get_json(silent=True) or {}
        targets = data.get('targets') or []
        interval = data.get('intervalSeconds') or data.get('interval_seconds')
        run_at = data.get('runAt') or data.get('run_at')
        name = str(data.get('name') or '')
        updated = utc_now_iso()
        next_run_at = None
        dt = parse_dt(run_at)
        if dt:
            next_run_at = dt.astimezone(timezone.utc).isoformat()
        elif interval and int(interval) > 0:
            next_run_at = (datetime.now(timezone.utc).timestamp() + int(interval))
            next_run_at = datetime.fromtimestamp(next_run_at, tz=timezone.utc).isoformat()
        conn = db()
        cur = conn.cursor()
        cur.execute("SELECT id FROM jobs WHERE id=?", (job_id,))
        row = cur.fetchone()
        if not row:
            conn.close()
            return jsonify({'ok': False, 'error': 'not_found'}), 404
        cur.execute(
            "UPDATE jobs SET name=?, targets_json=?, interval_seconds=?, run_at=?, next_run_at=?, updated_at=? WHERE id=?",
            (
                name,
                json_dumps(targets),
                int(interval) if interval is not None and str(interval).strip() != '' else None,
                run_at if run_at else None,
                next_run_at,
                updated,
                job_id,
            ),
        )
        conn.commit()
        conn.close()
        return jsonify({'ok': True, 'data': {'id': job_id}})

    @app.delete('/api/jobs/<job_id>')
    def jobs_delete(job_id):
        conn = db()
        cur = conn.cursor()
        cur.execute("SELECT id FROM jobs WHERE id=?", (job_id,))
        row = cur.fetchone()
        if not row:
            conn.close()
            return jsonify({'ok': False, 'error': 'not_found'}), 404
        cur.execute("DELETE FROM jobs WHERE id=?", (job_id,))
        conn.commit()
        conn.close()
        return jsonify({'ok': True, 'data': {'id': job_id}})

    @app.post('/api/jobs/<job_id>/run')
    def jobs_run(job_id):
        conn = db()
        cur = conn.cursor()
        cur.execute("SELECT id, targets_json FROM jobs WHERE id=?", (job_id,))
        row = cur.fetchone()
        conn.close()
        if not row:
            return jsonify({'ok': False, 'error': 'not_found'}), 404
        payload = {'targets': json.loads(row['targets_json'] or '[]'), 'jobId': job_id}
        run_id = create_run(job_id, payload)
        threading.Thread(target=run_worker, args=(run_id, payload), daemon=True).start()
        return jsonify({'ok': True, 'data': {'runId': run_id}}), 202

    @app.post('/api/runs')
    def runs_create():
        data = request.get_json(silent=True) or {}
        payload = {'targets': data.get('targets') or [], 'jobId': None}
        run_id = create_run(None, payload)
        threading.Thread(target=run_worker, args=(run_id, payload), daemon=True).start()
        return jsonify({'ok': True, 'data': {'runId': run_id}}), 202

    @app.get('/api/runs')
    def runs_list():
        conn = db()
        cur = conn.cursor()
        cur.execute("SELECT id, job_id, status, started_at, finished_at, error FROM runs ORDER BY started_at DESC, rowid DESC LIMIT 100")
        rows = [dict(r) for r in cur.fetchall()]
        conn.close()
        return jsonify({'ok': True, 'data': rows})

    @app.get('/api/runs/<run_id>')
    def runs_get(run_id):
        conn = db()
        cur = conn.cursor()
        cur.execute("SELECT * FROM runs WHERE id=?", (run_id,))
        row = cur.fetchone()
        conn.close()
        if not row:
            return jsonify({'ok': False, 'error': 'not_found'}), 404
        out = dict(row)
        out['request'] = json.loads(out.get('request_json') or '{}')
        out.pop('request_json', None)
        if out.get('result_json'):
            try:
                out['result'] = json.loads(out['result_json'])
            except Exception:
                out['result'] = None
        out.pop('result_json', None)
        return jsonify({'ok': True, 'data': out})

    @app.post('/api/runs/<run_id>/stop')
    def runs_stop(run_id):
        row = get_run_row(run_id)
        if not row:
            return jsonify({'ok': False, 'error': 'not_found'}), 404
        status = None
        try:
            status = row['status']
        except Exception:
            try:
                status = dict(row).get('status')
            except Exception:
                status = None
        err = None
        if status == 'running':
            try:
                set_run_status(run_id, 'canceling')
            except Exception as e:
                err = 'status_update_failed'
                try:
                    append_log(f'{utc_now_iso()} run={run_id} stop set_run_status failed: {e}', live=True)
                except Exception:
                    pass
            try:
                patch_progress({'runId': run_id, 'phase': 'run_canceling'})
            except Exception as e:
                err = err or 'progress_update_failed'
                try:
                    append_log(f'{utc_now_iso()} run={run_id} stop patch_progress failed: {e}', live=True)
                except Exception:
                    pass

        pid = None
        try:
            pid = request_cancel(run_id)
        except Exception as e:
            err = err or 'cancel_failed'
            try:
                append_log(f'{utc_now_iso()} run={run_id} stop request_cancel failed: {e}', live=True)
            except Exception:
                pass

        if status in ('running', 'canceling') and not pid:
            try:
                with cancel_lock:
                    has_active = run_id in active_run_procs
                if not has_active:
                    finished = utc_now_iso()
                    try:
                        set_run_status(run_id, 'canceled', finished_at=finished, error='canceled')
                    except Exception as e:
                        err = err or 'status_update_failed'
                        try:
                            append_log(f'{utc_now_iso()} run={run_id} stop finalize set_run_status failed: {e}', live=True)
                        except Exception:
                            pass
                    try:
                        pr = read_progress()
                        if isinstance(pr, dict) and pr.get('runId') == run_id:
                            patch_progress({'running': False, 'phase': 'run_canceled', 'finishedAt': finished})
                    except Exception:
                        pass
            except Exception as e:
                err = err or 'finalize_failed'
                try:
                    append_log(f'{utc_now_iso()} run={run_id} stop finalize failed: {e}', live=True)
                except Exception:
                    pass

        if err:
            return jsonify({'ok': False, 'error': err, 'data': {'pid': pid}})
        return jsonify({'ok': True, 'data': {'pid': pid}})

    @app.post('/api/runs/<run_id>/resume')
    def runs_resume(run_id):
        row = get_run_row(run_id)
        if not row:
            return jsonify({'ok': False, 'error': 'not_found'}), 404
        payload = {}
        try:
            payload = json.loads(row['request_json'] or '{}')
        except Exception:
            payload = {}
        job_id = None
        try:
            job_id = row['job_id']
        except Exception:
            try:
                job_id = dict(row).get('job_id')
            except Exception:
                job_id = None
        new_run_id = create_run(job_id, payload)
        threading.Thread(target=run_worker, args=(new_run_id, payload), daemon=True).start()
        return jsonify({'ok': True, 'data': {'runId': new_run_id}}), 202

    @app.delete('/api/runs/<run_id>')
    def runs_delete(run_id):
        row = get_run_row(run_id)
        if not row:
            return jsonify({'ok': False, 'error': 'not_found'}), 404
        if row['status'] == 'running':
            return jsonify({'ok': False, 'error': 'running'}), 409
        conn = db()
        cur = conn.cursor()
        cur.execute("DELETE FROM runs WHERE id=?", (run_id,))
        conn.commit()
        conn.close()
        return jsonify({'ok': True})

    @app.post('/api/runs/<run_id>/mark-published')
    def runs_mark_published(run_id):
        data = request.get_json(silent=True) or {}
        links = set(data.get('links') or [])
        if not links:
             return jsonify({'ok': True, 'count': 0})
        
        row = get_run_row(run_id)
        if not row:
            return jsonify({'ok': False, 'error': 'not_found'}), 404
        
        # Load result_json
        result = None
        try:
            result = json.loads(row['result_json'] or '{}')
        except:
            result = {}
        
        updated_count = 0
        targets = result.get('targets')
        if isinstance(targets, list):
            for t in targets:
                if isinstance(t, dict):
                    posts = t.get('posts')
                    if isinstance(posts, list):
                        for p in posts:
                            if isinstance(p, dict) and p.get('link') in links:
                                if not p.get('published'):
                                    p['published'] = True
                                    updated_count += 1
        
        if updated_count > 0:
            conn = db()
            cur = conn.cursor()
            cur.execute("UPDATE runs SET result_json=? WHERE id=?", (json_dumps(result), run_id))
            conn.commit()
            conn.close()
            
        return jsonify({'ok': True, 'count': updated_count})

    @app.get('/<path:filename>')
    def get_file(filename):
        if filename not in allowed_files:
            return jsonify({'ok': False, 'error': 'not_found'}), 404
        return send_from_directory(runtime_dir, filename)

    port = int(os.environ.get('SCRAPER_PORT', '4000'))
    host = os.environ.get('SCRAPER_HOST', '0.0.0.0')
    dev_reload = os.environ.get('SCRAPER_DEV_RELOAD', '0') == '1'
    app.run(host=host, port=port, threaded=True, debug=dev_reload, use_reloader=dev_reload)

if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'server':
        run_flask_server()
        raise SystemExit(0)
    mode_probe = os.environ.get('PROBE', '0') == '1'
    mode_list = os.environ.get('LIST', '0') == '1'
    mode_details = os.environ.get('DETAILS', '0') == '1'
    if mode_probe:
        def probe_structure(url):
            scraper = make_scraper()
            html = fetch_html(scraper, url, BASE_URL) or ''
            save_debug_html(url, html)
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(html, 'lxml')
            body_ok = bool(soup.select_one('body'))
            box_ok = bool(soup.select_one('body div.box'))
            main_ok = bool(soup.select_one('main#primary.site-main'))
            videos = soup.select(LIST_ENTRY_SELECTOR) if LIST_ENTRY_SELECTOR else []
            videos_ok = len(videos) > 0
            videos_count = len(videos)
            result = {
                'body_found': body_ok,
                'box_found': box_ok,
                'main_found': main_ok,
                'videos_found': videos_ok,
                'videos_count': videos_count,
            }
            with open(os.path.join(OUTPUT_DIR, 'structure-probe.json'), 'w', encoding='utf-8') as f:
                json.dump(result, f, ensure_ascii=False, indent=2)
            print(json.dumps(result, ensure_ascii=False))
        probe_structure(BASE_URL)
        remove_debug_pages()
    elif mode_list:
        def extract_listing(url):
            scraper = make_scraper()
            html = fetch_html(scraper, url, BASE_URL)
            save_debug_html(url, html or '')
            posts = parse_listing(html or '')
            with open(os.path.join(OUTPUT_DIR, 'listing-posts.json'), 'w', encoding='utf-8') as f:
                json.dump({'count': len(posts), 'posts': posts}, f, ensure_ascii=False, indent=2)
            print(json.dumps({'count': len(posts)}, ensure_ascii=False))
        page_env = os.environ.get('PAGE')
        if page_env and page_env.isdigit():
            target_url = build_page_url(int(page_env))
        else:
            target_url = build_page_url(1)
        extract_listing(target_url)
        remove_debug_pages()
    elif mode_details:
        def extract_details(posts):
            scraper = make_scraper()
            results = []
            total = len(posts or [])
            existing_by_link = {}
            try:
                details_path = os.path.join(OUTPUT_DIR, 'post-details.json')
                if os.path.exists(details_path):
                    with open(details_path, 'r', encoding='utf-8') as pf:
                        prev = json.load(pf) or {}
                    prev_posts = prev.get('posts') if isinstance(prev, dict) else None
                    if isinstance(prev_posts, list):
                        for pp in prev_posts:
                            if not isinstance(pp, dict):
                                continue
                            lk = pp.get('link')
                            if lk:
                                existing_by_link[str(lk)] = pp
            except Exception:
                existing_by_link = {}

            existing_results = [None] * total
            done_count = 0
            for i, p in enumerate(posts or []):
                if not isinstance(p, dict):
                    continue
                lk = p.get('link')
                if not lk:
                    continue
                prev = existing_by_link.get(str(lk))
                if isinstance(prev, dict):
                    existing_results[i] = prev
                    done_count += 1

            start_idx = 0
            start_idx_env = str(os.environ.get('DETAILS_START_INDEX', '') or '').strip()
            if start_idx_env.isdigit():
                start_idx = max(0, int(start_idx_env))
            else:
                for i in range(total):
                    if existing_results[i] is None:
                        start_idx = i
                        break
                else:
                    start_idx = total

            results = existing_results
            last_flush = 0
            for idx in range(start_idx, total):
                p = posts[idx] if isinstance(posts, list) else None
                if not isinstance(p, dict):
                    continue
                url = p.get('link')
                image_url = p.get('image_url')
                title = p.get('title')
                write_external_progress(
                    {
                        'running': True,
                        'phase': 'details',
                        'detailsIndex': idx,
                        'detailsTotal': total,
                        'detailsCompleted': done_count,
                        'currentPostUrl': url,
                    }
                )
                if results[idx] is not None:
                    continue
                html = fetch_html(scraper, url, BASE_URL, wait_css=DETAILS_VIDEO_SELECTOR or 'video, main#primary.site-main')
                save_debug_html(url, html or '')
                if not html:
                    results[idx] = (
                        {
                            'title': clean_text(title),
                            'link': url,
                            'image_url': image_url,
                            'meta_description': None,
                            'og_title': None,
                            'og_description': None,
                            'video_src': None,
                            'slinks_texts': [],
                            'error': 'Failed to fetch HTML',
                        }
                    )
                    done_count += 1
                    continue
                from bs4 import BeautifulSoup
                soup = BeautifulSoup(html, 'lxml')
                ttag = soup.select_one('head title')
                mdesc = soup.select_one(META_DESCRIPTION_SELECTOR) if META_DESCRIPTION_SELECTOR else None
                ogt = soup.select_one(OG_TITLE_SELECTOR) if OG_TITLE_SELECTOR else None
                ogd = soup.select_one(OG_DESCRIPTION_SELECTOR) if OG_DESCRIPTION_SELECTOR else None
                meta_description = clean_text(mdesc.get('content') if mdesc else '')
                og_title = clean_text((ogt.get('content') if ogt else '') or (ttag.get_text(strip=True) if ttag else ''))
                og_description = clean_text((ogd.get('content') if ogd else '') or meta_description)
                video_src = extract_video_url_from_soup(soup, html=html)
                slinks_texts = extract_tags_texts_from_soup(soup)
                results[idx] = {
                    'title': clean_text(title),
                    'link': url,
                    'image_url': image_url,
                    'meta_description': meta_description,
                    'og_title': og_title,
                    'og_description': og_description,
                    'video_src': video_src,
                    'slinks_texts': slinks_texts
                }
                done_count += 1
                if (idx - last_flush) >= 5 or idx == (total - 1):
                    try:
                        with open(os.path.join(OUTPUT_DIR, 'post-details.json'), 'w', encoding='utf-8') as f:
                            json.dump({'count': done_count, 'posts': [r for r in results if isinstance(r, dict)]}, f, ensure_ascii=False, indent=2)
                        last_flush = idx
                    except Exception:
                        pass
                delay(600)
            final_posts = []
            for i, p in enumerate(posts or []):
                r = results[i]
                if isinstance(r, dict):
                    final_posts.append(r)
                    continue
                if isinstance(p, dict):
                    final_posts.append(
                        {
                            'title': clean_text(p.get('title')),
                            'link': p.get('link'),
                            'image_url': p.get('image_url'),
                            'meta_description': None,
                            'og_title': None,
                            'og_description': None,
                            'video_src': None,
                            'slinks_texts': [],
                            'error': 'Missing details',
                        }
                    )
            with open(os.path.join(OUTPUT_DIR, 'post-details.json'), 'w', encoding='utf-8') as f:
                json.dump({'count': len(final_posts), 'posts': final_posts}, f, ensure_ascii=False, indent=2)
            print(json.dumps({'count': len(final_posts)}, ensure_ascii=False))
            write_external_progress(
                {
                    'running': False,
                    'phase': 'details_done',
                    'detailsTotal': total,
                    'detailsCompleted': len(final_posts),
                    'finishedAt': time.strftime('%Y-%m-%d %H:%M:%S'),
                }
            )
        listing_path = os.path.join(OUTPUT_DIR, 'listing-posts.json')
        with open(listing_path, 'r', encoding='utf-8') as f:
            listing = json.load(f)
        extract_details(listing.get('posts', []))
        remove_debug_pages()
    else:
        scrape()
        remove_debug_pages()
