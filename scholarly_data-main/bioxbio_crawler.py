import os
import sys
import time
import sqlite3
import re
import unicodedata
import requests
import concurrent.futures
from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.webdriver.chrome.options import Options as ChromeOptions
from selenium.webdriver.common.by import By

def normalize_title(name):
    """Normalize venue name for matching (same logic as scimago_crawler)."""
    if not name or not isinstance(name, str):
        return ""
    name = name.upper()
    name = name.replace("&AMP;", "&")
    name = name.replace(" AND ", "")
    if name.startswith("THE "):
        name = name[4:]
    if name.endswith(", THE"):
        name = name[:-5]
    name = unicodedata.normalize('NFD', name)
    name = re.sub(r'[^A-Z0-9]', '', name)
    return name

def init_db(db_path):
    """Initialize SQLite database with structured tables for BioxBio IF."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("PRAGMA foreign_keys = ON;")
    
    # 1. Journals master table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS journals (
            source_id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT,
            title_normalized TEXT UNIQUE
        )
    ''')
    
    # 2. Individual ISSNs for fast matching
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS issns (
            issn TEXT PRIMARY KEY,
            source_id INTEGER,
            FOREIGN KEY (source_id) REFERENCES journals(source_id) ON DELETE CASCADE
        )
    ''')
    
    # 3. Yearly rankings / Impact Factors
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS rankings (
            source_id INTEGER,
            year INTEGER,
            impact_factor REAL,
            total_articles INTEGER,
            total_cites INTEGER,
            PRIMARY KEY (source_id, year),
            FOREIGN KEY (source_id) REFERENCES journals(source_id) ON DELETE CASCADE
        )
    ''')
    
    # 4. Subject progress for resuming runs
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS subject_progress (
            subject TEXT PRIMARY KEY,
            last_completed_page INTEGER,
            is_completed INTEGER DEFAULT 0
        )
    ''')
    
    # Create indexes to speed up matching
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_journals_title_norm ON journals(title_normalized)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_issns_source_id ON issns(source_id)')
    
    conn.commit()
    return conn

def insert_journal_and_issns(conn, title, cleaned_issns):
    """Inserts a journal and its associated ISSNs, avoiding duplicates."""
    cursor = conn.cursor()
    norm_title = normalize_title(title)
    if not norm_title:
        return None
        
    # Check if journal exists by title
    cursor.execute("SELECT source_id FROM journals WHERE title_normalized = ?", (norm_title,))
    row = cursor.fetchone()
    if row:
        source_id = row[0]
    else:
        # Check if journal exists by any of the ISSNs
        source_id = None
        for issn in cleaned_issns:
            cursor.execute("SELECT source_id FROM issns WHERE issn = ?", (issn,))
            issn_row = cursor.fetchone()
            if issn_row:
                source_id = issn_row[0]
                break
        
        if not source_id:
            try:
                cursor.execute("INSERT INTO journals (title, title_normalized) VALUES (?, ?)", (title, norm_title))
                source_id = cursor.lastrowid
            except sqlite3.IntegrityError:
                # Handle race condition
                cursor.execute("SELECT source_id FROM journals WHERE title_normalized = ?", (norm_title,))
                row = cursor.fetchone()
                if row:
                    source_id = row[0]
                else:
                    return None

    # Insert ISSNs
    if source_id:
        for issn in cleaned_issns:
            cursor.execute("INSERT OR IGNORE INTO issns (issn, source_id) VALUES (?, ?)", (issn, source_id))
        conn.commit()
        
    return source_id

def is_journal_already_crawled(conn, title):
    """Check if a journal has already been successfully crawled and has rankings."""
    cursor = conn.cursor()
    norm_title = normalize_title(title)
    if not norm_title:
        return False
    cursor.execute("SELECT source_id FROM journals WHERE title_normalized = ?", (norm_title,))
    row = cursor.fetchone()
    if row:
        source_id = row[0]
        cursor.execute("SELECT COUNT(*) FROM rankings WHERE source_id = ?", (source_id,))
        count = cursor.fetchone()[0]
        return count > 0
    return False

def crawl_bioxbio_deep(start_url, db_path, delay=2.0, progress_callback=None, stop_event=None):
    """Selenium script to crawl journal links and deep-scrape Impact Factor history."""
    print("\n=== STARTING BIOXBIO CRAWLER ===")
    print(f"Target Database: {db_path}")
    print(f"Starting URL: {start_url}")
    print(f"Request Delay: {delay}s")
    
    if progress_callback:
        progress_callback("crawl_start", {"msg": "Đang khởi tạo trình duyệt Chrome..."})
        
    conn = init_db(db_path)
    
    # Enable WAL mode for sqlite to support safe multi-thread/tab commits
    conn.execute("PRAGMA journal_mode=WAL;")
    
    options = ChromeOptions()
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    
    driver = None
    try:
        driver = webdriver.Chrome(options=options)
        msg_init = "Đã mở trình duyệt. Vui lòng vượt qua Cloudflare/CAPTCHA nếu có yêu cầu."
        print(msg_init)
        if progress_callback:
            progress_callback("crawl_browser_opened", {"msg": msg_init})
            
        driver.get(start_url)
        
        # Give user time to resolve any checks
        time.sleep(5)
        
        # Parse initial page to see if it contains subject/category links
        soup = BeautifulSoup(driver.page_source, 'html.parser')
        
        urls_to_crawl = []
        
        # Check if the start_url itself is a subject page or the master journal list
        if 'subject/' in start_url or start_url.rstrip('/').endswith('/journal'):
            urls_to_crawl = [start_url]
        else:
            # Find subject links on the page
            subject_links = []
            for a in soup.find_all('a', href=True):
                href = a['href']
                if 'subject/' in href:
                    full_link = href if href.startswith('http') else f"https://www.bioxbio.com/{href.lstrip('/')}"
                    subject_links.append(full_link)
            
            urls_to_crawl = list(set(subject_links))
            
        # If no subject links found, just crawl the start_url directly
        if not urls_to_crawl:
            urls_to_crawl = [start_url]
            
        print(f"Danh sách các chuyên mục cần cào ({len(urls_to_crawl)}):")
        for u in urls_to_crawl:
            print(f" - {u}")
            
        journals_scraped_count = 0
        
        for url_idx, target_url in enumerate(urls_to_crawl):
            if stop_event and stop_event.is_set():
                break
                
            subject_name = target_url.rstrip('/').split('/')[-1]
            
            # Check if this subject is already completed
            cursor = conn.cursor()
            cursor.execute("SELECT is_completed, last_completed_page FROM subject_progress WHERE subject = ?", (subject_name,))
            row = cursor.fetchone()
            
            is_completed = 0
            last_completed_page = 0
            if row:
                is_completed = row[0]
                last_completed_page = row[1]
                
            if is_completed == 1:
                print(f"Chuyên mục '{subject_name}' đã cào hoàn tất trước đó. Bỏ qua.")
                continue
                
            # Respect starting page in query if any
            page_match = re.search(r'[?&]page=(\d+)', target_url)
            if page_match:
                page_num = int(page_match.group(1))
                subject_url_with_page = target_url
            else:
                page_num = last_completed_page
                if page_num > 1:
                    sep = '&' if '?' in target_url else '?'
                    subject_url_with_page = f"{target_url}{sep}page={page_num}"
                else:
                    page_num = 1
                    subject_url_with_page = target_url
            
            print(f"\n--- Bắt đầu cào chuyên mục: {subject_name} ({url_idx+1}/{len(urls_to_crawl)}), từ trang {page_num} ---")
            
            driver.get(subject_url_with_page)
            time.sleep(3) # Wait for page load
            
            while True:
                if stop_event and stop_event.is_set():
                    break
                    
                msg_page = f"Quét chuyên mục: {subject_name} - Trang danh sách {page_num}..."
                print(msg_page)
                if progress_callback:
                    progress_callback("crawl_page_start", {"page": page_num, "msg": f"{subject_name.upper()} - Trang {page_num}"})
                    
                # Parse page source for journal detail links
                soup = BeautifulSoup(driver.page_source, 'html.parser')
                
                journal_links = []
                for a in soup.find_all('a', href=True):
                    href = a['href']
                    if '/journal/' in href and not href.endswith('/journal/') and not href.endswith('/journal'):
                        full_link = href if href.startswith('http') else f"https://www.bioxbio.com{href}"
                        journal_links.append((a.get_text().strip(), full_link))
                
                journal_links = list(set(journal_links))
                
                if not journal_links:
                    warn_msg = f"Không tìm thấy tạp chí nào ở {subject_name} trang {page_num}. Thử lại..."
                    print(warn_msg)
                    time.sleep(5)
                    soup = BeautifulSoup(driver.page_source, 'html.parser')
                    for a in soup.find_all('a', href=True):
                        href = a['href']
                        if '/journal/' in href and not href.endswith('/journal'):
                            full_link = href if href.startswith('http') else f"https://www.bioxbio.com{href}"
                            journal_links.append((a.get_text().strip(), full_link))
                    journal_links = list(set(journal_links))
                    if not journal_links:
                        print("Bỏ qua trang này.")
                        break
                
                print(f"Tìm thấy {len(journal_links)} tạp chí ở {subject_name} trang {page_num}. Bắt đầu cào...")
                
                # Crawl details in parallel using ThreadPoolExecutor
                active_batch = []
                for title, link in journal_links:
                    if is_journal_already_crawled(conn, title):
                        print(f"   -> Tạp chí '{title}' đã được cào trước đó. Bỏ qua.")
                        continue
                    active_batch.append((title, link))
                
                if active_batch:
                    print(f"-> Đang cào chi tiết {len(active_batch)} tạp chí mới bằng luồng ngầm (Multi-threading)...")
                    
                    def crawl_detail_http(item):
                        title, link = item
                        try:
                            headers = {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                            }
                            r = requests.get(link, headers=headers, timeout=15)
                            if r.status_code != 200:
                                print(f"   -> Lỗi tải {title}: Status {r.status_code}")
                                return False
                                
                            soup_detail = BeautifulSoup(r.text, 'html.parser')
                            
                            # Extract ISSNs
                            page_text = soup_detail.get_text()
                            issns = re.findall(r'ISSN:\s*([0-9Xx-]{8,9})', page_text, re.IGNORECASE)
                            cleaned_issns = list(set([i.replace('-', '').strip().upper() for i in issns]))
                            
                            thread_conn = sqlite3.connect(db_path)
                            thread_conn.execute("PRAGMA journal_mode=WAL;")
                            
                            source_id = insert_journal_and_issns(thread_conn, title, cleaned_issns)
                            if source_id:
                                target_table = None
                                for table in soup_detail.find_all('table'):
                                    text_table = table.get_text().lower()
                                    if 'impact factor' in text_table or 'if' in text_table:
                                        target_table = table
                                        break
                                        
                                if target_table:
                                    cursor = thread_conn.cursor()
                                    rankings_inserted = 0
                                    
                                    rows = target_table.find_all('tr')
                                    for row in rows[1:]:
                                        cells = [td.get_text().strip() for td in row.find_all(['td', 'th'])]
                                        if len(cells) >= 2:
                                            year_str = cells[0]
                                            if_str = cells[1]
                                            
                                            year_match = re.search(r'\d{4}', year_str)
                                            if not year_match:
                                                continue
                                            year = int(year_match.group(0))
                                            
                                            if_clean = re.sub(r'[^\d.]', '', if_str)
                                            try:
                                                impact_factor = float(if_clean) if if_clean else 0.0
                                            except ValueError:
                                                impact_factor = 0.0
                                                
                                            articles = None
                                            cites = None
                                            if len(cells) > 2:
                                                art_clean = re.sub(r'\D', '', cells[2])
                                                if art_clean:
                                                    articles = int(art_clean)
                                            if len(cells) > 3:
                                                cite_clean = re.sub(r'\D', '', cells[3])
                                                if cite_clean:
                                                    cites = int(cite_clean)
                                                    
                                            cursor.execute('''
                                                INSERT INTO rankings (source_id, year, impact_factor, total_articles, total_cites)
                                                VALUES (?, ?, ?, ?, ?)
                                                ON CONFLICT(source_id, year) DO UPDATE SET
                                                    impact_factor = excluded.impact_factor,
                                                    total_articles = excluded.total_articles,
                                                    total_cites = excluded.total_cites
                                            ''', (source_id, year, impact_factor, articles, cites))
                                            rankings_inserted += 1
                                            
                                    thread_conn.commit()
                                    thread_conn.close()
                                    print(f"   -> Đã cào xong và lưu: {title} ({rankings_inserted} dòng IF)")
                                    return True
                            thread_conn.close()
                        except Exception as e:
                            print(f"   -> Lỗi cào {title}: {e}")
                        return False
                        
                    with concurrent.futures.ThreadPoolExecutor(max_workers=30) as executor:
                        future_to_item = {executor.submit(crawl_detail_http, item): item for item in active_batch}
                        for future in concurrent.futures.as_completed(future_to_item):
                            if stop_event and stop_event.is_set():
                                break
                            item = future_to_item[future]
                            success = future.result()
                            if success:
                                journals_scraped_count += 1
                                if progress_callback:
                                    progress_callback("crawl_detail_start", {
                                        "title": f"[{subject_name}] {item[0]}", 
                                        "idx": journals_scraped_count, 
                                        "total": journals_scraped_count,
                                        "page": page_num
                                    })
                                    
                time.sleep(delay)
                
                if progress_callback:
                    progress_callback("crawl_page_success", {
                        "page": f"{subject_name} (Trang {page_num})", 
                        "scraped_in_page": len(journal_links),
                        "total_scraped": journals_scraped_count
                    })
                
                # Save progress
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT OR REPLACE INTO subject_progress (subject, last_completed_page, is_completed)
                    VALUES (?, ?, 0)
                ''', (subject_name, page_num))
                conn.commit()
                    
                # Check for NEXT button (making sure it is not disabled and strictly contains 'Next')
                next_el = None
                try:
                    el = driver.find_element(By.XPATH, "//a[contains(translate(., 'NEXT', 'next'), 'next') and not(contains(@class, 'disabled'))]")
                    if el and el.get_attribute("href"):
                        next_el = el
                except:
                    pass
                        
                if next_el:
                    print("Đang chuyển sang trang tiếp theo...")
                    driver.execute_script("arguments[0].click();", next_el)
                    page_num += 1
                    time.sleep(delay * 2.0)
                else:
                    print(f"Đã cào xong chuyên mục: {subject_name}.")
                    # Save fully completed state
                    cursor = conn.cursor()
                    cursor.execute('''
                        INSERT OR REPLACE INTO subject_progress (subject, last_completed_page, is_completed)
                        VALUES (?, ?, 1)
                    ''', (subject_name, page_num))
                    conn.commit()
                    break
                    
        driver.quit()
        conn.close()
        if progress_callback:
            progress_callback("crawl_end", {"msg": f"Quá trình cào hoàn tất! Đã lưu thành công {journals_scraped_count} tạp chí."})
        return True
        
    except Exception as e:
        err_msg = f"Lỗi Selenium: {e}"
        print(err_msg)
        if progress_callback:
            progress_callback("crawl_fail", {"error": err_msg})
        if driver:
            driver.quit()
        conn.close()
        return False
