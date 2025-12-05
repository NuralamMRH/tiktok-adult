import os
import re
import json
import time
from urllib.parse import urljoin

BASE_URL = 'https://mmsbaba.com'
LAST_PAGE = 188
PAGE_LIMIT = int(os.environ.get('PAGE_LIMIT', str(LAST_PAGE)))
SAVE_DEBUG = os.environ.get('SAVE_DEBUG_HTML', '0') == '1'
OUTPUT_DIR = os.path.dirname(__file__)

def delay(ms):
    time.sleep(ms / 1000.0)

def clean_text(s):
    if not s:
        return ''
    s = re.sub(r"\s*–?\s*MmsBaba\.Com\s*$", '', s, flags=re.I)
    s = re.sub(r"mmsbaba\.com", '', s, flags=re.I)
    s = s.replace('\u2018', '').replace('\u2019', '').replace('\u201C', '').replace('\u201D', '')
    return s.strip()

def make_scraper():
    import cloudscraper
    scraper = cloudscraper.create_scraper(browser={'browser': 'chrome', 'platform': 'windows', 'mobile': False})
    scraper.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
    })
    return scraper

def fetch_html(scraper, url, referer=None):
    for attempt in range(1, 4):
        try:
            headers = {}
            if referer:
                headers['Referer'] = referer
            res = scraper.get(url, headers=headers, timeout=30)
            if res.status_code == 200:
                return res.text
        except Exception:
            pass
        delay(800 * attempt + 1200)
    try:
        import undetected_chromedriver as uc
        from selenium.webdriver.common.by import By
        from selenium.webdriver.support.ui import WebDriverWait
        from selenium.webdriver.support import expected_conditions as EC
        options = uc.ChromeOptions()
        options.add_argument('--headless=new')
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-setuid-sandbox')
        options.add_argument('--disable-blink-features=AutomationControlled')
        ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'
        options.add_argument(f'--user-agent={ua}')
        proxy = os.environ.get('PROXY_SERVER')
        if proxy:
            options.add_argument(f'--proxy-server={proxy}')
        driver = uc.Chrome(options=options)
        driver.set_page_load_timeout(60)
        driver.get(url)
        try:
            WebDriverWait(driver, 15).until(EC.presence_of_element_located((By.CSS_SELECTOR, '.videos a.video')))
        except Exception:
            pass
        delay(600)
        html = driver.page_source
        driver.quit()
        return html
    except Exception:
        pass
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
    for a in soup.select('div.videos a.video'):
        href = a.get('href')
        style = a.get('style') or ''
        m = re.search(r"background-image:\s*url\(['\"]?(.*?)['\"]?\)", style, flags=re.I)
        image_url = m.group(1) if m else None
        title_attr = a.get('title') or ''
        h2 = a.select_one('h2.vtitle')
        title_text = h2.get_text(strip=True) if h2 else ''
        title = clean_text(title_attr or title_text or '')
        if href and href.startswith('http'):
            items.append({'title': title or 'No Title', 'link': href, 'image_url': image_url})
    return items

def parse_post(html, post_url, post_title, listing_image):
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html, 'lxml')
    title_tag = soup.select_one('head title')
    meta_desc_tag = soup.select_one('meta[name="description"]')
    og_title_tag = soup.select_one('meta[property="og:title"]')
    og_desc_tag = soup.select_one('meta[property="og:description"]')
    title_tag_text = title_tag.get_text(strip=True) if title_tag else ''
    meta_desc = meta_desc_tag.get('content') if meta_desc_tag else ''
    og_title = og_title_tag.get('content') if og_title_tag else ''
    og_desc = og_desc_tag.get('content') if og_desc_tag else ''
    video_url = None
    for v in soup.select('video'):
        src = v.get('src') or v.get('data-src')
        if src and ('.mp4' in src or '.mov' in src):
            video_url = src if src.startswith('http') else urljoin(BASE_URL, src)
            break
        s = v.select_one('source')
        if s:
            src = s.get('src') or s.get('data-src')
            if src and ('.mp4' in src or '.mov' in src):
                video_url = src if src.startswith('http') else urljoin(BASE_URL, src)
                break
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
        'posts_with_videos': len([p for p in posts if p.get('video_url')]),
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
    existing_links = set([p.get('link') for p in existing['posts'] if p.get('link')])
    new_results = []
    pages_processed = 0
    for page in range(1, PAGE_LIMIT + 1):
        if len(new_results) >= 100:
            break
        page_url = BASE_URL if page == 1 else f"{BASE_URL}/page/{page}/"
        html = fetch_html(scraper, page_url, BASE_URL)
        save_debug_html(page_url, html)
        if not html:
            continue
        pages_processed += 1
        items = parse_listing(html)
        filtered = [i for i in items if i['link'] not in existing_links]
        for post in filtered:
            if len(new_results) >= 100:
                break
            post_html = fetch_html(scraper, post['link'], BASE_URL)
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
            delay(800)
        delay(1200)
    tags = scrape_tags(scraper)
    merged_posts = existing['posts'] + new_results
    write_results(merged_posts, tags, {
        'pages_completed': pages_processed,
        'page_limit': PAGE_LIMIT,
        'last_run_at': time.strftime('%Y-%m-%d %H:%M:%S')
    })
    return merged_posts

if __name__ == '__main__':
    mode_probe = os.environ.get('PROBE', '0') == '1'
    mode_list = os.environ.get('LIST', '0') == '1'
    mode_details = os.environ.get('DETAILS', '0') == '1'
    if mode_probe:
        def probe_structure(url):
            import undetected_chromedriver as uc
            from selenium.webdriver.common.by import By
            from selenium.webdriver.support.ui import WebDriverWait
            from selenium.webdriver.support import expected_conditions as EC
            options = uc.ChromeOptions()
            options.add_argument('--headless=new')
            options.add_argument('--no-sandbox')
            options.add_argument('--disable-setuid-sandbox')
            options.add_argument('--disable-blink-features=AutomationControlled')
            ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'
            options.add_argument(f'--user-agent={ua}')
            proxy = os.environ.get('PROXY_SERVER')
            if proxy:
                options.add_argument(f'--proxy-server={proxy}')
            driver = uc.Chrome(options=options)
            driver.set_page_load_timeout(60)
            driver.get(url)
            body_ok = False
            box_ok = False
            main_ok = False
            videos_ok = False
            videos_count = 0
            try:
                WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.TAG_NAME, 'body')))
                body_ok = True
            except Exception:
                body_ok = False
            try:
                WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.CSS_SELECTOR, 'body div.box')))
                box_ok = True
            except Exception:
                box_ok = False
            try:
                WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.CSS_SELECTOR, 'main#primary.site-main')))
                main_ok = True
            except Exception:
                main_ok = False
            try:
                WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.CSS_SELECTOR, 'div.videos')))
                videos_ok = True
            except Exception:
                videos_ok = False
            if videos_ok:
                elems = driver.find_elements(By.CSS_SELECTOR, 'div.videos a.video')
                videos_count = len(elems)
            html = driver.page_source
            save_debug_html(url, html)
            driver.quit()
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
            import undetected_chromedriver as uc
            from selenium.webdriver.common.by import By
            from selenium.webdriver.support.ui import WebDriverWait
            from selenium.webdriver.support import expected_conditions as EC
            options = uc.ChromeOptions()
            options.add_argument('--headless=new')
            options.add_argument('--no-sandbox')
            options.add_argument('--disable-setuid-sandbox')
            options.add_argument('--disable-blink-features=AutomationControlled')
            ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'
            options.add_argument(f'--user-agent={ua}')
            proxy = os.environ.get('PROXY_SERVER')
            if proxy:
                options.add_argument(f'--proxy-server={proxy}')
            driver = uc.Chrome(options=options)
            driver.set_page_load_timeout(60)
            driver.get(url)
            try:
                WebDriverWait(driver, 15).until(EC.presence_of_element_located((By.CSS_SELECTOR, 'div.videos a.video')))
            except Exception:
                pass
            posts = []
            anchors = driver.find_elements(By.CSS_SELECTOR, 'div.videos a.video')
            for a in anchors:
                href = a.get_attribute('href')
                style = a.get_attribute('style') or ''
                m = re.search(r"background-image:\s*url\(['\"]?(.*?)['\"]?\)", style, flags=re.I)
                image_url = m.group(1) if m else None
                title_attr = a.get_attribute('title') or ''
                try:
                    title_text = a.find_element(By.CSS_SELECTOR, 'h2.vtitle').text.strip()
                except Exception:
                    title_text = ''
                title = clean_text(title_attr or title_text or '')
                if href:
                    posts.append({'image_url': image_url, 'link': href, 'title': title or 'No Title'})
            html = driver.page_source
            save_debug_html(url, html)
            driver.quit()
            with open(os.path.join(OUTPUT_DIR, 'listing-posts.json'), 'w', encoding='utf-8') as f:
                json.dump({'count': len(posts), 'posts': posts}, f, ensure_ascii=False, indent=2)
            print(json.dumps({'count': len(posts)}, ensure_ascii=False))
        page_env = os.environ.get('PAGE')
        if page_env and page_env.isdigit() and int(page_env) > 1:
            target_url = f"{BASE_URL}/page/{int(page_env)}/"
        else:
            target_url = BASE_URL
        extract_listing(target_url)
        remove_debug_pages()
    elif mode_details:
        def extract_details(posts):
            import undetected_chromedriver as uc
            from selenium.webdriver.common.by import By
            from selenium.webdriver.support.ui import WebDriverWait
            from selenium.webdriver.support import expected_conditions as EC
            options = uc.ChromeOptions()
            options.add_argument('--headless=new')
            options.add_argument('--no-sandbox')
            options.add_argument('--disable-setuid-sandbox')
            options.add_argument('--disable-blink-features=AutomationControlled')
            ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'
            options.add_argument(f'--user-agent={ua}')
            proxy = os.environ.get('PROXY_SERVER')
            if proxy:
                options.add_argument(f'--proxy-server={proxy}')
            driver = uc.Chrome(options=options)
            driver.set_page_load_timeout(60)
            results = []
            for p in posts:
                url = p.get('link')
                image_url = p.get('image_url')
                title = p.get('title')
                try:
                    driver.get(url)
                    WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.TAG_NAME, 'body')))
                except Exception:
                    save_debug_html(url, driver.page_source if 'page_source' in dir(driver) else '')
                    results.append({
                        'title': clean_text(title),
                        'link': url,
                        'image_url': image_url,
                        'meta_description': None,
                        'og_title': None,
                        'og_description': None,
                        'video_src': None,
                        'slinks_texts': [],
                        'error': 'Load failed'
                    })
                    continue
                html = driver.page_source
                save_debug_html(url, html)
                from bs4 import BeautifulSoup
                soup = BeautifulSoup(html, 'lxml')
                ttag = soup.select_one('head title')
                mdesc = soup.select_one('meta[name="description"]')
                ogt = soup.select_one('meta[property="og:title"]')
                ogd = soup.select_one('meta[property="og:description"]')
                meta_description = clean_text(mdesc.get('content') if mdesc else '')
                og_title = clean_text((ogt.get('content') if ogt else '') or (ttag.get_text(strip=True) if ttag else ''))
                og_description = clean_text((ogd.get('content') if ogd else '') or meta_description)
                video_src = None
                try:
                    v = driver.find_element(By.CSS_SELECTOR, 'div.box #video-container div.art-video-player video.art-video[preload="metadata"]')
                    video_src = v.get_attribute('src')
                except Exception:
                    video_src = None
                slinks_texts = []
                try:
                    links = driver.find_elements(By.CSS_SELECTOR, 'main#primary.site-main article div.scontent div.slinks a')
                    for a in links:
                        txt = (a.text or '').strip()
                        if txt:
                            slinks_texts.append(txt)
                except Exception:
                    slinks_texts = []
                results.append({
                    'title': clean_text(title),
                    'link': url,
                    'image_url': image_url,
                    'meta_description': meta_description,
                    'og_title': og_title,
                    'og_description': og_description,
                    'video_src': video_src,
                    'slinks_texts': slinks_texts
                })
                delay(600)
            driver.quit()
            with open(os.path.join(OUTPUT_DIR, 'post-details.json'), 'w', encoding='utf-8') as f:
                json.dump({'count': len(results), 'posts': results}, f, ensure_ascii=False, indent=2)
            print(json.dumps({'count': len(results)}, ensure_ascii=False))
        listing_path = os.path.join(OUTPUT_DIR, 'listing-posts.json')
        with open(listing_path, 'r', encoding='utf-8') as f:
            listing = json.load(f)
        extract_details(listing.get('posts', []))
        try:
            import subprocess, sys
            env = os.environ.copy()
            root = os.path.abspath(os.path.join(OUTPUT_DIR, '..'))
            script_path = os.path.join(root, 'scripts', 'publish-sanity.js')
            if env.get('NEXT_PUBLIC_SANITY_PROJECT_ID') and env.get('NEXT_PUBLIC_SANITY_TOKEN'):
                subprocess.run(['node', script_path], cwd=root, check=False, env=env)
            else:
                print('Skip auto publish: missing Sanity env')
        except Exception as e:
            print(f'Auto publish failed: {e}')
        remove_debug_pages()
    else:
        scrape()
        remove_debug_pages()
