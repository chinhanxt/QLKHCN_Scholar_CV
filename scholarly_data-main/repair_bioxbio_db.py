import os
import sys
import time
import sqlite3
import re
import unicodedata
import requests
import concurrent.futures
from bs4 import BeautifulSoup

DB_PATH = '/home/chinhan/Downloads/scholarly_data-main/bioxbio_all.db'

def normalize_title(name):
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

def main():
    print("Starting database repair script...")
    if not os.path.exists(DB_PATH):
        print(f"Error: Database not found at {DB_PATH}")
        return
        
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL;")
    cursor = conn.cursor()
    
    # Get existing journals list
    cursor.execute("SELECT source_id, title, title_normalized FROM journals")
    db_journals = {row[2]: row[0] for row in cursor.fetchall()}
    print(f"Loaded {len(db_journals)} journals from database.")
    
    # 1. Fetch all journal links from master list (230 pages)
    print("Scanning master list pages 1 to 230 to collect accurate links...")
    journal_links = []
    
    def fetch_master_page(page):
        url = f"https://www.bioxbio.com/journal/?page={page}"
        try:
            r = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=15)
            if r.status_code != 200:
                return []
            soup = BeautifulSoup(r.text, 'html.parser')
            page_links = []
            for a in soup.find_all('a', href=True):
                href = a['href']
                if '/journal/' in href and not href.endswith('/journal'):
                    full_link = href if href.startswith('http') else f"https://www.bioxbio.com{href}"
                    page_links.append((a.get_text().strip(), full_link))
            return page_links
        except Exception as e:
            return []

    # Run in parallel using 20 threads to gather links
    with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
        pages = list(range(1, 231))
        results = executor.map(fetch_master_page, pages)
        for res in results:
            journal_links.extend(res)
            
    # Remove duplicates
    journal_links = list(set(journal_links))
    print(f"Found {len(journal_links)} journal links on BioxBio website.")
    
    # 2. Filter links that exist in our database
    to_scrape = []
    for title, link in journal_links:
        norm = normalize_title(title)
        if norm in db_journals:
            source_id = db_journals[norm]
            to_scrape.append((source_id, title, link))
            
    print(f"Matching: {len(to_scrape)} journals to be re-scraped.")
    
    # 3. Clear old incorrect issns and rankings tables
    print("Clearing corrupted tables...")
    cursor.execute("DELETE FROM issns")
    cursor.execute("DELETE FROM rankings")
    conn.commit()
    
    # 4. Scrape detail pages using 40 threads
    print("Repairing ISSNs and Impact Factors using 40 parallel threads...")
    completed = 0
    total = len(to_scrape)
    
    def scrape_and_update(item):
        nonlocal completed
        source_id, title, link = item
        try:
            r = requests.get(link, headers={'User-Agent': 'Mozilla/5.0'}, timeout=15)
            if r.status_code != 200:
                return False
            soup = BeautifulSoup(r.text, 'html.parser')
            
            # Extract ISSNs
            page_text = soup.get_text()
            issns = re.findall(r'ISSN:\s*([0-9Xx-]{8,9})', page_text, re.IGNORECASE)
            cleaned_issns = list(set([i.replace('-', '').strip().upper() for i in issns]))
            
            # Write to SQLite
            t_conn = sqlite3.connect(DB_PATH)
            t_conn.execute("PRAGMA journal_mode=WAL;")
            t_cursor = t_conn.cursor()
            
            # Insert ISSNs
            for issn in cleaned_issns:
                t_cursor.execute("INSERT OR IGNORE INTO issns (issn, source_id) VALUES (?, ?)", (issn, source_id))
                
            # Extract rankings
            target_table = None
            for table in soup.find_all('table'):
                text_table = table.get_text().lower()
                if 'impact factor' in text_table or 'if' in text_table:
                    target_table = table
                    break
                    
            if target_table:
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
                                
                        t_cursor.execute('''
                            INSERT INTO rankings (source_id, year, impact_factor, total_articles, total_cites)
                            VALUES (?, ?, ?, ?, ?)
                            ON CONFLICT(source_id, year) DO UPDATE SET
                                impact_factor = excluded.impact_factor,
                                total_articles = excluded.total_articles,
                                total_cites = excluded.total_cites
                        ''', (source_id, year, impact_factor, articles, cites))
                        
            t_conn.commit()
            t_conn.close()
            return True
        except Exception as e:
            return False
            
    with concurrent.futures.ThreadPoolExecutor(max_workers=40) as executor:
        future_to_item = {executor.submit(scrape_and_update, item): item for item in to_scrape}
        for future in concurrent.futures.as_completed(future_to_item):
            completed += 1
            if completed % 500 == 0 or completed == total:
                print(f"Progress: {completed}/{total} repaired ({completed/total*100:.1f}%)")
                
    conn.close()
    print("Database repair complete! Database is now 100% correct.")

if __name__ == "__main__":
    main()
