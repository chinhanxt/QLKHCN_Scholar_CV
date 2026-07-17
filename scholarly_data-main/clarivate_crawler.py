import os
import sys
import time
import sqlite3
import re
import unicodedata
import requests
import uuid
import threading
import concurrent.futures
import math

# Thread lock for safe database operations during multi-threaded crawl
db_lock = threading.Lock()

def normalize_title(name):
    """Normalize venue name for matching (same logic as other crawlers)."""
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
    """Initialize SQLite database for Clarivate Master Journal List data."""
    # Check for old schema
    if os.path.exists(db_path):
        try:
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='journals'")
            row = cursor.fetchone()
            conn.close()
            if row and "title_normalized TEXT UNIQUE" in row[0]:
                print("Old schema with UNIQUE constraint detected. Deleting old database to rebuild...")
                os.remove(db_path)
        except Exception as e:
            print("Error checking schema:", e)

    with db_lock:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("PRAGMA foreign_keys = ON;")
        
        # 1. Journals master table (Clarivate MJL entries)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS journals (
                publication_id INTEGER PRIMARY KEY,
                clarivate_title TEXT,
                title_normalized TEXT,
                issn TEXT,
                eissn TEXT,
                publisher TEXT,
                country TEXT,
                wos_core_collection TEXT,
                additional_wos_indexes TEXT,
                bioxbio_if REAL,
                bioxbio_year INTEGER,
                bioxbio_match TEXT,
                bioxbio_source_id INTEGER,
                scimago_sjr REAL,
                scimago_hindex INTEGER,
                scimago_year INTEGER,
                scimago_match TEXT,
                scimago_quartile TEXT,
                scimago_source_id INTEGER,
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # In case the table journals exists but is missing the alter columns (e.g. old db migration)
        cursor.execute("PRAGMA table_info(journals)")
        cols = {col[1] for col in cursor.fetchall()}
        alter_cols = {
            'bioxbio_if': 'REAL',
            'bioxbio_year': 'INTEGER',
            'bioxbio_match': 'TEXT',
            'bioxbio_source_id': 'INTEGER',
            'scimago_sjr': 'REAL',
            'scimago_hindex': 'INTEGER',
            'scimago_year': 'INTEGER',
            'scimago_match': 'TEXT',
            'scimago_quartile': 'TEXT',
            'scimago_source_id': 'INTEGER'
        }
        for name, dtype in alter_cols.items():
            if name not in cols:
                cursor.execute(f"ALTER TABLE journals ADD COLUMN {name} {dtype}")
        
        # 2. Page progress table for resuming crawls
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS page_progress (
                page_num INTEGER PRIMARY KEY,
                status TEXT, -- 'COMPLETED'
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Create indexes
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_clarivate_title_norm ON journals(title_normalized)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_clarivate_issn ON journals(issn)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_clarivate_eissn ON journals(eissn)')
        
        conn.commit()
        conn.close()

def query_clarivate_page(page_num, page_size=100, timeout=15, max_retries=3):
    """Fetch a specific page of WoS Core Collection journals from rank-search REST API."""
    url = "https://mjl.clarivate.com/api/mjl/jprof/public/rank-search"
    headers = {
        "Accept": "application/json, text/plain, */*",
        "Authorization": "Bearer",
        "Content-Type": "application/json",
        "x-1p-appId": "mjl",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    search_id = str(uuid.uuid4())
    
    # Payload seeking all journals belonging to WoS Core Collection
    payload = {
        "searchValue": "",
        "pageNum": page_num,
        "pageSize": page_size,
        "sortOrder": [{"name": "RELEVANCE", "order": "DESC"}],
        "filters": [
            {
                "filterName": "COVERED_LATEST_JEDI",
                "matchType": "BOOLEAN_EXACT",
                "caseSensitive": False,
                "values": [{"type": "VALUE", "value": "true"}]
            },
            {
                "filterName": "PRODUCT_CODE",
                "matchType": "TEXT_EXACT",
                "caseSensitive": False,
                "values": [
                    {"type": "VALUE", "value": "D"},
                    {"type": "VALUE", "value": "J"},
                    {"type": "VALUE", "value": "SS"},
                    {"type": "VALUE", "value": "H"},
                    {"type": "VALUE", "value": "EX"}
                ]
            }
        ],
        "searchIdentifier": search_id
    }
    
    for retry in range(max_retries):
        try:
            r = requests.post(url, headers=headers, json=payload, timeout=timeout)
            if r.status_code == 200:
                return r.json()
            elif r.status_code == 429:
                time.sleep(4 + retry * 3)
            else:
                time.sleep(2 + retry)
        except Exception:
            time.sleep(2 + retry)
            
    return None

def parse_profile(profile_data):
    """Extract Core Collection and Additional Indexes from journal profile JSON."""
    profile = profile_data.get('journalProfile', {})
    
    pub_id = profile.get('publicationId')
    title = profile.get('publicationTitle', '').strip()
    issn = profile.get('issn', '').strip()
    eissn = profile.get('eissn', '').strip()
    
    publisher = profile.get('publisherName', '').strip()
    addr = profile.get('publisherAddress', '').strip()
    full_publisher = f"{publisher}, {addr}" if addr else publisher
    country = profile.get('country', '').strip()
    
    products = profile.get('products', [])
    
    core_codes = {'D', 'SS', 'J', 'H', 'EX'}
    additional_codes = {'A', 'B', 'C', 'P', 'S', 'Y', 'T', 'ES', 'BP', 'BA', 'B7', 'CR', 'I'}
    
    core_list = []
    additional_list = []
    
    for prod in products:
        code = prod.get('productCode', '')
        desc = prod.get('description', '')
        if not desc:
            continue
        
        clean_desc = desc.replace("CC/", "Current Contents ")
        
        if code in core_codes:
            if clean_desc not in core_list:
                core_list.append(clean_desc)
        elif code in additional_codes:
            if clean_desc not in additional_list:
                additional_list.append(clean_desc)
                
    wos_core = ", ".join(core_list)
    add_indexes = " | ".join(additional_list)
    
    return {
        'publication_id': pub_id,
        'clarivate_title': title,
        'title_normalized': normalize_title(title),
        'issn': issn,
        'eissn': eissn,
        'publisher': full_publisher,
        'country': country,
        'wos_core_collection': wos_core,
        'additional_wos_indexes': add_indexes
    }

def save_journals_batch(db_path, records):
    """Save parsed journal entries to journals table in database."""
    with db_lock:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.executemany('''
            INSERT OR REPLACE INTO journals (
                publication_id, clarivate_title, title_normalized, 
                issn, eissn, publisher, country, wos_core_collection, 
                additional_wos_indexes, last_updated
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ''', [
            (
                r['publication_id'], r['clarivate_title'], r['title_normalized'],
                r['issn'], r['eissn'], r['publisher'], r['country'],
                r['wos_core_collection'], r['additional_wos_indexes']
            ) for r in records
        ])
        conn.commit()
        conn.close()

def save_page_completed(db_path, page_num):
    """Mark a page as completed in the page_progress table."""
    with db_lock:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute('''
            INSERT OR REPLACE INTO page_progress (page_num, status, last_updated)
            VALUES (?, 'COMPLETED', CURRENT_TIMESTAMP)
        ''', (page_num,))
        conn.commit()
        conn.close()

def get_completed_pages(db_path):
    """Retrieve set of page numbers that have already been crawled."""
    with db_lock:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT page_num FROM page_progress WHERE status = 'COMPLETED'")
        completed = {row[0] for row in cursor.fetchall()}
        conn.close()
    return completed

def process_single_page(page_num, db_path, page_size=100, delay=1.5):
    """Fetch and write journal profiles for a single page index."""
    res = query_clarivate_page(page_num, page_size)
    if not res or res.get('status') != 'SUCCESS':
        raise Exception(f"Failed to fetch page {page_num} response")
        
    profiles = res.get('journalProfiles', [])
    records = []
    for p in profiles:
        records.append(parse_profile(p))
        
    if records:
        save_journals_batch(db_path, records)
        
    save_page_completed(db_path, page_num)
    time.sleep(delay)
    return len(records)

def crawl_clarivate(scimago_db_path, bioxbio_db_path, clarivate_db_path, delay=1.5, threads=3, progress_callback=None, stop_event=None):
    """Main function to paginate and crawl the entire Clarivate Web of Science Master Journal List."""
    print("Initializing Clarivate Database...")
    init_db(clarivate_db_path)
    
    # 1. Fetch total record count
    print("Fetching total record count from Clarivate MJL...")
    init_res = query_clarivate_page(page_num=1, page_size=10)
    if not init_res or init_res.get('status') != 'SUCCESS':
        msg = "Không thể kết nối đến Clarivate MJL API. Vui lòng kiểm tra lại kết nối mạng."
        print(msg)
        if progress_callback:
            progress_callback("crawl_fail", {"error": msg})
        return False
        
    total_records = init_res.get('totalRecords', 0)
    if total_records == 0:
        msg = "Clarivate báo danh sách trống. Vui lòng thử lại sau."
        print(msg)
        if progress_callback:
            progress_callback("crawl_fail", {"error": msg})
        return False
        
    page_size = 100
    total_pages = math.ceil(total_records / page_size)
    print(f"Total Journals in WoS Core: {total_records}")
    print(f"Total Pages to download (size {page_size}): {total_pages}")
    
    # 2. Check already completed pages
    completed = get_completed_pages(clarivate_db_path)
    print(f"Found {len(completed)} completed pages in page_progress.")
    
    to_crawl = [p for p in range(1, total_pages + 1) if p not in completed]
    total_to_crawl = len(to_crawl)
    print(f"Pending pages to crawl: {total_to_crawl}")
    
    if total_to_crawl == 0:
        msg = f"Hoàn thành! Đã tải toàn bộ {total_records} tạp chí ({total_pages} trang)."
        print(msg)
        if progress_callback:
            progress_callback("crawl_complete", {"msg": msg, "total": total_pages, "processed": total_pages})
        return True
        
    if progress_callback:
        progress_callback("crawl_start", {
            "msg": f"Bắt đầu tải {total_records} tạp chí ({total_pages} trang) bằng {threads} luồng...",
            "total_pages": total_pages,
            "completed_pages": len(completed),
            "pending_pages": total_to_crawl,
            "total_records": total_records
        })
        
    processed_pages = len(completed)
    
    # 3. ThreadPoolExecutor to request pages concurrently
    with concurrent.futures.ThreadPoolExecutor(max_workers=threads) as executor:
        futures = {executor.submit(process_single_page, p, clarivate_db_path, page_size, delay): p for p in to_crawl}
        
        for future in concurrent.futures.as_completed(futures):
            if stop_event and stop_event.is_set():
                print("Dừng theo yêu cầu. Đang hủy các luồng tải trang...")
                for f in futures:
                    f.cancel()
                break
                
            page_num = futures[future]
            try:
                records_count = future.result()
                processed_pages += 1
                pct = float(processed_pages) / total_pages
                
                msg = f"[Trang {processed_pages}/{total_pages}] Đã tải thành công Trang {page_num} -> +{records_count} tạp chí"
                print(msg)
                
                if progress_callback:
                    progress_callback("page_scraped", {
                        "msg": msg,
                        "page_num": page_num,
                        "records_count": records_count,
                        "processed_pages": processed_pages,
                        "total_pages": total_pages,
                        "total_records": total_records
                    })
            except Exception as e:
                print(f"Lỗi tải Trang {page_num}: {e}")
                if progress_callback:
                    progress_callback("page_error", {
                        "msg": f"Lỗi tải Trang {page_num}: {e}",
                        "page_num": page_num
                    })
                    
    if stop_event and stop_event.is_set():
        msg = f"Đã dừng tải. Đã tải thành công {processed_pages} / {total_pages} trang."
        print(msg)
        if progress_callback:
            progress_callback("crawl_stopped", {"msg": msg, "processed_pages": processed_pages, "total_pages": total_pages})
    else:
        msg = f"Hoàn thành! Đã tải toàn bộ {total_records} tạp chí ({total_pages} trang)."
        print(msg)
        if progress_callback:
            progress_callback("crawl_complete", {"msg": msg, "processed_pages": processed_pages, "total_pages": total_pages})
            
    return True
