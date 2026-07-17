import os
import sys
import time
import glob
import sqlite3
import re
import unicodedata
import argparse
import pandas as pd
from selenium import webdriver
from selenium.webdriver.chrome.options import Options as ChromeOptions

def normalize_title(name):
    """Normalize venue name for matching (same logic as scholar_scraper_gui.py)."""
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
    """Initialize SQLite database with structured tables."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Enable foreign keys
    cursor.execute("PRAGMA foreign_keys = ON;")
    
    # 1. Journals master table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS journals (
            source_id INTEGER PRIMARY KEY,
            title TEXT,
            title_normalized TEXT,
            type TEXT,
            publisher TEXT,
            country TEXT
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
    
    # 3. Yearly rankings
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS rankings (
            source_id INTEGER,
            year INTEGER,
            sjr_score REAL,
            sjr_quartile TEXT,
            h_index INTEGER,
            PRIMARY KEY (source_id, year),
            FOREIGN KEY (source_id) REFERENCES journals(source_id) ON DELETE CASCADE
        )
    ''')
    
    # Create indexes to speed up matching
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_journals_title_norm ON journals(title_normalized)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_issns_source_id ON issns(source_id)')
    
    conn.commit()
    return conn

def wait_for_download(year, download_dir, timeout=45):
    """Wait for Chrome download to complete by checking files in directory."""
    expected_file = os.path.join(download_dir, f"scimagojr {year}.csv")
    start_time = time.time()
    while time.time() - start_time < timeout:
        crdownloads = glob.glob(os.path.join(download_dir, "*.crdownload"))
        if os.path.exists(expected_file) and os.path.getsize(expected_file) > 0 and not crdownloads:
            return True
        time.sleep(1)
    return False

def import_csv_to_db(db_conn, csv_path, year, progress_callback=None):
    """Parse SCImago CSV file and insert records into database."""
    msg = f"Parsing {os.path.basename(csv_path)} for year {year}..."
    print(msg)
    if progress_callback:
        progress_callback("parse_year_start", {"year": year, "msg": msg})
        
    try:
        df = pd.read_csv(csv_path, sep=';', low_memory=False)
    except Exception as e:
        err_msg = f"Error reading {csv_path}: {e}"
        print(err_msg)
        if progress_callback:
            progress_callback("parse_year_fail", {"year": year, "error": err_msg})
        return False

    cursor = db_conn.cursor()
    
    # Clean column names (strip spaces, quotes)
    df.columns = [col.strip() for col in df.columns]
    
    # Columns mapping (accommodating slight header differences across years)
    col_map = {
        'Sourceid': 'source_id',
        'Title': 'title',
        'Type': 'type',
        'Issn': 'issn',
        'Publisher': 'publisher',
        'Country': 'country',
        'SJR': 'sjr_score',
        'SJR Best Quartile': 'sjr_quartile',
        'H index': 'h_index'
    }
    
    # Find matching columns in dataframe
    found_cols = {}
    for standard_name, target_name in col_map.items():
        for df_col in df.columns:
            clean_df_col = re.sub(r'[^a-zA-Z0-9]', '', df_col).lower()
            clean_std_name = re.sub(r'[^a-zA-Z0-9]', '', standard_name).lower()
            if clean_df_col == clean_std_name:
                found_cols[target_name] = df_col
                break
                
    if 'source_id' not in found_cols or 'title' not in found_cols:
        err_msg = f"Error: Could not find Sourceid or Title columns in {csv_path}."
        print(err_msg)
        if progress_callback:
            progress_callback("parse_year_fail", {"year": year, "error": err_msg})
        return False
        
    inserted_journals = 0
    inserted_rankings = 0
    inserted_issns = 0
    
    for idx, row in df.iterrows():
        source_id_val = row[found_cols['source_id']]
        title_val = row[found_cols['title']]
        
        try:
            source_id = int(source_id_val)
        except Exception:
            continue  # Skip rows without valid integer ID
            
        title = str(title_val).strip()
        title_norm = normalize_title(title)
        
        type_val = str(row[found_cols['type']]).strip() if 'type' in found_cols else ''
        publisher_val = str(row[found_cols['publisher']]).strip() if 'publisher' in found_cols else ''
        country_val = str(row[found_cols['country']]).strip() if 'country' in found_cols else ''
        
        # 1. Insert/update journal
        cursor.execute('''
            INSERT INTO journals (source_id, title, title_normalized, type, publisher, country)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(source_id) DO UPDATE SET
                title = excluded.title,
                title_normalized = excluded.title_normalized,
                type = CASE WHEN excluded.type != '' THEN excluded.type ELSE type END,
                publisher = CASE WHEN excluded.publisher != '' THEN excluded.publisher ELSE publisher END,
                country = CASE WHEN excluded.country != '' THEN excluded.country ELSE country END
        ''', (source_id, title, title_norm, type_val, publisher_val, country_val))
        inserted_journals += 1
        
        # 2. Extract multiple ISSNs
        issn_raw = str(row[found_cols['issn']]).strip() if 'issn' in found_cols else ''
        if issn_raw and issn_raw.lower() != 'nan':
            # Split by comma, semicolon, space, etc.
            issns = [i.strip() for i in re.split(r'[,;\s]+', issn_raw) if i.strip()]
            for issn in issns:
                clean_issn = issn.replace("-", "").upper()
                if len(clean_issn) == 8:
                    cursor.execute('''
                        INSERT OR IGNORE INTO issns (issn, source_id)
                        VALUES (?, ?)
                    ''', (clean_issn, source_id))
                    inserted_issns += 1
        
        # 3. Insert ranking
        sjr_val = row[found_cols['sjr_score']] if 'sjr_score' in found_cols else None
        sjr_q_val = str(row[found_cols['sjr_quartile']]).strip() if 'sjr_quartile' in found_cols else ''
        h_idx_val = row[found_cols['h_index']] if 'h_index' in found_cols else None
        
        sjr_score = None
        if sjr_val is not None:
            try:
                sjr_score = float(str(sjr_val).replace(',', '.'))
            except ValueError:
                pass
                
        h_index = None
        if h_idx_val is not None:
            try:
                h_index = int(h_idx_val)
            except ValueError:
                pass
                
        sjr_quartile = sjr_q_val if sjr_q_val and sjr_q_val.lower() != 'nan' else '-'
        
        cursor.execute('''
            INSERT INTO rankings (source_id, year, sjr_score, sjr_quartile, h_index)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(source_id, year) DO UPDATE SET
                sjr_score = excluded.sjr_score,
                sjr_quartile = excluded.sjr_quartile,
                h_index = excluded.h_index
        ''', (source_id, year, sjr_score, sjr_quartile, h_index))
        inserted_rankings += 1

    db_conn.commit()
    success_msg = f"-> Year {year}: Processed {inserted_journals} journals, {inserted_issns} unique ISSNs, {inserted_rankings} rankings."
    print(success_msg)
    if progress_callback:
        progress_callback("parse_year_success", {
            "year": year, 
            "journals": inserted_journals, 
            "issns": inserted_issns, 
            "rankings": inserted_rankings,
            "msg": success_msg
        })
    return True

def crawl_years(years, download_dir, progress_callback=None):
    """Use Selenium to download SCImago Excel files for a list of years."""
    # Ensure years is a list of integers
    if isinstance(years, (int, str)):
        years = [int(years)]
    else:
        years = sorted(list(set([int(y) for y in years])), reverse=True)
        
    if not years:
        print("No years specified to crawl.")
        return False
        
    start_year = years[-1]
    end_year = years[0]
    msg = f"Crawling years: {', '.join(map(str, sorted(years)))}"
    print("\n=== STARTING SELENIUM CRAWLER ===")
    print(msg)
    print(f"Target download folder: {download_dir}")
    
    if progress_callback:
        progress_callback("crawl_start", {"start": start_year, "end": end_year, "msg": msg})
        
    options = ChromeOptions()
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    
    prefs = {
        "download.default_directory": download_dir,
        "download.prompt_for_download": False,
        "download.directory_upgrade": True,
        "safebrowsing.enabled": True
    }
    options.add_experimental_option("prefs", prefs)
    
    driver = None
    try:
        driver = webdriver.Chrome(options=options)
        msg_init = "Chrome browser opened. Solve Cloudflare checks on screen if prompted."
        print(msg_init)
        if progress_callback:
            progress_callback("crawl_browser_opened", {"msg": msg_init})
            
        # Test download of the first year to bypass Cloudflare
        first_year = years[0]
        url = f"https://www.scimagojr.com/journalrank.php?year={first_year}&out=xls"
        print(f"Navigating to: {url}")
        if progress_callback:
            progress_callback("crawl_year_start", {"year": first_year, "is_first": True})
            
        driver.get(url)
        
        print("Waiting up to 45 seconds for the first download and Cloudflare check...")
        if not wait_for_download(first_year, download_dir, timeout=45):
            warn_msg = "First download timed out. Solve any verification check on browser screen now..."
            print(warn_msg)
            if progress_callback:
                progress_callback("crawl_wait_user", {"msg": warn_msg})
                
            if not wait_for_download(first_year, download_dir, timeout=45):
                print("Failed to complete initial download. Exiting.")
                if progress_callback:
                    progress_callback("crawl_fail", {"error": "Failed to complete initial download."})
                driver.quit()
                return False
                
        print(f"First download (year {first_year}) successful!")
        if progress_callback:
            progress_callback("crawl_year_success", {"year": first_year})
            
        # Loop for remaining years
        remaining_years = years[1:]
        for year in remaining_years:
            expected_file = os.path.join(download_dir, f"scimagojr {year}.csv")
            if os.path.exists(expected_file) and os.path.getsize(expected_file) > 0:
                skip_msg = f"File for year {year} already exists. Skipping."
                print(skip_msg)
                if progress_callback:
                    progress_callback("crawl_year_skip", {"year": year})
                continue
                
            url = f"https://www.scimagojr.com/journalrank.php?year={year}&out=xls"
            print(f"Downloading data for year {year}: {url}")
            if progress_callback:
                progress_callback("crawl_year_start", {"year": year, "is_first": False})
                
            driver.get(url)
            
            if wait_for_download(year, download_dir, timeout=25):
                print(f"Year {year} downloaded.")
                if progress_callback:
                    progress_callback("crawl_year_success", {"year": year})
            else:
                warn_msg = f"Warning: Download timed out for year {year}. (Data might not be available yet)"
                print(warn_msg)
                if progress_callback:
                    progress_callback("crawl_year_timeout", {"year": year, "msg": warn_msg})
                
            time.sleep(2)  # Pause to avoid rate limits
            
        print("All downloads finished. Closing browser.")
        driver.quit()
        if progress_callback:
            progress_callback("crawl_end", {"msg": "All downloads finished successfully!"})
        return True
    except Exception as e:
        err_msg = f"Selenium automation error: {e}"
        print(err_msg)
        if progress_callback:
            progress_callback("crawl_fail", {"error": err_msg})
        if driver:
            driver.quit()
        return False

def build_database(download_dir, db_path, progress_callback=None):
    """Read downloaded CSV files and build SQLite database."""
    print("\n=== BUILDING SQLITE DATABASE ===")
    print(f"Reading CSVs from: {download_dir}")
    print(f"Building Database at: {db_path}")
    
    if progress_callback:
        progress_callback("db_build_start", {"db_path": db_path})
        
    conn = init_db(db_path)
    
    csv_files = glob.glob(os.path.join(download_dir, "scimagojr *.csv"))
    if not csv_files:
        err_msg = "No CSV files found in the download directory."
        print(err_msg)
        if progress_callback:
            progress_callback("db_build_fail", {"error": err_msg})
        conn.close()
        return False
        
    total_files = len(csv_files)
    if progress_callback:
        progress_callback("db_build_count", {"total": total_files})
        
    for idx, csv_file in enumerate(sorted(csv_files)):
        filename = os.path.basename(csv_file)
        match = re.search(r'scimagojr\s+(\d{4})\.csv', filename)
        if match:
            year = int(match.group(1))
            import_csv_to_db(conn, csv_file, year, progress_callback)
            
    conn.close()
    print("\nDatabase build completed successfully!")
    if progress_callback:
        progress_callback("db_build_success", {"msg": "Database build completed successfully!"})
    return True

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="SCImago SJR Crawler & DB Builder (1999-2025)")
    parser.add_argument('--start', type=int, default=1999, help="Start year for crawler (default 1999)")
    parser.add_argument('--end', type=int, default=2025, help="End year for crawler (default 2025)")
    parser.add_argument('--only-db', action='store_true', help="Only build database from existing CSV downloads")
    parser.add_argument('--only-crawl', action='store_true', help="Only run crawler browser downloads")
    
    args = parser.parse_args()
    
    # Path configuration
    script_dir = os.path.dirname(os.path.abspath(__file__))
    download_folder = os.path.join(script_dir, "scimagojr_downloads")
    os.makedirs(download_folder, exist_ok=True)
    
    db_file_path = os.path.join(script_dir, "scimagojr_all.db")
    
    if args.only_db:
        build_database(download_folder, db_file_path)
    elif args.only_crawl:
        years_list = list(range(args.start, args.end + 1))
        crawl_years(years_list, download_folder)
    else:
        # Run both
        years_list = list(range(args.start, args.end + 1))
        success = crawl_years(years_list, download_folder)
        if success or glob.glob(os.path.join(download_folder, "scimagojr *.csv")):
            build_database(download_folder, db_file_path)
        else:
            print("Crawler failed and no downloaded CSV files detected. Database build skipped.")
