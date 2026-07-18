import os
import sys
import re
import unicodedata
import hashlib
import logging
import time
import requests
import io
import math
import concurrent.futures
from celery import shared_task
from django.conf import settings
from django.db import transaction
from apps.scholar.models import (
    AuthorProfile, Publication, Journal, JournalISSN, JournalRanking,
    ClarivateJournal, ClarivateCrawlerProgress,
    ScimagoJournal, ScimagoISSN, ScimagoRanking,
    BioxbioJournal, BioxbioISSN, BioxbioRanking, BioxbioCrawlerProgress
)
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)


def normalize_title(name):
    """
    Normalizes journal/venue titles for exact database lookup.
    Converts to uppercase, replaces '&AMP;' with '&', removes ' AND ',
    removes leading 'THE ' or trailing ', THE', normalizes NFD,
    and strips all non-alphanumeric characters.
    """
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


def extract_venue(citation_str):
    """
    Parse venue name from Google Scholar snippet citation string.
    """
    if not citation_str or not isinstance(citation_str, str):
        return ""
    parts = [p.strip() for p in citation_str.split(',')]
    first_part = parts[0]
    
    if ' - ' in first_part:
        subparts = first_part.split(' - ')
        if len(subparts) > 1:
            first_part = subparts[1]
            
    cleaned = re.sub(r'\s*\d+\s*\([^)]*\).*', '', first_part)
    cleaned = re.sub(r'\s*\d+.*', '', cleaned)
    cleaned = cleaned.replace("…", "").strip()
    return cleaned


def get_scholar_settings():
    import json
    filepath = os.path.join(settings.BASE_DIR, 'config/scholar_settings.json')
    defaults = {
        'SCHOLAR_PROXY_MODE': getattr(settings, 'SCHOLAR_PROXY_MODE', 'DIRECT'),
        'SCRAPER_API_KEY': getattr(settings, 'SCRAPER_API_KEY', ''),
        'SCHOLAR_LUMINATI_USER': getattr(settings, 'SCHOLAR_LUMINATI_USER', ''),
        'SCHOLAR_LUMINATI_PASSWORD': getattr(settings, 'SCHOLAR_LUMINATI_PASSWORD', ''),
        'SCHOLAR_LUMINATI_PORT': getattr(settings, 'SCHOLAR_LUMINATI_PORT', 0),
        'SCHOLAR_HTTP_PROXY': getattr(settings, 'SCHOLAR_HTTP_PROXY', ''),
        'SCHOLAR_HTTPS_PROXY': getattr(settings, 'SCHOLAR_HTTPS_PROXY', ''),
        'SCHOLAR_RETRIES': 3
    }
    if os.path.exists(filepath):
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
                for k, v in data.items():
                    defaults[k] = v
        except Exception as e:
            logger.error(f"Error loading scholar settings: {e}")
    return defaults


def save_scholar_settings(data):
    import json
    filepath = os.path.join(settings.BASE_DIR, 'config/scholar_settings.json')
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    try:
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
        return True
    except Exception as e:
        logger.error(f"Error saving scholar settings: {e}")
        return False


def setup_scholarly_proxy():
    """
    Dynamically loads the custom local scholarly package from scholarly_data-main,
    configures ProxyGenerator based on loaded settings, and returns scholarly instance.
    """
    # Ensure local scholarly package in path
    path = os.path.join(settings.BASE_DIR, 'apps/scholar')
    if path not in sys.path:
        sys.path.append(path)
        
    from apps.scholar.scholarly import scholarly, ProxyGenerator
    
    config = get_scholar_settings()
    mode = config.get('SCHOLAR_PROXY_MODE', 'DIRECT')
    
    if not mode or mode == 'DIRECT':
        logger.info("Scholarly: No proxy configured, using direct connection.")
        scholarly.use_proxy(None)
        return scholarly
        
    logger.info(f"Scholarly: Configuring proxy mode: {mode}")
    pg = ProxyGenerator()
    
    if mode == 'SCRAPERAPI':
        key = config.get('SCRAPER_API_KEY', '')
        if key:
            pg.ScraperAPI(key)
            scholarly.use_proxy(pg)
        else:
            logger.warning("SCRAPER_API_KEY is not set. Reverting to direct connection.")
            scholarly.use_proxy(None)
    elif mode == 'FREE_PROXIES' or mode == 'FREEPROXIES':
        pg.FreeProxies()
        scholarly.use_proxy(pg)
    elif mode == 'LUMINATI':
        usr = config.get('SCHOLAR_LUMINATI_USER', '')
        pwd = config.get('SCHOLAR_LUMINATI_PASSWORD', '')
        port = int(config.get('SCHOLAR_LUMINATI_PORT', 0) or 0)
        if usr and pwd and port:
            pg.Luminati(usr, pwd, port)
            scholarly.use_proxy(pg)
        else:
            logger.warning("Luminati parameters not set. Reverting to direct connection.")
            scholarly.use_proxy(None)
    elif mode == 'SINGLEPROXY' or mode == 'SINGLE_PROXY':
        http = config.get('SCHOLAR_HTTP_PROXY', '')
        https = config.get('SCHOLAR_HTTPS_PROXY', '')
        if http or https:
            pg.SingleProxy(http=http, https=https)
            scholarly.use_proxy(pg)
        else:
            logger.warning("Single proxy URL not set. Reverting to direct connection.")
            scholarly.use_proxy(None)
    else:
        logger.warning(f"Unknown proxy mode: {mode}. Reverting to direct connection.")
        scholarly.use_proxy(None)
        
    return scholarly


@shared_task(bind=True)
def scrape_author_profile_task(self, author_id, limit=100, detailed=False):
    """
    Celery task to scrape author profile and publication list from Google Scholar,
    normalize journal titles, match with academic ranks in unified Journal database,
    and save them to PostgreSQL.
    """
    self.update_state(state='PROGRESS', meta={'message': 'Initializing proxy settings...', 'progress': 5})
    
    try:
        scholarly_instance = setup_scholarly_proxy()
    except Exception as e:
        logger.exception("Proxy setup failed")
        self.update_state(state='FAILURE', meta={'message': f"Proxy setup error: {str(e)}"})
        return {'error': f"Failed to setup proxy: {str(e)}"}
        
    self.update_state(state='PROGRESS', meta={'message': f"Fetching author profile: {author_id}...", 'progress': 15})
    
    try:
        author = scholarly_instance.search_author_id(author_id)
    except Exception as e:
        logger.exception(f"Author fetch failed for ID {author_id}")
        self.update_state(state='FAILURE', meta={'message': f"Author profile not found: {str(e)}"})
        return {'error': f"Failed to retrieve author profile: {str(e)}"}
        
    self.update_state(state='PROGRESS', meta={'message': f"Filling publications (limit={limit})...", 'progress': 30})
    
    try:
        author = scholarly_instance.fill(author, sections=['basics', 'indices', 'counts', 'publications'], publication_limit=limit)
    except Exception as e:
        logger.exception(f"Author fill failed for ID {author_id}")
        self.update_state(state='FAILURE', meta={'message': f"Failed to fill profile details: {str(e)}"})
        return {'error': f"Failed to fill profile details: {str(e)}"}
        
    pubs = author.get('publications', [])
    total_pubs = len(pubs)
    failed_publications = []
    
    # If detailed scan is requested, fill each publication detail in parallel using ThreadPoolExecutor
    if detailed and total_pubs > 0:
        import concurrent.futures
        import random
        import threading
        
        state_lock = threading.Lock()
        processed_count = 0
        
        def fill_one_pub(idx_and_pub):
            nonlocal processed_count
            idx, pub = idx_and_pub
            pub_title = pub.get('bib', {}).get('title', '')
            
            # Random delay before starting request to avoid bot detection (same as GUI)
            time.sleep(random.uniform(0.5, 1.5))
            
            try:
                logger.info(f"Filling publication {idx+1}/{total_pubs}: {pub_title}")
                filled = scholarly_instance.fill(pub)
                pub.update(filled)
            except Exception as fill_err:
                logger.warning(f"Failed to fill publication {idx+1}: {fill_err}")
                with state_lock:
                    failed_publications.append({
                        'title': pub_title,
                        'error': str(fill_err)
                    })
                
            with state_lock:
                processed_count += 1
                current_progress = 30 + int((processed_count / total_pubs) * 50)
                msg = f"Cào chi tiết bài báo: {processed_count}/{total_pubs}..."
                self.update_state(
                    state='PROGRESS', 
                    meta={
                        'message': msg, 
                        'progress': current_progress
                    }
                )
        
        # Match desktop tool default threads (using 5 threads for high speed parallel crawl)
        max_workers = 5
        with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
            executor.map(fill_one_pub, list(enumerate(pubs)))
                
    self.update_state(state='PROGRESS', meta={'message': f"Scraped {total_pubs} publications. Processing academic ranks...", 'progress': 80})
    
    # Extract and normalize all unique venue titles to query only what is needed
    venue_raw_titles = set()
    for pub in pubs:
        # Check detailed fields if filled, else fallback to citation
        journal = pub.get('bib', {}).get('journal', '')
        conf = pub.get('bib', {}).get('conference', '')
        venue_raw = journal if journal else conf
        if not venue_raw:
            citation_str = pub.get('bib', {}).get('citation', '')
            venue_raw = extract_venue(citation_str)
        if venue_raw:
            venue_raw_titles.add(venue_raw)
            
    # Batch query local Journals
    journal_cache = {}
    if venue_raw_titles:
        from apps.scholar.models import Journal
        for title in venue_raw_titles:
            norm = normalize_title(title)
            # Find the journal
            j_match = Journal.objects.filter(title_normalized=norm, is_staging=False).first()
            if j_match:
                journal_cache[norm] = j_match
                
    # Use database transaction to write profile and publications
    from django.db import transaction
    from apps.scholar.models import GoogleScholarProfile, Publication
    
    try:
        with transaction.atomic():
            interests = author.get("interests", [])
            # Save or update author profile
            author_profile, created = GoogleScholarProfile.objects.update_or_create(
                scholar_id=author.get("scholar_id"),
                defaults={
                    "name": author.get("name", "Tác giả ẩn danh"),
                    "affiliation": author.get("affiliation", "Không rõ cơ quan công tác"),
                    "citedby": author.get("citedby", 0),
                    "citedby5y": author.get("citedby5y", 0),
                    "hindex": author.get("hindex", 0),
                    "hindex5y": author.get("hindex5y", 0),
                    "i10index": author.get("i10index", 0),
                    "interests": interests,
                }
            )
            
            # Cache existing publications to preserve full authors list and cites history
            existing_pubs = {
                p.title.lower().strip(): p 
                for p in Publication.objects.filter(author=author_profile)
            }
            processed_pub_ids = []
            
            # Insert or update publications
            for idx, pub in enumerate(pubs):
                title = pub['bib'].get('title', 'Không rõ tiêu đề')
                authors = pub['bib'].get('author', '')
                if not authors:
                    authors = pub['bib'].get('citation', '')
                year = pub['bib'].get('pub_year', 'Không rõ')
                num_citations = pub.get('num_citations', 0)
                
                # Normalize authors list
                if not authors:
                    authors_clean = "Chưa xác định"
                elif isinstance(authors, list):
                    authors_clean = ", ".join(authors)
                else:
                    authors_str = str(authors)
                    if ' and ' in authors_str:
                        parts = [p.strip() for p in authors_str.split(' and ') if p.strip()]
                    else:
                        parts = [p.strip() for p in authors_str.split(',') if p.strip()]
                    authors_clean = ", ".join(parts)
                    
                # Extract and map journal venue
                journal = pub.get('bib', {}).get('journal', '')
                conf = pub.get('bib', {}).get('conference', '')
                venue_raw = journal if journal else conf
                if not venue_raw:
                    citation_str = pub.get('bib', {}).get('citation', '')
                    venue_raw = extract_venue(citation_str)
                if not venue_raw:
                    venue_raw = "Tạp chí/Hội nghị chưa xác định"
                    
                # Match to local Journal database
                whitespace_only = False
                norm_title = normalize_title(venue_raw)
                journal_fk = journal_cache.get(norm_title)
                
                sjr_q = "N/A"
                if_val = "N/A"
                wos = "N/A"
                
                if journal_fk:
                    sjr_q = journal_fk.latest_quartile or "N/A"
                    if journal_fk.latest_if is not None:
                        if_val = f"{journal_fk.latest_if:.3f}" if isinstance(journal_fk.latest_if, (int, float)) else str(journal_fk.latest_if)
                    wos = journal_fk.wos_core_collection or "N/A"
                    
                # Cites history
                cites_history = pub.get("cites_per_year", {})
                
                # Merge logic: preserve existing data if it's higher quality
                title_lower = title.lower().strip()
                existing_pub = existing_pubs.get(title_lower)
                
                final_authors = authors_clean
                if existing_pub and existing_pub.authors_list:
                    # If existing has full list (doesn't end with '...') and new has '...', preserve existing
                    if existing_pub.authors_list.strip().endswith('...') and not authors_clean.strip().endswith('...'):
                        pass # New is better (not ending with ellipsis)
                    elif not existing_pub.authors_list.strip().endswith('...') and authors_clean.strip().endswith('...'):
                        final_authors = existing_pub.authors_list # Preserve existing full list
                    elif len(existing_pub.authors_list) > len(authors_clean):
                        final_authors = existing_pub.authors_list
                
                final_cites_history = cites_history
                if existing_pub and existing_pub.cites_per_year and not cites_history:
                    final_cites_history = existing_pub.cites_per_year
                
                pub_obj, created = Publication.objects.update_or_create(
                    author=author_profile,
                    title=title,
                    defaults={
                        "authors_list": final_authors,
                        "venue": venue_raw,
                        "year": year,
                        "citations": num_citations,
                        "display_order": idx,
                        "cites_per_year": final_cites_history,
                        "journal": journal_fk,
                        "sjr_q": sjr_q,
                        "if_val": if_val,
                        "wos": wos,
                    }
                )
                processed_pub_ids.append(pub_obj.id)
                
                # Update progress
                if (idx + 1) % 5 == 0 or (idx + 1) == total_pubs:
                    progress_val = 80 + int(((idx + 1) / total_pubs) * 20)
                    self.update_state(
                        state='PROGRESS', 
                        meta={
                            'message': f"Lưu cơ sở dữ liệu: {idx + 1}/{total_pubs} bài báo...", 
                            'progress': progress_val
                        }
                    )
            
            # Clean up publications that are no longer in Google Scholar
            Publication.objects.filter(author=author_profile).exclude(id__in=processed_pub_ids).delete()
            
            logger.info(f"Successfully processed profile for {author_profile.name} with {total_pubs} publications.")
            
            return {
                'status': 'success',
                'author': {
                    'scholar_id': author_profile.scholar_id,
                    'name': author_profile.name,
                    'affiliation': author_profile.affiliation,
                    'publications_count': total_pubs
                },
                'failed_publications': failed_publications
            }
            
    except Exception as e:
        logger.exception("Database transaction failed during save")
        self.update_state(state='FAILURE', meta={'message': f"Database save error: {str(e)}"})
        return {'error': f"Database save error: {str(e)}"}


# ==============================================================================
# 4. BIOXBIO CRAWLER TASK (No Selenium required!)
# ==============================================================================
@shared_task(bind=True)
def crawl_bioxbio_task(self, start_url="https://www.bioxbio.com/", max_pages=None, max_workers=10, delay=2.0):
    """
    Celery task to scrape BioxBio Impact Factor subjects, journals, and details.
    Updates PostgreSQL tables without heavy Selenium requirements.
    Smartly traverses alphabetical list if start_url points to /journal/.
    """
    self.update_state(state='PROGRESS', meta={'message': 'Initializing BioxBio Crawler...', 'progress': 5})
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    
    try:
        r = requests.get(start_url, headers=headers, timeout=15)
        soup = BeautifulSoup(r.text, 'html.parser')
    except Exception as e:
        logger.exception("Failed to connect to BioxBio")
        return {'error': f"Failed to connect to BioxBio: {str(e)}"}
        
    subject_links = []
    if 'subject/' in start_url:
        subject_links = [start_url]
    elif start_url.rstrip('/').endswith('/journal'):
        logger.info("Smart BioxBio URL detected: looking for letter links (A-Z)...")
        for a in soup.find_all('a', href=True):
            href = a['href']
            full_href = href if href.startswith('http') else f"https://www.bioxbio.com{href}"
            path = full_href.replace("https://www.bioxbio.com", "").rstrip('/')
            parts = path.split('/')
            if len(parts) >= 3 and parts[1] == 'journal' and len(parts[2]) == 1 and parts[2].isalpha():
                subject_links.append(full_href)
        subject_links = sorted(list(set(subject_links)))
    else:
        for a in soup.find_all('a', href=True):
            href = a['href']
            if 'subject/' in href:
                full_link = href if href.startswith('http') else f"https://www.bioxbio.com/{href.lstrip('/')}"
                subject_links.append(full_link)
        subject_links = list(set(subject_links))
        
    if not subject_links:
        subject_links = [start_url]

    import random
    import threading

    total_subjects = len(subject_links)
    logger.info(f"Found {total_subjects} subjects to crawl.")
    journals_scraped_count = 0

    crawler_state = {
        'sleep_until': 0.0
    }
    state_lock = threading.Lock()

    for sub_idx, target_url in enumerate(subject_links):
        subject_name = target_url.rstrip('/').split('/')[-1]
        
        # Check and resume progress
        progress_obj, created = BioxbioCrawlerProgress.objects.get_or_create(
            subject=subject_name,
            defaults={'last_completed_page': 0, 'is_completed': False}
        )
        
        if progress_obj.is_completed:
            logger.info(f"Subject '{subject_name}' already completed. Skipping.")
            continue
            
        page_num = progress_obj.last_completed_page + 1
        self.update_state(state='PROGRESS', meta={'message': f"Crawling subject: {subject_name} (Page {page_num})", 'progress': int(5 + (sub_idx / total_subjects) * 90)})
        
        while True:
            if max_pages and page_num > max_pages:
                logger.info(f"Page limit ({max_pages}) reached for {subject_name}. Stopping.")
                break

            # Check circuit breaker before requesting listing page
            while True:
                with state_lock:
                    sleep_needed = crawler_state['sleep_until'] - time.time()
                if sleep_needed > 0:
                    logger.warning(f"BioxBio Circuit Breaker active. Thread sleeping for {sleep_needed:.1f}s...")
                    time.sleep(sleep_needed)
                else:
                    break

            sep = '&' if '?' in target_url else '?'
            page_url = f"{target_url}{sep}page={page_num}"
            
            try:
                page_res = requests.get(page_url, headers=headers, timeout=15)
                if page_res.status_code in [403, 429]:
                    with state_lock:
                        crawler_state['sleep_until'] = time.time() + 30.0
                    logger.warning(f"Rate limited on index page {page_url}. Pausing crawler for 30s...")
                    time.sleep(30)
                    continue
                if page_res.status_code != 200:
                    break
                page_soup = BeautifulSoup(page_res.text, 'html.parser')
            except Exception as e:
                logger.error(f"Failed to fetch index page {page_url}: {e}")
                break
                
            # Extract journal links
            journal_links = []
            for a in page_soup.find_all('a', href=True):
                href = a['href']
                if '/journal/' in href and not href.endswith('/journal/') and not href.endswith('/journal'):
                    full_link = href if href.startswith('http') else f"https://www.bioxbio.com{href}"
                    journal_links.append((a.get_text().strip(), full_link))
            journal_links = list(set(journal_links))
            
            if not journal_links:
                # Mark category as fully completed
                progress_obj.is_completed = True
                progress_obj.save()
                break
                
            # Fetch details in parallel
            active_batch = []
            for title, link in journal_links:
                norm_title = normalize_title(title)
                # Skip if already exists and has rankings
                if BioxbioJournal.objects.filter(title_normalized=norm_title).exists():
                    j = BioxbioJournal.objects.get(title_normalized=norm_title)
                    if j.raw_rankings.exists():
                        continue
                active_batch.append((title, link))
                
            if active_batch:
                def fetch_detail(item):
                    title_str, link_str = item
                    
                    # Wait if circuit breaker is active
                    while True:
                        with state_lock:
                            sleep_needed = crawler_state['sleep_until'] - time.time()
                        if sleep_needed > 0:
                            time.sleep(sleep_needed)
                        else:
                            break
                            
                    # Add random human-like jitter
                    time.sleep(random.uniform(delay * 0.25, delay * 0.75))

                    try:
                        res_det = requests.get(link_str, headers=headers, timeout=15)
                        if res_det.status_code in [403, 429]:
                            with state_lock:
                                crawler_state['sleep_until'] = time.time() + 30.0
                            logger.error(f"Rate limit / IP block (Status {res_det.status_code}) on {link_str}. Pausing crawler for 30s...")
                            return None
                        if res_det.status_code != 200:
                            return None
                        soup_det = BeautifulSoup(res_det.text, 'html.parser')
                        
                        # ISSNs
                        det_text = soup_det.get_text()
                        issns = re.findall(r'ISSN:\s*([0-9Xx-]{8,9})', det_text, re.IGNORECASE)
                        clean_issns = list(set([i.replace('-', '').strip().upper() for i in issns]))
                        
                        # Rankings
                        rankings = []
                        target_table = None
                        for table in soup_det.find_all('table'):
                            t_text = table.get_text().lower()
                            if 'impact factor' in t_text or 'if' in t_text:
                                target_table = table
                                break
                                
                        if target_table:
                            for tr in target_table.find_all('tr')[1:]:
                                cells = [td.get_text().strip() for td in tr.find_all(['td', 'th'])]
                                if len(cells) >= 2:
                                    y_match = re.search(r'\d{4}', cells[0])
                                    if not y_match:
                                        continue
                                    year_val = int(y_match.group(0))
                                    
                                    if_clean = re.sub(r'[^\d.]', '', cells[1])
                                    try:
                                        if_val = float(if_clean) if if_clean else 0.0
                                    except ValueError:
                                        if_val = 0.0
                                        
                                    arts = None
                                    cits = None
                                    if len(cells) > 2:
                                        arts_c = re.sub(r'\D', '', cells[2])
                                        if arts_c: arts = int(arts_c)
                                    if len(cells) > 3:
                                        cits_c = re.sub(r'\D', '', cells[3])
                                        if cits_c: cits = int(cits_c)
                                        
                                    rankings.append({
                                        'year': year_val,
                                        'impact_factor': if_val,
                                        'total_articles': arts,
                                        'total_cites': cits
                                    })
                        return {
                            'title': title_str,
                            'issns': clean_issns,
                            'rankings': rankings
                        }
                    except Exception as e:
                        logger.error(f"Error fetching detail {link_str}: {e}")
                        return None

                with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
                    futures = {executor.submit(fetch_detail, item): item for item in active_batch}
                    for future in concurrent.futures.as_completed(futures):
                        det_res = future.result()
                        if det_res:
                            with transaction.atomic():
                                norm_t = normalize_title(det_res['title'])
                                biox_j, created = BioxbioJournal.objects.get_or_create(
                                    title_normalized=norm_t,
                                    defaults={'title': det_res['title']}
                                )
                                for issn_code in det_res['issns']:
                                    BioxbioISSN.objects.get_or_create(
                                        issn=issn_code,
                                        defaults={'journal': biox_j}
                                    )
                                for r_item in det_res['rankings']:
                                    BioxbioRanking.objects.update_or_create(
                                        journal=biox_j,
                                        year=r_item['year'],
                                        defaults={
                                            'impact_factor': r_item['impact_factor'],
                                            'total_articles': r_item['total_articles'],
                                            'total_cites': r_item['total_cites']
                                        }
                                    )
                            journals_scraped_count += 1
            
            # Save progress per page
            progress_obj.last_completed_page = page_num
            progress_obj.save()
            page_num += 1
            time.sleep(delay)
            
    return {'status': 'success', 'scraped_journals': journals_scraped_count}


# ==============================================================================
# 5. SCIMAGO CRAWLER TASK (Downloads CSV directly without Selenium)
# ==============================================================================
@shared_task(bind=True)
def crawl_scimago_task(self, start_url="https://www.scimagojr.com/journalrank.php", years=None, max_workers=5, delay=1.0):
    """
    Celery task to download SCImago CSV files directly using requests and import to PostgreSQL.
    """
    if not years:
        # Default to all years from 1999 to current year
        current_year = int(time.strftime("%Y"))
        years = list(range(1999, current_year + 1))
        
    if isinstance(years, int):
        years = [years]

    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    
    total_years = len(years)
    imported_journals_count = 0
    
    for idx, year in enumerate(years):
        self.update_state(state='PROGRESS', meta={'message': f"Downloading SCImago CSV for year {year}...", 'progress': int((idx / total_years) * 100)})
        
        base_url = start_url.split('?')[0]
        url = f"{base_url}?year={year}&out=xls"
        r = None
        for attempt in range(3):
            try:
                r = requests.get(url, headers=headers, timeout=60)
                if r.status_code == 200:
                    break
                logger.warning(f"Failed to download SCImago CSV for {year}: Status {r.status_code}. Retrying in {(attempt+1)*5}s...")
                time.sleep((attempt + 1) * 5)
            except Exception as e:
                logger.warning(f"Failed to download SCImago CSV for {year}: {e}. Retrying in {(attempt+1)*5}s...")
                time.sleep((attempt + 1) * 5)
                
        if not r or r.status_code != 200:
            logger.error(f"Failed to download SCImago CSV for {year} after 3 attempts.")
            continue
            
        try:
            import pandas as pd
            df = pd.read_csv(io.StringIO(r.text), sep=';', low_memory=False)
        except Exception as e:
            logger.exception(f"Error parsing SCImago CSV for year {year}")
            continue
            
        # Clean column headers
        df.columns = [col.strip() for col in df.columns]
        
        # Columns mapping
        col_map = {
            'Sourceid': 'source_id',
            'Title': 'title',
            'Type': 'journal_type',
            'Issn': 'issn',
            'Publisher': 'publisher',
            'Country': 'country',
            'SJR': 'sjr_score',
            'SJR Best Quartile': 'sjr_quartile',
            'H index': 'h_index'
        }
        
        found_cols = {}
        for standard_name, target_name in col_map.items():
            for df_col in df.columns:
                clean_df_col = re.sub(r'[^a-zA-Z0-9]', '', df_col).lower()
                clean_std_name = re.sub(r'[^a-zA-Z0-9]', '', standard_name).lower()
                if clean_df_col == clean_std_name:
                    found_cols[target_name] = df_col
                    break
                    
        if 'source_id' not in found_cols or 'title' not in found_cols:
            logger.error(f"Could not locate essential columns in SCImago CSV for year {year}.")
            continue
            
        journals_to_create = []
        issns_to_create = []
        rankings_to_create = []
        
        self.update_state(state='PROGRESS', meta={'message': f"Importing SCImago records for year {year}...", 'progress': int(((idx + 0.5) / total_years) * 100)})
        
        # We cache all existing source IDs to decide if we bulk_create with ignore or update
        existing_source_ids = set(ScimagoJournal.objects.values_list('source_id', flat=True))
        
        for _, row in df.iterrows():
            try:
                sid = int(row[found_cols['source_id']])
            except Exception:
                continue
                
            title_val = str(row[found_cols['title']]).strip()
            norm_t = normalize_title(title_val)
            
            type_val = str(row[found_cols['journal_type']]).strip() if 'journal_type' in found_cols else ''
            pub_val = str(row[found_cols['publisher']]).strip() if 'publisher' in found_cols else ''
            country_val = str(row[found_cols['country']]).strip() if 'country' in found_cols else ''
            
            # Prepare journal
            if sid not in existing_source_ids:
                journals_to_create.append(ScimagoJournal(
                    source_id=sid,
                    title=title_val,
                    title_normalized=norm_t,
                    journal_type=type_val,
                    publisher=pub_val,
                    country=country_val
                ))
                existing_source_ids.add(sid)
                
            # Prepare ISSNs
            issn_raw = str(row[found_cols['issn']]).strip() if 'issn' in found_cols else ''
            if issn_raw and issn_raw.lower() != 'nan':
                tokens = [i.strip() for i in re.split(r'[,;\s]+', issn_raw) if i.strip()]
                for token in tokens:
                    clean_issn = token.replace("-", "").upper()
                    if len(clean_issn) == 8:
                        issns_to_create.append(ScimagoISSN(
                            journal_id=sid, # Relying on source_id being the primary key / unique index
                            issn=clean_issn
                        ))
                        
            # Prepare ranking
            sjr_raw = row[found_cols['sjr_score']] if 'sjr_score' in found_cols else None
            sjr_q_raw = str(row[found_cols['sjr_quartile']]).strip() if 'sjr_quartile' in found_cols else ''
            h_idx_raw = row[found_cols['h_index']] if 'h_index' in found_cols else None
            
            sjr_val = None
            if sjr_raw is not None:
                try:
                    sjr_val = float(str(sjr_raw).replace(',', '.'))
                except ValueError:
                    pass
            h_val = None
            if h_idx_raw is not None:
                try:
                    h_val = int(h_idx_raw)
                except ValueError:
                    pass
            sjr_q = sjr_q_raw if sjr_q_raw and sjr_q_raw.lower() != 'nan' else '-'
            
            rankings_to_create.append(ScimagoRanking(
                journal_id=sid,
                year=year,
                sjr_score=sjr_val,
                sjr_quartile=sjr_q,
                h_index=h_val
            ))
            
        # Bulk Insert
        with transaction.atomic():
            if journals_to_create:
                for i in range(0, len(journals_to_create), 5000):
                    ScimagoJournal.objects.bulk_create(journals_to_create[i:i+5000], ignore_conflicts=True)
            
            # Cache scimago journals mapping to load primary key relationships for foreign keys
            scimago_pk_map = {obj.source_id: obj.id for obj in ScimagoJournal.objects.filter(source_id__in=existing_source_ids)}
            
            # Re-map foreign keys before bulk saving
            issns_db = []
            for item in issns_to_create:
                j_pk = scimago_pk_map.get(item.journal_id)
                if j_pk:
                    item.journal_id = j_pk
                    issns_db.append(item)
                    
            rankings_db = []
            for item in rankings_to_create:
                j_pk = scimago_pk_map.get(item.journal_id)
                if j_pk:
                    item.journal_id = j_pk
                    rankings_db.append(item)
                    
            if issns_db:
                for i in range(0, len(issns_db), 5000):
                    ScimagoISSN.objects.bulk_create(issns_db[i:i+5000], ignore_conflicts=True)
            if rankings_db:
                for i in range(0, len(rankings_db), 5000):
                    ScimagoRanking.objects.bulk_create(rankings_db[i:i+5000], ignore_conflicts=True)
                    
        imported_journals_count += len(journals_to_create)
        logger.info(f"Completed importing SCImago for year {year}.")
        
    return {'status': 'success', 'imported_journals': imported_journals_count}


# ==============================================================================
# 6. CLARIVATE CRAWLER TASK
# ==============================================================================
@shared_task(bind=True)
def crawl_clarivate_task(self, start_url="https://mjl.clarivate.com/api/mjl/jprof/public/rank-search", max_pages=None, max_workers=3, delay=1.5):
    """
    Celery task to scrape the Clarivate Web of Science Master Journal List page-by-page.
    """
    import random
    self.update_state(state='PROGRESS', meta={'message': 'Connecting to Clarivate REST API...', 'progress': 5})
    url = start_url
    headers = {
        "Accept": "application/json, text/plain, */*",
        "Authorization": "Bearer",
        "Content-Type": "application/json",
        "x-1p-appId": "mjl",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    # 1. Fetch total pages
    search_id = str(hashlib.md5(str(time.time()).encode()).hexdigest())
    payload = {
        "searchValue": "",
        "pageNum": 1,
        "pageSize": 10,
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
    
    try:
        r = requests.post(url, headers=headers, json=payload, timeout=20)
        init_res = r.json()
    except Exception as e:
        logger.exception("Failed to connect to Clarivate API")
        return {'error': f"Failed to connect to Clarivate: {str(e)}"}
        
    total_records = init_res.get('totalRecords', 0)
    page_size = 100
    total_pages = math.ceil(total_records / page_size)
    
    if max_pages:
        total_pages = min(total_pages, int(max_pages))
        
    completed_pages = set(ClarivateCrawlerProgress.objects.filter(is_completed=True).values_list('page', flat=True))
    pending_pages = [p for p in range(1, total_pages + 1) if p not in completed_pages]
    
    total_pending = len(pending_pages)
    self.update_state(state='PROGRESS', meta={'message': f"Found {total_records} Clarivate journals. Crawling {total_pending} pending pages with {max_workers} threads...", 'progress': 10})
    
    scraped_count = 0
    processed_pages = 0
    data_lock = threading.Lock()
    
    crawler_state = {
        'sleep_until': 0.0
    }
    state_lock = threading.Lock()
    
    def fetch_page(page_num):
        page_payload = payload.copy()
        page_payload["pageNum"] = page_num
        page_payload["pageSize"] = page_size
        page_payload["searchIdentifier"] = str(hashlib.md5(f"{time.time()}_{page_num}".encode()).hexdigest())
        
        while True:
            with state_lock:
                sleep_needed = crawler_state['sleep_until'] - time.time()
            if sleep_needed > 0:
                time.sleep(sleep_needed)
            else:
                break
                
        if delay > 0:
            time.sleep(random.uniform(delay * 0.25, delay * 0.75))
            
        try:
            res = requests.post(url, headers=headers, json=page_payload, timeout=20)
            if res.status_code in [403, 429]:
                with state_lock:
                    crawler_state['sleep_until'] = time.time() + 30.0
                logger.error(f"Clarivate API rate limited (Status {res.status_code}). Pausing for 30s...")
                return page_num, None
            if res.status_code == 200:
                return page_num, res.json()
        except Exception as e:
            logger.error(f"Error fetching Clarivate page {page_num}: {e}")
        return page_num, None

    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(fetch_page, p): p for p in pending_pages}
        for future in concurrent.futures.as_completed(futures):
            page_num, data = future.result()
            
            with data_lock:
                processed_pages += 1
                progress_val = int(10 + (processed_pages / total_pending) * 85)
                self.update_state(
                    state='PROGRESS', 
                    meta={
                        'message': f"Processed page {page_num} ({processed_pages}/{total_pending})...", 
                        'progress': progress_val
                    }
                )
                
            if not data:
                continue
                
            profiles = data.get('journalProfiles', [])
            if not profiles:
                continue
                
            records_to_create = []
            for p in profiles:
                profile = p.get('journalProfile', {})
                pub_id = profile.get('publicationId')
                title = profile.get('publicationTitle', '').strip()
                issn = profile.get('issn', '').strip()
                eissn = profile.get('eissn', '').strip()
                publisher = profile.get('publisherName', '').strip()
                addr = profile.get('publisherAddress', '').strip()
                full_publisher = f"{publisher}, {addr}" if addr else publisher
                country = profile.get('country', '').strip()
                
                # Products
                core_codes = {'D', 'SS', 'J', 'H', 'EX'}
                additional_codes = {'A', 'B', 'C', 'P', 'S', 'Y', 'T', 'ES', 'BP', 'BA', 'B7', 'CR', 'I'}
                
                core_list = []
                additional_list = []
                for prod in profile.get('products', []):
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
                
                records_to_create.append(ClarivateJournal(
                    publication_id=pub_id,
                    title=title,
                    title_normalized=normalize_title(title),
                    issn=issn,
                    eissn=eissn,
                    publisher=full_publisher,
                    country=country,
                    wos_core_collection=", ".join(core_list),
                    additional_wos_indexes=" | ".join(additional_list)
                ))
                
            # Batch insert
            with transaction.atomic():
                for i in range(0, len(records_to_create), 5000):
                    ClarivateJournal.objects.bulk_create(records_to_create[i:i+5000], ignore_conflicts=True)
                
                # Save progress
                ClarivateCrawlerProgress.objects.update_or_create(
                    page=page_num,
                    defaults={'is_completed': True}
                )
                
            scraped_count += len(records_to_create)
            
    return {'status': 'success', 'scraped_journals': scraped_count, 'total_expected': total_records}


# ==============================================================================
# 7. INTEGRATE SCORES TASK (Matches & Updates the Mapped database)
# ==============================================================================
@shared_task(bind=True)
def integrate_scores_task(self):
    """
    Celery task that matches raw BioxBio and SCImago journals against Clarivate raw,
    populates unified Journal master entries, and builds direct mapping links.
    Identical double-matching flow as the desktop Tool 5.
    """
    self.update_state(state='PROGRESS', meta={'message': 'Loading raw databases into memory cache...', 'progress': 5})
    Journal.objects.filter(is_staging=True).delete()
    
    # 1. Cache BioxBio and SCImago raw databases in memory for fast local lookup
    biox_cache_by_id = {obj.source_id: obj for obj in BioxbioJournal.objects.exclude(source_id__isnull=True)}
    biox_cache_by_title = {obj.title_normalized: obj for obj in BioxbioJournal.objects.all()}
    
    biox_issns = {}
    for issn_obj in BioxbioISSN.objects.select_related('journal'):
        biox_issns[issn_obj.issn] = issn_obj.journal
        
    scimago_cache_by_id = {obj.source_id: obj for obj in ScimagoJournal.objects.all()}
    scimago_cache_by_title = {obj.title_normalized: obj for obj in ScimagoJournal.objects.all()}
    
    scimago_issns = {}
    for issn_obj in ScimagoISSN.objects.select_related('journal'):
        scimago_issns[issn_obj.issn] = issn_obj.journal

    # Fetch Clarivate Raw journals
    clarivate_journals = ClarivateJournal.objects.all()
    total_count = clarivate_journals.count()
    self.update_state(state='PROGRESS', meta={'message': f"Found {total_count} Clarivate master records. Commencing matching...", 'progress': 15})
    
    # Process in chunks of 2000
    chunk_size = 2000
    processed_count = 0
    
    for start_idx in range(0, total_count, chunk_size):
        batch = list(clarivate_journals[start_idx:start_idx+chunk_size])
        
        with transaction.atomic():
            for raw_j in batch:
                title_norm = raw_j.title_normalized
                if not title_norm:
                    continue
                    
                # A. Try matching against BioxBio
                biox_match = None
                biox_journal_fk = None
                
                # Check ISSN first
                cleaned_issn = raw_j.issn.replace("-", "").strip().upper() if raw_j.issn else ""
                cleaned_eissn = raw_j.eissn.replace("-", "").strip().upper() if raw_j.eissn else ""
                
                if cleaned_issn and cleaned_issn in biox_issns:
                    biox_journal_fk = biox_issns[cleaned_issn]
                    biox_match = "ISSN"
                elif cleaned_eissn and cleaned_eissn in biox_issns:
                    biox_journal_fk = biox_issns[cleaned_eissn]
                    biox_match = "eISSN"
                elif title_norm in biox_cache_by_title:
                    biox_journal_fk = biox_cache_by_title[title_norm]
                    biox_match = "Title Exact"
                    
                # B. Try matching against SCImago
                scimago_match = None
                scimago_journal_fk = None
                
                if cleaned_issn and cleaned_issn in scimago_issns:
                    scimago_journal_fk = scimago_issns[cleaned_issn]
                    scimago_match = "ISSN"
                elif cleaned_eissn and cleaned_eissn in scimago_issns:
                    scimago_journal_fk = scimago_issns[cleaned_eissn]
                    scimago_match = "eISSN"
                elif title_norm in scimago_cache_by_title:
                    scimago_journal_fk = scimago_cache_by_title[title_norm]
                    scimago_match = "Title Exact"

                # C. Extract latest rankings
                biox_if = None
                biox_yr = None
                if biox_journal_fk:
                    latest_biox_rank = biox_journal_fk.raw_rankings.order_by('-year').first()
                    if latest_biox_rank:
                        biox_if = latest_biox_rank.impact_factor
                        biox_yr = latest_biox_rank.year
                        
                scimago_sjr = None
                scimago_yr = None
                scimago_q = None
                scimago_h = None
                if scimago_journal_fk:
                    latest_s_rank = scimago_journal_fk.raw_rankings.order_by('-year').first()
                    if latest_s_rank:
                        scimago_sjr = latest_s_rank.sjr_score
                        scimago_yr = latest_s_rank.year
                        scimago_q = latest_s_rank.sjr_quartile
                        scimago_h = latest_s_rank.h_index

                # Create or update Mapped Journal in staging
                journal, created = Journal.objects.update_or_create(
                    title_normalized=title_norm,
                    is_staging=True,
                    defaults={
                        "clarivate_title": raw_j.title,
                        "issn": raw_j.issn,
                        "eissn": raw_j.eissn,
                        "publisher": raw_j.publisher,
                        "country": raw_j.country,
                        "wos_core_collection": raw_j.wos_core_collection,
                        "additional_wos_indexes": raw_j.additional_wos_indexes,
                        "latest_if": biox_if,
                        "latest_if_year": biox_yr,
                        "latest_sjr": scimago_sjr,
                        "latest_sjr_year": scimago_yr,
                        "latest_quartile": scimago_q,
                        "latest_h_index": scimago_h,
                        "bioxbio_match": biox_match,
                        "bioxbio_journal": biox_journal_fk,
                        "scimago_match": scimago_match,
                        "scimago_journal": scimago_journal_fk,
                    }
                )
                
                # Update ISSN entries for this journal
                for code in filter(None, [cleaned_issn, cleaned_eissn]):
                    JournalISSN.objects.get_or_create(
                        issn=code,
                        defaults={"journal": journal}
                    )
                    
                # Match rankings
                # Add BioxBio and SCImago rankings history
                years_to_process = set()
                biox_ranks_map = {}
                if biox_journal_fk:
                    for r in biox_journal_fk.raw_rankings.all():
                        years_to_process.add(r.year)
                        biox_ranks_map[r.year] = r
                        
                sjr_ranks_map = {}
                if scimago_journal_fk:
                    for r in scimago_journal_fk.raw_rankings.all():
                        years_to_process.add(r.year)
                        sjr_ranks_map[r.year] = r
                        
                for yr in years_to_process:
                    b_rank = biox_ranks_map.get(yr)
                    s_rank = sjr_ranks_map.get(yr)
                    
                    JournalRanking.objects.update_or_create(
                        journal=journal,
                        year=yr,
                        defaults={
                            "impact_factor": b_rank.impact_factor if b_rank else None,
                            "sjr_score": s_rank.sjr_score if s_rank else None,
                            "sjr_quartile": s_rank.sjr_quartile if s_rank else None,
                            "h_index": s_rank.h_index if s_rank else None,
                        }
                    )

        processed_count += len(batch)
        progress_val = int(15 + (processed_count / total_count) * 85)
        self.update_state(
            state='PROGRESS', 
            meta={
                'message': f"Integrated {processed_count} of {total_count} journals...", 
                'progress': progress_val
            }
        )

    logger.info(f"Integrated Academic Scores finished successfully. Processed {total_count} journals.")
    return {'status': 'success', 'integrated_count': total_count}


# ==============================================================================
# 8. UNIFIED PARALLEL COORDINATOR TASK
# ==============================================================================
@shared_task(bind=True)
def crawl_and_integrate_all_task(
    self,
    scimago_years=None,
    scimago_start_url="https://www.scimagojr.com/journalrank.php",
    clarivate_max_pages=None,
    clarivate_start_url="https://mjl.clarivate.com/api/mjl/jprof/public/rank-search",
    clarivate_workers=3,
    clarivate_delay=1.5,
    scimago_workers=5,
    scimago_delay=1.0,
    bioxbio_start_url="https://www.bioxbio.com/journal/",
    bioxbio_max_pages=None,
    bioxbio_workers=10,
    bioxbio_delay=2.0,
):
    """
    Task điều phối tổng hợp:
    1. Khởi chạy song song 3 task cào (Clarivate, SCImago, BioxBio).
    2. Poller Loop: Kiểm tra tiến độ 5s/lần, cập nhật metadata.
    3. Self-Healing: Đếm số lượng DB, cào bù nếu thiếu.
    4. Kích hoạt integrate_scores_task khi đủ 100%.
    """
    from celery.result import AsyncResult

    self.update_state(state='PROGRESS', meta={
        'message': 'Khởi chạy 3 tiến trình cào dữ liệu song song...',
        'progress': 2,
        'clarivate': {'status': 'PENDING', 'progress': 0, 'message': ''},
        'scimago':   {'status': 'PENDING', 'progress': 0, 'message': ''},
        'bioxbio':   {'status': 'PENDING', 'progress': 0, 'message': ''},
        'mapping':   {'status': 'PENDING', 'progress': 0, 'message': ''},
    })

    # --- Phase 1: Launch 3 crawlers in parallel ---
    cl_task = crawl_clarivate_task.delay(
        start_url=clarivate_start_url,
        max_pages=clarivate_max_pages,
        max_workers=clarivate_workers,
        delay=clarivate_delay
    )
    sc_task = crawl_scimago_task.delay(
        start_url=scimago_start_url,
        years=scimago_years,
        max_workers=scimago_workers,
        delay=scimago_delay
    )
    bb_task = crawl_bioxbio_task.delay(
        start_url=bioxbio_start_url,
        max_pages=bioxbio_max_pages,
        max_workers=bioxbio_workers,
        delay=bioxbio_delay
    )

    task_ids = {'clarivate': cl_task.id, 'scimago': sc_task.id, 'bioxbio': bb_task.id}

    # --- Phase 2: Poller Loop ---
    POLL_INTERVAL = 5  # seconds
    MAX_WAIT = 60 * 60 * 12  # 12 giờ timeout tối đa
    waited = 0

    while waited < MAX_WAIT:
        time.sleep(POLL_INTERVAL)
        waited += POLL_INTERVAL

        cl_res = AsyncResult(task_ids['clarivate'])
        sc_res = AsyncResult(task_ids['scimago'])
        bb_res = AsyncResult(task_ids['bioxbio'])

        def _get_info(res):
            status = res.status
            info = res.info or {} if status == 'PROGRESS' else {}
            if not isinstance(info, dict):
                info = {}
            progress = info.get('progress', 0) if status == 'PROGRESS' else \
                       (100 if status == 'SUCCESS' else 0)
            message = info.get('message', '') if status == 'PROGRESS' else status
            return {'status': status, 'progress': progress, 'message': message}

        cl_info = _get_info(cl_res)
        sc_info = _get_info(sc_res)
        bb_info = _get_info(bb_res)

        avg_crawler_pct = (cl_info['progress'] + sc_info['progress'] + bb_info['progress']) // 3
        master_pct = int(avg_crawler_pct * 0.75)  # Crawlers chiếm 0–75%

        self.update_state(state='PROGRESS', meta={
            'message': f"Đang cào song song... Tiến độ trung bình: {avg_crawler_pct}%",
            'progress': master_pct,
            'clarivate': cl_info,
            'scimago': sc_info,
            'bioxbio': bb_info,
            'mapping': {'status': 'PENDING', 'progress': 0, 'message': 'Đang chờ hoàn tất giai đoạn 1...'},
        })

        all_done = all(r.status in ('SUCCESS', 'FAILURE')
                       for r in [cl_res, sc_res, bb_res])
        if all_done:
            break

    # --- Phase 3: Self-Healing Check ---
    self.update_state(state='PROGRESS', meta={
        'message': 'Đang kiểm tra số lượng dữ liệu đã cào...',
        'progress': 76,
        'clarivate': {'status': 'SUCCESS', 'progress': 100, 'message': 'Checking...'},
        'scimago':   {'status': 'SUCCESS', 'progress': 100, 'message': 'Checking...'},
        'bioxbio':   {'status': 'SUCCESS', 'progress': 100, 'message': 'Checking...'},
        'mapping':   {'status': 'PENDING', 'progress': 0, 'message': 'Đang kiểm tra dữ liệu...'},
    })

    # Clarivate self-heal: So sánh DB count với totalRecords từ API
    cl_res = AsyncResult(task_ids['clarivate'])
    cl_result = cl_res.result if cl_res.status == 'SUCCESS' else {}
    if not isinstance(cl_result, dict):
        cl_result = {}
    cl_expected = cl_result.get('total_expected', 0)
    cl_in_db = ClarivateJournal.objects.count()

    if cl_expected > 0 and cl_in_db < cl_expected * 0.98:  # Chấp nhận sai lệch 2%
        logger.warning(f"Self-Healing Clarivate: DB={cl_in_db}, Expected={cl_expected}. Đang cào bù...")
        retry_cl = crawl_clarivate_task.delay(
            start_url=clarivate_start_url,
            max_pages=clarivate_max_pages,
            max_workers=clarivate_workers,
            delay=clarivate_delay
        )
        # Wait for recovery sync
        while not retry_cl.ready():
            time.sleep(5)

    # Bioxbio self-heal: Kiểm tra xem còn subject nào incomplete không
    bioxbio_retry_count = 0
    while bioxbio_retry_count < 3:
        incomplete_biox = BioxbioCrawlerProgress.objects.filter(is_completed=False).count()
        if incomplete_biox > 0:
            logger.warning(f"Self-Healing BioxBio: {incomplete_biox} incomplete subjects. Rerunning...")
            bb_heal = crawl_bioxbio_task.delay(
                start_url=bioxbio_start_url,
                max_pages=bioxbio_max_pages,
                max_workers=bioxbio_workers,
                delay=bioxbio_delay
            )
            while not bb_heal.ready():
                time.sleep(5)
            bioxbio_retry_count += 1
        else:
            break

    # --- Phase 4: Trigger Mapping ---
    self.update_state(state='PROGRESS', meta={
        'message': 'Giai đoạn 1 hoàn tất! Bắt đầu tích hợp và mapping dữ liệu...',
        'progress': 78,
        'clarivate': {'status': 'SUCCESS', 'progress': 100, 'message': 'Completed'},
        'scimago':   {'status': 'SUCCESS', 'progress': 100, 'message': 'Completed'},
        'bioxbio':   {'status': 'SUCCESS', 'progress': 100, 'message': 'Completed'},
        'mapping': {'status': 'PROGRESS', 'progress': 5, 'message': 'Đang khởi chạy integrate_scores_task...'},
    })

    map_task = integrate_scores_task.delay()
    map_task_id = map_task.id

    # Poller loop cho mapping (78% → 100%)
    while True:
        time.sleep(5)
        map_res = AsyncResult(map_task_id)
        map_info = map_res.info or {} if map_res.status == 'PROGRESS' else {}
        if not isinstance(map_info, dict):
            map_info = {}
        map_pct = map_info.get('progress', 0) if map_res.status == 'PROGRESS' else \
                  (100 if map_res.status == 'SUCCESS' else 0)
        master_pct = 78 + int(map_pct * 0.22)

        self.update_state(state='PROGRESS', meta={
            'message': f"Mapping & tích hợp điểm số... {map_pct}%",
            'progress': master_pct,
            'clarivate': {'status': 'SUCCESS', 'progress': 100, 'message': 'Completed'},
            'scimago':   {'status': 'SUCCESS', 'progress': 100, 'message': 'Completed'},
            'bioxbio':   {'status': 'SUCCESS', 'progress': 100, 'message': 'Completed'},
            'mapping': {'status': map_res.status, 'progress': map_pct,
                        'message': map_info.get('message', '')},
        })

        if map_res.status in ('SUCCESS', 'FAILURE'):
            break

    return {
        'status': 'success',
        'clarivate_in_db': ClarivateJournal.objects.count(),
        'scimago_in_db':   ScimagoJournal.objects.count(),
        'bioxbio_in_db':   BioxbioJournal.objects.count(),
        'mapped_journals': Journal.objects.count(),
    }
