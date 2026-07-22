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
import threading
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


def clean_citation_venue(citation_str, pub_year=None):
    """
    Làm sạch chuỗi trích dẫn, loại bỏ năm xuất bản ở cuối nếu trùng với pub_year,
    giữ nguyên thông tin tập/trang.
    """
    if not citation_str or not isinstance(citation_str, str):
        return ""
    citation_str = citation_str.replace("…", "").strip()
    parts = [p.strip() for p in citation_str.split(',')]
    if len(parts) > 1:
        last_part = parts[-1]
        if last_part.isdigit() and len(last_part) == 4:
            if pub_year is None or last_part == str(pub_year):
                return ", ".join(parts[:-1]).strip()
    return citation_str


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
        'SCHOLAR_RETRIES': 3,
        'auto_crawl_enabled': False,
        'auto_crawl_frequency': 'WEEKLY',
        'auto_crawl_hour': 2,
        'auto_crawl_minute': 0,
        'auto_crawl_weekday': 0,
        'auto_crawl_day_of_month': 1,
        'active_unified_task_id': None,
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


def sync_celery_beat_schedule(data):
    """
    Đồng bộ cấu hình lịch cào vào database django-celery-beat.
    """
    try:
        from django_celery_beat.models import PeriodicTask, CrontabSchedule
        import json as json_lib

        task_name = 'scholar_auto_crawl_task'
        enabled = data.get('auto_crawl_enabled', False)
        frequency = data.get('auto_crawl_frequency', 'WEEKLY')
        hour = int(data.get('auto_crawl_hour', 2))
        minute = int(data.get('auto_crawl_minute', 0))
        weekday = int(data.get('auto_crawl_weekday', 0))
        day_of_month = int(data.get('auto_crawl_day_of_month', 1))

        if enabled:
            if frequency == 'WEEKLY':
                celery_dow = str((weekday + 1) % 7)
                day_of_week_str = celery_dow
                day_of_month_str = '*'
            elif frequency == 'MONTHLY':
                day_of_week_str = '*'
                day_of_month_str = str(day_of_month)
            else: # DAILY
                day_of_week_str = '*'
                day_of_month_str = '*'

            schedule, _ = CrontabSchedule.objects.get_or_create(
                minute=str(minute),
                hour=str(hour),
                day_of_week=day_of_week_str,
                day_of_month=day_of_month_str,
                month_of_year='*',
                timezone='Asia/Ho_Chi_Minh',
            )
            PeriodicTask.objects.update_or_create(
                name=task_name,
                defaults={
                    'task': 'apps.scholar.tasks.crawl_and_integrate_all_task',
                    'crontab': schedule,
                    'enabled': True,
                    'kwargs': json_lib.dumps({'is_automated': True}),
                    'description': f'Tự động cào và đồng bộ dữ liệu journal theo lịch ({frequency}, giờ VN)',
                }
            )
            logger.info(f"Celery Beat schedule updated: frequency={frequency}, hour={hour:02d}:{minute:02d} (Asia/Ho_Chi_Minh)")
        else:
            PeriodicTask.objects.filter(name=task_name).update(enabled=False)
            logger.info("Celery Beat auto-crawl schedule disabled")
    except Exception as e:
        logger.error(f"sync_celery_beat_schedule error: {e}")


def save_scholar_settings(data):
    import json
    filepath = os.path.join(settings.BASE_DIR, 'config/scholar_settings.json')
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    try:
        current = get_scholar_settings()
        current.update(data)
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(current, f, indent=4, ensure_ascii=False)
        
        # Sync schedule configuration to database
        sync_celery_beat_schedule(current)
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
    
    if not mode or mode == 'DIRECT' or mode == 'TOR':
        # Try setting up Tor Proxy with Host Fallback first if available
        from apps.scholar.scholarly.tor_helper import setup_tor_proxy_with_fallback
        tor_host = os.environ.get("TOR_SOCKS_HOST", "tor")
        tor_port = int(os.environ.get("TOR_SOCKS_PORT", 9050))
        if setup_tor_proxy_with_fallback(socks_host=tor_host, socks_port=tor_port):
            logger.info("Scholarly: Configured Tor SOCKS5 Proxy successfully.")
            return scholarly
        logger.info("Scholarly: Tor Proxy not available, using direct connection.")
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
        raise Exception(f"Proxy setup error: {str(e)}") from e
        
    tor_host = os.environ.get("TOR_SOCKS_HOST", "tor")
    tor_port = int(os.environ.get("TOR_SOCKS_PORT", 9050))
    control_host = os.environ.get("TOR_CONTROL_HOST", "tor")
    control_port = int(os.environ.get("TOR_CONTROL_PORT", 9051))
    password = os.environ.get("TOR_PASSWORD", "scholar_secret_control_pass")

    max_attempts = 6
    author = None
    last_err = None

    for attempt in range(1, max_attempts + 1):
        try:
            if attempt == 1:
                msg = f"Đang kết nối Tor Proxy & cào hồ sơ tác giả: {author_id}..."
            else:
                msg = f"Tự động đổi IP Tor thành công. Đang thử lại cào hồ sơ cho {author_id} (Lần {attempt}/{max_attempts})..."

            self.update_state(state='PROGRESS', meta={'message': msg, 'progress': 15})

            from apps.scholar.scholarly.tor_helper import renew_tor_ip, setup_tor_proxy_with_fallback
            setup_tor_proxy_with_fallback(socks_host=tor_host, socks_port=tor_port)

            author = scholarly_instance.search_author_id(author_id, filled=False)
            if author:
                break
        except Exception as e:
            last_err = e
            logger.warning(f"Single CV Scraper Attempt {attempt}/{max_attempts} failed for ID {author_id}: {e}")
            if attempt < max_attempts:
                self.update_state(
                    state='PROGRESS',
                    meta={
                        'message': f"Bị Google Scholar chặn IP (Lần {attempt}). Đang phát tín hiệu NEWNYM tự động đổi IP Tor mới...",
                        'progress': 15
                    }
                )
                renew_tor_ip(control_host=control_host, control_port=control_port, password=password, rebuild_wait=1.5)

    if not author:
        logger.exception(f"Author fetch failed for ID {author_id}")
        raise Exception(f"Đã tự động đổi {max_attempts} IP Tor nhưng vẫn bị Google Captcha cho ID {author_id}: {str(last_err)}")

    author_name = author.get("name", author_id)
    initial_pubs = author.get("publications", [])
    initial_count = len(initial_pubs)

    msg = f"Đã tìm thấy hồ sơ tác giả: {author_name} ({initial_count} bài báo trang 1). Đang nạp dữ liệu..."
    self.update_state(state='PROGRESS', meta={'message': msg, 'progress': 35})

    try:
        if limit > 0 and limit <= 100 and initial_count >= limit:
            # We already have all requested publications from Page 1! No extra pub list requests needed!
            author = scholarly_instance.fill(author, sections=['basics', 'indices', 'counts'])
            author['publications'] = initial_pubs[:limit]
        elif limit > 0 and limit <= 100:
            author = scholarly_instance.fill(author, sections=['basics', 'indices', 'counts', 'publications'], publication_limit=limit)
        else: # limit == 0 (Unlimited)
            self.update_state(state='PROGRESS', meta={'message': f"Đang nạp toàn bộ bài báo cho {author_name}...", 'progress': 45})
            author = scholarly_instance.fill(author, sections=['basics', 'indices', 'counts', 'publications'], publication_limit=0)
    except Exception as e:
        logger.exception(f"Author fill failed for ID {author_id}")
        raise Exception(f"Failed to fill profile details for {author_name}: {str(e)}") from e
        
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

        # High-performance parallel workers over Tor SOCKS5 proxy (10 parallel threads!)
        max_workers = 15
        min_delay, max_delay = 0.01, 0.05

        last_renew_time = 0.0
        renew_lock = threading.Lock()

        def safe_renew_tor_ip():
            nonlocal last_renew_time
            with renew_lock:
                now = time.time()
                if now - last_renew_time > 3.0:
                    from apps.scholar.scholarly.tor_helper import renew_tor_ip
                    renew_tor_ip(rebuild_wait=0.5)
                    last_renew_time = time.time()

        def fill_one_pub(idx_and_pub):
            nonlocal processed_count
            idx, pub = idx_and_pub
            pub_title = pub.get('bib', {}).get('title', '')
            
            # Tiny stagger delay before request
            time.sleep(random.uniform(min_delay, max_delay))
            
            success = False
            last_err = None
            for attempt in range(3):
                try:
                    logger.info(f"Filling publication {idx+1}/{total_pubs} (attempt {attempt+1}): {pub_title}")
                    filled = scholarly_instance.fill(pub)
                    pub.update(filled)
                    success = True
                    break
                except Exception as fill_err:
                    last_err = fill_err
                    logger.warning(f"Attempt {attempt+1} failed to fill publication {idx+1}: {fill_err}")
                    if attempt < 2:
                        safe_renew_tor_ip()
            
            if not success:
                logger.warning(f"Failed to fill publication {idx+1} after 3 attempts: {last_err}")
                with state_lock:
                    failed_publications.append({
                        'title': pub_title,
                        'error': str(last_err)
                    })
                
            with state_lock:
                processed_count += 1
                current_progress = 30 + int((processed_count / total_pubs) * 50)
                msg = f"Cào chi tiết bài báo (Đa luồng 10 IP Tor): {processed_count}/{total_pubs}..."
                self.update_state(
                    state='PROGRESS', 
                    meta={
                        'message': msg, 
                        'progress': current_progress
                    }
                )
        
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
    from apps.scholar.models import AuthorProfile, Publication
    
    try:
        with transaction.atomic():
            interests = author.get("interests", [])
            # Save or update author profile
            author_profile, created = AuthorProfile.objects.update_or_create(
                scholar_id=author.get("scholar_id"),
                defaults={
                    "name": author.get("name", "Tác giả ẩn danh"),
                    "affiliation": author.get("affiliation", "Không rõ cơ quan công tác"),
                    "email_domain": author.get("email_domain", "") or None,
                    "citedby": author.get("citedby", 0),
                    "citedby5y": author.get("citedby5y", 0),
                    "hindex": author.get("hindex", 0),
                    "hindex5y": author.get("hindex5y", 0),
                    "i10index": author.get("i10index", 0),
                    "i10index5y": author.get("i10index5y", 0),
                    "cites_per_year": author.get("cites_per_year", {}),
                    "interests": interests,
                }
            )
            
            # Cache existing publications to preserve full authors list and cites history
            existing_pubs = {
                p.display_order: p 
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
                
                # Check for database matching clean title
                clean_venue_matching = venue_raw
                if not clean_venue_matching:
                    citation_str = pub.get('bib', {}).get('citation', '')
                    clean_venue_matching = extract_venue(citation_str)
                    
                # Save display venue including volume/issue/pages for Crawl 1
                if not venue_raw:
                    citation_str = pub.get('bib', {}).get('citation', '')
                    venue_raw = clean_citation_venue(citation_str, year)
                if not venue_raw:
                    venue_raw = "Tạp chí/Hội nghị chưa xác định"
                    
                # Match to local Journal database
                whitespace_only = False
                norm_title = normalize_title(clean_venue_matching)
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
                existing_pub = existing_pubs.get(idx)
                
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
                
                # Extract new metadata fields
                pub_date = pub.get('bib', {}).get('pub_date', '')
                volume = pub.get('bib', {}).get('volume', '')
                issue = pub.get('bib', {}).get('number', '')
                pages = pub.get('bib', {}).get('pages', '')
                publisher = pub.get('bib', {}).get('publisher', '')
                description = pub.get('bib', {}).get('abstract', '')
                pub_url = pub.get('pub_url', '')
                eprint_url = pub.get('eprint_url', '')
                url_related_articles = pub.get('url_related_articles', '')
                versions_count = pub.get('versions_count', '')
                url_all_versions = pub.get('url_all_versions', '')
                url_scholar_article = pub.get('url_scholar_article', '')

                # Extract cites_id
                cites_id_list = pub.get('cites_id', [])
                cites_id = cites_id_list[0] if isinstance(cites_id_list, list) and cites_id_list else (cites_id_list or '')

                # Merge logic: preserve existing metadata fields if already present
                if existing_pub:
                    if not pub_date and existing_pub.pub_date:
                        pub_date = existing_pub.pub_date
                    if not volume and existing_pub.volume:
                        volume = existing_pub.volume
                    if not issue and existing_pub.issue:
                        issue = existing_pub.issue
                    if not pages and existing_pub.pages:
                        pages = existing_pub.pages
                    if not publisher and existing_pub.publisher:
                        publisher = existing_pub.publisher
                    if not description and existing_pub.description:
                        description = existing_pub.description
                    if not pub_url and existing_pub.pub_url:
                        pub_url = existing_pub.pub_url
                    if not eprint_url and existing_pub.eprint_url:
                        eprint_url = existing_pub.eprint_url
                    if not url_related_articles and existing_pub.url_related_articles:
                        url_related_articles = existing_pub.url_related_articles
                    if not versions_count and existing_pub.versions_count:
                        versions_count = existing_pub.versions_count
                    if not url_all_versions and existing_pub.url_all_versions:
                        url_all_versions = existing_pub.url_all_versions
                    if not cites_id and existing_pub.cites_id:
                        cites_id = existing_pub.cites_id
                    if not url_scholar_article and existing_pub.url_scholar_article:
                        url_scholar_article = existing_pub.url_scholar_article

                from urllib.parse import quote_plus
                if not url_related_articles:
                    if cites_id:
                        url_related_articles = f"https://scholar.google.com/scholar?q=related:{cites_id}"
                    elif title:
                        url_related_articles = f"https://scholar.google.com/scholar?q=related:{quote_plus(title)}"

                if not url_all_versions:
                    if cites_id:
                        url_all_versions = f"https://scholar.google.com/scholar?cluster={cites_id}"
                    elif title:
                        url_all_versions = f"https://scholar.google.com/scholar?q={quote_plus(title)}"

                pub_obj, created = Publication.objects.update_or_create(
                    author=author_profile,
                    display_order=idx,
                    defaults={
                        "title": title,
                        "authors_list": final_authors,
                        "venue": venue_raw,
                        "year": year,
                        "citations": num_citations,
                        "cites_per_year": final_cites_history,
                        "journal": journal_fk,
                        "sjr_q": sjr_q,
                        "if_val": if_val,
                        "wos": wos,
                        "pub_date": pub_date or None,
                        "volume": volume or None,
                        "issue": issue or None,
                        "pages": pages or None,
                        "publisher": publisher or None,
                        "description": description or None,
                        "pub_url": pub_url or None,
                        "eprint_url": eprint_url or None,
                        "url_related_articles": url_related_articles or None,
                        "versions_count": versions_count or None,
                        "url_all_versions": url_all_versions or None,
                        "cites_id": cites_id or None,
                        "url_scholar_article": url_scholar_article or None,
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
        raise Exception(f"Database save error: {str(e)}") from e


# ==============================================================================
# FAST SMART CHECK & CELERY BEAT AUTO-SCAN TASKS
# ==============================================================================

@shared_task(bind=True, max_retries=5)
def scrape_author_cv_smart_task(self, author_id):
    """
    Executes a Fast Smart Check (1-request profile inspection) over Tor SOCKS5 proxy.
    Automatically rotates Tor Exit Node IP in an internal loop if rate-limited by Google Scholar.
    """
    from apps.scholar.models import AuthorProfile, Publication, AutoScanConfig
    from apps.scholar.scholarly import scholarly
    from apps.scholar.scholarly.tor_helper import renew_tor_ip, setup_tor_proxy_with_fallback
    from django.utils import timezone
    import random
    import time
    import os

    config = AutoScanConfig.get_solo()
    try:
        author = AuthorProfile.objects.get(id=author_id)
    except AuthorProfile.DoesNotExist:
        return {"status": "error", "message": f"Author {author_id} not found"}

    tor_host = os.environ.get("TOR_SOCKS_HOST", "tor")
    tor_port = int(os.environ.get("TOR_SOCKS_PORT", 9050))
    control_host = os.environ.get("TOR_CONTROL_HOST", "tor")
    control_port = int(os.environ.get("TOR_CONTROL_PORT", 9051))
    password = os.environ.get("TOR_PASSWORD", "scholar_secret_control_pass")

    max_attempts = 6
    author_online = None
    last_exception = None

    for attempt in range(1, max_attempts + 1):
        try:
            config.current_job_status = "RUNNING"
            config.current_job_progress = min(15 + attempt * 10, 85)
            if attempt == 1:
                config.current_job_detail = f"Đang kết nối Tor Proxy & kiểm tra Fast Smart Check cho: {author.name}"
            else:
                config.current_job_detail = f"Tự động đổi IP Tor lần {attempt-1} thành công. Đang thử lại cào CV cho {author.name} (Lần {attempt}/{max_attempts})..."
            config.save(update_fields=["current_job_status", "current_job_progress", "current_job_detail"])

            setup_tor_proxy_with_fallback(socks_host=tor_host, socks_port=tor_port)

            # Step 1: Light Fetch (Page 1 Profile, pagesize=100) - 1 Request Only!
            author_online = scholarly.search_author_id(author.scholar_id, filled=False)
            if author_online:
                break
        except Exception as exc:
            last_exception = exc
            logger.warning(f"Attempt {attempt}/{max_attempts} failed for author {author.name}: {exc}")
            if attempt < max_attempts:
                config.current_job_detail = f"Bị Google chặn IP (Lần {attempt}). Đang phát tín hiệu NEWNYM tự động đổi IP Tor..."
                config.save(update_fields=["current_job_detail"])
                renew_tor_ip(control_host=control_host, control_port=control_port, password=password, rebuild_wait=5)

    if not author_online:
        author.last_scan_status = "FAILED_CAPTCHA"
        author.save(update_fields=["last_scan_status"])

        config.current_job_status = "FAILED"
        config.current_job_progress = 0
        config.current_job_detail = f"Đã tự động đổi {max_attempts} IP Tor nhưng vẫn bị Google Captcha cho {author.name}."
        config.save(update_fields=["current_job_status", "current_job_progress", "current_job_detail"])

        retry_delay = random.randint(30, 60)
        raise self.retry(exc=last_exception, countdown=retry_delay)

    try:
        online_pubs = author_online.get("publications", [])
        online_count = len(online_pubs)

        existing_pubs = list(author.publications.order_by("display_order").values_list("title", flat=True))
        existing_count = len(existing_pubs)

        # Top 3 titles comparison
        top3_online = [p.get("bib", {}).get("title", "").strip().lower() for p in online_pubs[:3]]
        top3_db = [t.strip().lower() for t in existing_pubs[:3]]

        # Fast Smart Check condition
        if online_count == existing_count and top3_online == top3_db:
            author.last_scraped_at = timezone.now()
            author.last_scan_status = "UP_TO_DATE"
            author.publication_count_cached = online_count
            author.save(update_fields=["last_scraped_at", "last_scan_status", "publication_count_cached"])

            config.current_job_status = "COMPLETED"
            config.current_job_progress = 100
            config.current_job_detail = f"CV tác giả {author.name} chưa có bài mới. Hoàn thành 1-request!"
            config.save(update_fields=["current_job_status", "current_job_progress", "current_job_detail"])

            # Cooldown sleep between CVs
            cooldown = random.uniform(config.cooldown_min_seconds, config.cooldown_max_seconds)
            time.sleep(cooldown)
            return {
                "status": "success",
                "mode": "smart_check_skipped",
                "author": author.name,
                "message": f"Up-to-date. Skipped full fetch in 1 request. (Count: {online_count})"
            }

        # Step 2: New publications detected -> Fill & Ingest missing publications
        author.last_scan_status = "IN_PROGRESS"
        author.save(update_fields=["last_scan_status"])

        config.current_job_progress = 90
        config.current_job_detail = f"Phát hiện bài mới cho {author.name}. Đang cào bổ sung..."
        config.save(update_fields=["current_job_progress", "current_job_detail"])

        # Process new/missing publications
        new_count = 0
        existing_titles_set = set(t.strip().lower() for t in existing_pubs)

        for idx, pub_entry in enumerate(online_pubs):
            pub_title = pub_entry.get("bib", {}).get("title", "").strip()
            if pub_title.lower() not in existing_titles_set:
                # Apply human-like delay per page/publication
                time.sleep(random.uniform(config.delay_min_seconds, config.delay_max_seconds))

                # Create or update publication record
                pub_date = pub_entry.get("bib", {}).get("pub_year", None)
                Publication.objects.create(
                    author=author,
                    display_order=idx,
                    title=pub_title,
                    authors_list=pub_entry.get("bib", {}).get("author", ""),
                    venue=pub_entry.get("bib", {}).get("venue", ""),
                    year=str(pub_date) if pub_date else "",
                    citations=pub_entry.get("num_citations", 0),
                    url_related_articles=pub_entry.get("url_related_articles"),
                    url_all_versions=pub_entry.get("url_all_versions"),
                    versions_count=pub_entry.get("versions_count"),
                )
                new_count += 1

        author.last_scraped_at = timezone.now()
        author.last_scan_status = "UPDATED"
        author.publication_count_cached = author.publications.count()
        author.save(update_fields=["last_scraped_at", "last_scan_status", "publication_count_cached"])

        config.current_job_status = "COMPLETED"
        config.current_job_progress = 100
        config.current_job_detail = f"Đã bổ sung {new_count} bài báo mới cho tác giả {author.name}"
        config.save(update_fields=["current_job_status", "current_job_progress", "current_job_detail"])

        # Cooldown between CVs
        time.sleep(random.uniform(config.cooldown_min_seconds, config.cooldown_max_seconds))

        return {
            "status": "success",
            "mode": "updated",
            "author": author.name,
            "new_publications_added": new_count
        }

    except Exception as exc:
        logger.error(f"Error processing publications for author {author.name}: {exc}")
        author.last_scan_status = "FAILED_CAPTCHA"
        author.save(update_fields=["last_scan_status"])

        config.current_job_status = "FAILED"
        config.current_job_progress = 0
        config.current_job_detail = f"Lỗi xử lý bài báo cho tác giả {author.name}: {exc}"
        config.save(update_fields=["current_job_status", "current_job_progress", "current_job_detail"])
        raise exc


@shared_task
def scheduled_auto_scan_cv_task():
    """
    Celery Beat task triggered periodically.
    Selects eligible author CVs needing scanning and dispatches smart check tasks.
    Checks preferred_hour, preferred_weekday, and preferred_day_of_month settings.
    """
    from apps.scholar.models import AuthorProfile, AutoScanConfig
    from django.db import models
    from django.utils import timezone
    from datetime import timedelta

    config = AutoScanConfig.get_solo()
    if not config.is_active:
        return {"status": "skipped", "reason": "Auto scan configuration is disabled"}

    now = timezone.now()
    if config.frequency_type == "WEEKLY" and now.weekday() != config.preferred_weekday:
        return {"status": "skipped", "reason": f"Today (weekday {now.weekday()}) is not preferred weekday ({config.preferred_weekday})"}
    if config.frequency_type == "MONTHLY" and now.day != config.preferred_day_of_month:
        return {"status": "skipped", "reason": f"Today (day {now.day}) is not preferred day of month ({config.preferred_day_of_month})"}
    if now.hour < config.preferred_hour:
        return {"status": "skipped", "reason": f"Current hour ({now.hour}) is earlier than preferred hour ({config.preferred_hour}:00)"}

    threshold_time = timezone.now() - timedelta(hours=config.scan_interval_hours)

    # Query authors enabled for auto scan and due for check
    eligible_authors = AuthorProfile.objects.filter(
        auto_scan_enabled=True
    ).filter(
        models.Q(last_scraped_at__isnull=True) | models.Q(last_scraped_at__lte=threshold_time)
    )[:config.batch_size_per_hour]

    dispatched = []
    for author in eligible_authors:
        scrape_author_cv_smart_task.delay(author.id)
        dispatched.append(author.name)

    return {"status": "success", "dispatched_count": len(dispatched), "authors": dispatched}


# ==============================================================================
# 4. BIOXBIO CRAWLER TASK (No Selenium required!)
# ==============================================================================
@shared_task(bind=True)
def crawl_bioxbio_task(self, start_url="https://www.bioxbio.com/", max_pages=None, max_workers=20, delay=0.3):
    """
    Celery task to scrape BioxBio Impact Factor subjects, journals, and details.
    Updates PostgreSQL tables without heavy Selenium requirements.
    Smartly traverses alphabetical list if start_url points to /journal/.
    """
    self.update_state(state='PROGRESS', meta={'message': 'Initializing BioxBio Crawler...', 'progress': 5})
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    
    session = requests.Session()
    from requests.adapters import HTTPAdapter
    adapter = HTTPAdapter(pool_connections=50, pool_maxsize=50)
    session.mount('http://', adapter)
    session.mount('https://', adapter)

    from apps.scholar.scholarly.tor_helper import get_tor_proxies
    tor_proxies = get_tor_proxies()
    if tor_proxies:
        session.proxies.update(tor_proxies)
        logger.info(f"BioxBio Crawler: Using Docker Tor Proxy ({tor_proxies['http']})")
    
    try:
        r = session.get(start_url, headers=headers, timeout=15)
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

    existing_biox_titles = set(
        BioxbioJournal.objects.filter(raw_rankings__isnull=False)
        .values_list('title_normalized', flat=True)
        .distinct()
    )

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
                page_res = session.get(page_url, headers=headers, timeout=15)
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
                # Skip if already exists in our cache set
                if norm_title in existing_biox_titles:
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
                        res_det = session.get(link_str, headers=headers, timeout=15)
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
                                existing_biox_titles.add(norm_t)
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
def crawl_scimago_task(self, start_url="https://www.scimagojr.com/journalrank.php", years=None, max_workers=10, delay=0.2):
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
        
        # Optimize: skip download for past years if already exists in DB
        current_year = int(time.strftime("%Y"))
        if year < current_year and ScimagoRanking.objects.filter(year=year).exists():
            logger.info(f"SCImago CSV for past year {year} already exists in DB. Skipping.")
            continue
            
        base_url = start_url.split('?')[0]
        url = f"{base_url}?year={year}&out=xls"
        r = None
        from apps.scholar.scholarly.tor_helper import get_tor_proxies
        tor_proxies = get_tor_proxies()
        for attempt in range(3):
            try:
                r = requests.get(url, headers=headers, proxies=tor_proxies, timeout=60)
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
        existing_rankings = set(ScimagoRanking.objects.filter(year=year).values_list('journal__source_id', flat=True))
        
        for _, row in df.iterrows():
            try:
                sid = int(row[found_cols['source_id']])
            except Exception:
                continue
                
            if sid in existing_rankings:
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
def crawl_clarivate_task(self, start_url="https://mjl.clarivate.com/api/mjl/jprof/public/rank-search", max_pages=None, max_workers=15, delay=0.1):
    """
    Celery task to scrape the Clarivate Web of Science Master Journal List page-by-page.
    """
    import random
    existing_ids = set(ClarivateJournal.objects.values_list('publication_id', flat=True))
    self.update_state(state='PROGRESS', meta={'message': 'Connecting to Clarivate REST API...', 'progress': 5})
    url = start_url
    headers = {
        "Accept": "application/json, text/plain, */*",
        "Authorization": "Bearer",
        "Content-Type": "application/json",
        "x-1p-appId": "mjl",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    session = requests.Session()
    from requests.adapters import HTTPAdapter
    adapter = HTTPAdapter(pool_connections=50, pool_maxsize=50)
    session.mount('http://', adapter)
    session.mount('https://', adapter)

    from apps.scholar.scholarly.tor_helper import get_tor_proxies
    tor_proxies = get_tor_proxies()
    if tor_proxies:
        session.proxies.update(tor_proxies)
        logger.info(f"Clarivate Crawler: Using Docker Tor Proxy ({tor_proxies['http']})")
    
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
        r = session.post(url, headers=headers, json=payload, timeout=20)
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
            res = session.post(url, headers=headers, json=page_payload, timeout=20)
            if res.status_code in [403, 429]:
                from apps.scholar.scholarly.tor_helper import renew_tor_ip
                renew_tor_ip()
                with state_lock:
                    crawler_state['sleep_until'] = time.time() + 2.0
                logger.warning(f"Clarivate API rate limited (Status {res.status_code}). Renewed Tor IP & resuming in 2s...")
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
                if pub_id in existing_ids:
                    continue
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
            for r in records_to_create:
                existing_ids.add(r.publication_id)
                
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
    Optimized to use in-memory caches and bulk creations for maximum speed.
    """
    self.update_state(state='PROGRESS', meta={'message': 'Loading raw databases into memory cache...', 'progress': 5})
    # Optimize staging cleanup: use raw SQL delete to avoid heavy Django ORM cascade in Python memory
    from django.db import connection
    with connection.cursor() as cursor:
        cursor.execute("""
            DELETE FROM scholar_journal_rankings 
            WHERE journal_id IN (SELECT id FROM scholar_journals WHERE is_staging = TRUE)
        """)
        cursor.execute("""
            DELETE FROM scholar_journal_issns 
            WHERE journal_id IN (SELECT id FROM scholar_journals WHERE is_staging = TRUE)
        """)
        cursor.execute("DELETE FROM scholar_journals WHERE is_staging = TRUE")
    
    # 1. Cache BioxBio and SCImago raw databases in memory for fast local lookup
    biox_journals = list(BioxbioJournal.objects.all())
    biox_cache_by_id = {obj.id: obj for obj in biox_journals}
    biox_cache_by_title = {obj.title_normalized: obj for obj in biox_journals}
    
    biox_issns = {}
    for issn, journal_id in BioxbioISSN.objects.values_list('issn', 'journal_id'):
        biox_issns[issn] = journal_id
        
    scimago_journals = list(ScimagoJournal.objects.all())
    scimago_cache_by_id = {obj.id: obj for obj in scimago_journals}
    scimago_cache_by_title = {obj.title_normalized: obj for obj in scimago_journals}
    
    scimago_issns = {}
    for issn, journal_id in ScimagoISSN.objects.values_list('issn', 'journal_id'):
        scimago_issns[issn] = journal_id

    # Cache rankings in memory to prevent database roundtrips
    from collections import defaultdict
    
    biox_rankings = defaultdict(list)
    for r in BioxbioRanking.objects.values('journal_id', 'year', 'impact_factor').order_by('-year'):
        biox_rankings[r['journal_id']].append(r)
        
    scimago_rankings = defaultdict(list)
    for r in ScimagoRanking.objects.values('journal_id', 'year', 'sjr_score', 'sjr_quartile', 'h_index').order_by('-year'):
        scimago_rankings[r['journal_id']].append(r)

    # Cache existing ISSNs to avoid duplicate key errors
    existing_issns = set(JournalISSN.objects.values_list('issn', flat=True))

    # Fetch Clarivate Raw journals
    clarivate_journals = ClarivateJournal.objects.all()
    total_count = clarivate_journals.count()
    self.update_state(state='PROGRESS', meta={'message': f"Found {total_count} Clarivate master records. Commencing matching...", 'progress': 15})
    
    journals_by_title = {}
    inserted_issns_in_run = set()
    
    # Matching pass (100% in-memory)
    for idx, raw_j in enumerate(clarivate_journals):
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
            biox_journal_fk = biox_cache_by_id.get(biox_issns[cleaned_issn])
            biox_match = "ISSN"
        elif cleaned_eissn and cleaned_eissn in biox_issns:
            biox_journal_fk = biox_cache_by_id.get(biox_issns[cleaned_eissn])
            biox_match = "eISSN"
        elif title_norm in biox_cache_by_title:
            biox_journal_fk = biox_cache_by_title[title_norm]
            biox_match = "Title Exact"
            
        # B. Try matching against SCImago
        scimago_match = None
        scimago_journal_fk = None
        
        if cleaned_issn and cleaned_issn in scimago_issns:
            scimago_journal_fk = scimago_cache_by_id.get(scimago_issns[cleaned_issn])
            scimago_match = "ISSN"
        elif cleaned_eissn and cleaned_eissn in scimago_issns:
            scimago_journal_fk = scimago_cache_by_id.get(scimago_issns[cleaned_eissn])
            scimago_match = "eISSN"
        elif title_norm in scimago_cache_by_title:
            scimago_journal_fk = scimago_cache_by_title[title_norm]
            scimago_match = "Title Exact"

        # C. Extract latest rankings
        biox_if = None
        biox_yr = None
        biox_ranks_list = []
        if biox_journal_fk:
            biox_ranks_list = biox_rankings.get(biox_journal_fk.id, [])
            if biox_ranks_list:
                latest_biox_rank = biox_ranks_list[0]
                biox_if = latest_biox_rank.get('impact_factor')
                biox_yr = latest_biox_rank.get('year')
                
        scimago_sjr = None
        scimago_yr = None
        scimago_q = None
        scimago_h = None
        scimago_ranks_list = []
        if scimago_journal_fk:
            scimago_ranks_list = scimago_rankings.get(scimago_journal_fk.id, [])
            if scimago_ranks_list:
                latest_s_rank = scimago_ranks_list[0]
                scimago_sjr = latest_s_rank.get('sjr_score')
                scimago_yr = latest_s_rank.get('year')
                scimago_q = latest_s_rank.get('sjr_quartile')
                scimago_h = latest_s_rank.get('h_index')

        defaults = {
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
        
        if title_norm in journals_by_title:
            journal_obj = journals_by_title[title_norm]
            for k, v in defaults.items():
                setattr(journal_obj, k, v)
        else:
            journal_obj = Journal(
                title_normalized=title_norm,
                is_staging=True,
                **defaults
            )
            journals_by_title[title_norm] = journal_obj

    # 2. Bulk insert Journals
    self.update_state(state='PROGRESS', meta={'message': "Writing mapped journals to database...", 'progress': 80})
    journals_list = list(journals_by_title.values())
    created_journals = Journal.objects.bulk_create(journals_list, batch_size=1000)
    
    # 3. Create secondary tables in memory
    issns_to_create = []
    rankings_to_create = []
    
    for j in created_journals:
        cleaned_issn = j.issn.replace("-", "").strip().upper() if j.issn else ""
        cleaned_eissn = j.eissn.replace("-", "").strip().upper() if j.eissn else ""
        
        for code in filter(None, [cleaned_issn, cleaned_eissn]):
            if code not in existing_issns and code not in inserted_issns_in_run:
                issns_to_create.append(JournalISSN(journal=j, issn=code))
                inserted_issns_in_run.add(code)
                
        biox_ranks_list = []
        if j.bioxbio_journal_id:
            biox_ranks_list = biox_rankings.get(j.bioxbio_journal_id, [])
            
        scimago_ranks_list = []
        if j.scimago_journal_id:
            scimago_ranks_list = scimago_rankings.get(j.scimago_journal_id, [])
            
        years_to_process = set()
        biox_ranks_map = {}
        for r in biox_ranks_list:
            yr_val = r.get('year')
            years_to_process.add(yr_val)
            biox_ranks_map[yr_val] = r
            
        sjr_ranks_map = {}
        for r in scimago_ranks_list:
            yr_val = r.get('year')
            years_to_process.add(yr_val)
            sjr_ranks_map[yr_val] = r
            
        for yr in years_to_process:
            b_rank = biox_ranks_map.get(yr)
            s_rank = sjr_ranks_map.get(yr)
            
            rankings_to_create.append(
                JournalRanking(
                    journal=j,
                    year=yr,
                    impact_factor=b_rank.get('impact_factor') if b_rank else None,
                    sjr_score=s_rank.get('sjr_score') if s_rank else None,
                    sjr_quartile=s_rank.get('sjr_quartile') if s_rank else None,
                    h_index=s_rank.get('h_index') if s_rank else None,
                )
            )

    # 4. Bulk insert ISSNS and Rankings
    self.update_state(state='PROGRESS', meta={'message': "Writing ISSNs and rankings to database...", 'progress': 95})
    JournalISSN.objects.bulk_create(issns_to_create, batch_size=1000)
    JournalRanking.objects.bulk_create(rankings_to_create, batch_size=1000)

    logger.info(f"Integrated Academic Scores finished successfully. Processed {total_count} journals.")
    return {'status': 'success', 'integrated_count': total_count}


# ==============================================================================
# 8. UNIFIED PARALLEL COORDINATOR TASK
# ==============================================================================
@shared_task(bind=True)
def crawl_and_integrate_all_task(
    self,
    is_automated=False,
    scimago_years=None,
    scimago_start_url="https://www.scimagojr.com/journalrank.php",
    clarivate_max_pages=None,
    clarivate_start_url="https://mjl.clarivate.com/api/mjl/jprof/public/rank-search",
    clarivate_workers=15,
    clarivate_delay=0.1,
    scimago_workers=10,
    scimago_delay=0.2,
    bioxbio_start_url="https://www.bioxbio.com/journal/",
    bioxbio_max_pages=None,
    bioxbio_workers=20,
    bioxbio_delay=0.3,
):
    """
    Task điều phối tổng hợp:
    1. Khởi chạy song song 3 task cào (Clarivate, SCImago, BioxBio).
    2. Poller Loop: Kiểm tra tiến độ 5s/lần, cập nhật metadata.
    3. Self-Healing: Đếm số lượng DB, cào bù nếu thiếu.
    4. Kích hoạt integrate_scores_task khi đủ 100%.
    5. Đồng bộ tự động nếu is_automated=True và phát hiện dữ liệu mới.
    """
    from celery.result import AsyncResult
    from apps.scholar.models import Journal, ClarivateJournal, ScimagoJournal, BioxbioJournal, CrawlHistory
    from django.utils import timezone
    import time
    
    task_id = self.request.id or 'manual-run'
    history_obj = CrawlHistory.objects.create(
        task_id=task_id,
        status='RUNNING',
        is_automated=is_automated,
    )
    
    cl_scraped = 0
    sc_scraped = 0
    bb_scraped = 0
    mapped_count_this_run = 0

    logs = []
    def add_log(msg):
        from django.utils import timezone
        timestamp = timezone.now().astimezone(timezone.get_default_timezone()).strftime('%H:%M:%S')
        full_msg = f"[{timestamp}] {msg}"
        logs.append(full_msg)
        logger.info(msg)

    try:
        add_log("🚀 Khởi chạy hệ thống cào song song không giới hạn (Clarivate + SCImago + BioxBio)...")
        
        self.update_state(state='PROGRESS', meta={
            'message': 'Khởi chạy 3 tiến trình cào dữ liệu song song...',
            'progress': 2,
            'clarivate': {'status': 'PENDING', 'progress': 0, 'message': ''},
            'scimago':   {'status': 'PENDING', 'progress': 0, 'message': ''},
            'bioxbio':   {'status': 'PENDING', 'progress': 0, 'message': ''},
            'mapping':   {'status': 'PENDING', 'progress': 0, 'message': ''},
        })

        # --- Phase 1: Launch 3 crawlers in parallel ---
        add_log("Kích hoạt Clarivate Scraper task...")
        cl_task = crawl_clarivate_task.delay(
            start_url=clarivate_start_url,
            max_pages=clarivate_max_pages,
            max_workers=clarivate_workers,
            delay=clarivate_delay
        )
        add_log("Kích hoạt SCImago Scraper task...")
        sc_task = crawl_scimago_task.delay(
            start_url=scimago_start_url,
            years=scimago_years,
            max_workers=scimago_workers,
            delay=scimago_delay
        )
        add_log("Kích hoạt BioxBio Scraper task...")
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

        add_log("Bắt đầu giám sát các tiến trình cào dữ liệu thô...")
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

        add_log("Giai đoạn 1 hoàn tất. Kiểm tra và phục hồi dữ liệu cào...")
        # --- Phase 3: Self-Healing Check ---
        self.update_state(state='PROGRESS', meta={
            'message': 'Đang kiểm tra số lượng dữ liệu đã cào...',
            'progress': 76,
            'clarivate': {'status': 'SUCCESS', 'progress': 100, 'message': 'Checking...'},
            'scimago':   {'status': 'SUCCESS', 'progress': 100, 'message': 'Checking...'},
            'bioxbio':   {'status': 'SUCCESS', 'progress': 100, 'message': 'Checking...'},
            'mapping':   {'status': 'PENDING', 'progress': 0, 'message': 'Đang kiểm tra dữ liệu...'},
        })

        # Clarivate self-heal
        cl_res = AsyncResult(task_ids['clarivate'])
        cl_result = cl_res.result if cl_res.status == 'SUCCESS' else {}
        if not isinstance(cl_result, dict):
            cl_result = {}
        cl_expected = cl_result.get('total_expected', 0)
        cl_in_db = ClarivateJournal.objects.count()

        self_healing_triggered = False
        if cl_expected > 0 and cl_in_db < cl_expected * 0.98:
            self_healing_triggered = True
            add_log(f"Self-Healing: Thiếu dữ liệu Clarivate (DB={cl_in_db}, Expected={cl_expected}). Tiến hành cào bù...")
            retry_cl = crawl_clarivate_task.delay(
                start_url=clarivate_start_url,
                max_pages=clarivate_max_pages,
                max_workers=clarivate_workers,
                delay=clarivate_delay
            )
            while not retry_cl.ready():
                time.sleep(5)
            add_log("Self-Healing Clarivate hoàn tất.")

        # Bioxbio self-heal
        bioxbio_retry_count = 0
        while bioxbio_retry_count < 3:
            incomplete_biox = BioxbioCrawlerProgress.objects.filter(is_completed=False).count()
            if incomplete_biox > 0:
                self_healing_triggered = True
                add_log(f"Self-Healing: Phát hiện {incomplete_biox} subjects chưa hoàn tất ở BioxBio. Chạy cào bù...")
                bb_heal = crawl_bioxbio_task.delay(
                    start_url=bioxbio_start_url,
                    max_pages=bioxbio_max_pages,
                    max_workers=bioxbio_workers,
                    delay=bioxbio_delay
                )
                while not bb_heal.ready():
                    time.sleep(5)
                bioxbio_retry_count += 1
                add_log(f"Self-Healing BioxBio lượt {bioxbio_retry_count} hoàn tất.")
            else:
                break

        # --- Phase 4: Trigger Mapping ---
        cl_res = AsyncResult(task_ids['clarivate'])
        cl_result = cl_res.result if cl_res.status == 'SUCCESS' else {}
        if not isinstance(cl_result, dict): cl_result = {}
        cl_scraped = cl_result.get('scraped_journals', 0)

        sc_res = AsyncResult(task_ids['scimago'])
        sc_result = sc_res.result if sc_res.status == 'SUCCESS' else {}
        if not isinstance(sc_result, dict): sc_result = {}
        sc_scraped = sc_result.get('imported_journals', 0)

        bb_res = AsyncResult(task_ids['bioxbio'])
        bb_result = bb_res.result if bb_res.status == 'SUCCESS' else {}
        if not isinstance(bb_result, dict): bb_result = {}
        bb_scraped = bb_result.get('scraped_journals', 0)

        total_scraped = cl_scraped + sc_scraped + bb_scraped
        has_confirmed = Journal.objects.filter(is_staging=False).exists()

        if not self_healing_triggered and total_scraped == 0 and has_confirmed:
            add_log("Skip Mapping Check: Không phát hiện dữ liệu thô mới và đã có dữ liệu chính thức. Bỏ qua giai đoạn Mapping.")
            self.update_state(state='PROGRESS', meta={
                'message': 'Không có dữ liệu mới. Bỏ qua Mapping & hoàn tất tác vụ.',
                'progress': 100,
                'clarivate': {'status': 'SUCCESS', 'progress': 100, 'message': 'Completed (No new data)'},
                'scimago':   {'status': 'SUCCESS', 'progress': 100, 'message': 'Completed (No new data)'},
                'bioxbio':   {'status': 'SUCCESS', 'progress': 100, 'message': 'Completed (No new data)'},
                'mapping':   {'status': 'SUCCESS', 'progress': 100, 'message': 'Bỏ qua (Không có dữ liệu mới)'},
            })
            
            history_obj.status = 'SUCCESS'
            history_obj.clarivate_count = 0
            history_obj.scimago_count = 0
            history_obj.bioxbio_count = 0
            history_obj.mapped_count = 0
            
            history_obj.clarivate_total = ClarivateJournal.objects.count()
            history_obj.scimago_total = ScimagoJournal.objects.count()
            history_obj.bioxbio_total = BioxbioJournal.objects.count()
            history_obj.mapped_total = Journal.objects.count()
            
            return {
                'status': 'success',
                'message': 'Skipped mapping because no new raw data was scraped.',
                'clarivate_in_db': ClarivateJournal.objects.count(),
                'scimago_in_db':   ScimagoJournal.objects.count(),
                'bioxbio_in_db':   BioxbioJournal.objects.count(),
                'mapped_journals': Journal.objects.count(),
            }

        add_log("Kích hoạt tiến trình Mapping & tích hợp điểm số...")
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

        if map_res.status == 'SUCCESS':
            add_log("Tiến trình Mapping & tích hợp điểm số hoàn tất thành công.")
            mapped_count_this_run = Journal.objects.filter(is_staging=True).count()
        else:
            add_log(f"Tiến trình Mapping & tích hợp điểm số thất bại: {map_res.result}")

        # --- Phase 5: Auto-Sync (Only for automated Celery Beat runs) ---
        if is_automated:
            from django.db import connection, transaction

            confirmed_titles = set(Journal.objects.filter(is_staging=False).values_list('title_normalized', flat=True))
            has_new = Journal.objects.filter(is_staging=True).exclude(title_normalized__in=confirmed_titles).exists()

            if has_new:
                add_log("Auto-Sync: Phát hiện dữ liệu mới, bắt đầu đồng bộ tự động...")
                try:
                    with transaction.atomic():
                        with connection.cursor() as cursor:
                            cursor.execute("""
                                UPDATE scholar_publications 
                                SET journal_id = NULL 
                                WHERE journal_id IN (SELECT id FROM scholar_journals WHERE is_staging = FALSE)
                            """)
                            cursor.execute("""
                                DELETE FROM scholar_journal_rankings 
                                WHERE journal_id IN (SELECT id FROM scholar_journals WHERE is_staging = FALSE)
                            """)
                            cursor.execute("""
                                DELETE FROM scholar_journal_issns 
                                WHERE journal_id IN (SELECT id FROM scholar_journals WHERE is_staging = FALSE)
                            """)
                            cursor.execute("DELETE FROM scholar_journals WHERE is_staging = FALSE")
                        Journal.objects.filter(is_staging=True).update(is_staging=False)
                    add_log("Auto-Sync: Đồng bộ dữ liệu thành công.")
                except Exception as e:
                    add_log(f"Auto-Sync: Đồng bộ thất bại: {e}")
            else:
                add_log("Auto-Sync: Không có dữ liệu mới nào. Đang dọn dẹp dữ liệu staging...")
                try:
                    with connection.cursor() as cursor:
                        cursor.execute("""
                            DELETE FROM scholar_journal_rankings 
                            WHERE journal_id IN (SELECT id FROM scholar_journals WHERE is_staging = TRUE)
                        """)
                        cursor.execute("""
                            DELETE FROM scholar_journal_issns 
                            WHERE journal_id IN (SELECT id FROM scholar_journals WHERE is_staging = TRUE)
                        """)
                        cursor.execute("DELETE FROM scholar_journals WHERE is_staging = TRUE")
                    add_log("Auto-Sync: Dọn dẹp staging thành công.")
                except Exception as e:
                    add_log(f"Auto-Sync: Dọn dẹp staging thất bại: {e}")

        history_obj.status = 'SUCCESS'
        history_obj.clarivate_count = cl_scraped
        history_obj.scimago_count = sc_scraped
        history_obj.bioxbio_count = bb_scraped
        history_obj.mapped_count = mapped_count_this_run
        
        history_obj.clarivate_total = ClarivateJournal.objects.count()
        history_obj.scimago_total = ScimagoJournal.objects.count()
        history_obj.bioxbio_total = BioxbioJournal.objects.count()
        history_obj.mapped_total = Journal.objects.count()

        add_log("Tác vụ tổng hợp kết thúc thành công.")
        
        return {
            'status': 'success',
            'clarivate_in_db': ClarivateJournal.objects.count(),
            'scimago_in_db':   ScimagoJournal.objects.count(),
            'bioxbio_in_db':   BioxbioJournal.objects.count(),
            'mapped_journals': Journal.objects.count(),
        }
        
    except Exception as e:
        import traceback
        err_msg = traceback.format_exc()
        add_log(f"💥 Tác vụ thất bại với lỗi: {e}")
        history_obj.status = 'FAILURE'
        history_obj.error_message = err_msg
        raise e
    finally:
        history_obj.completed_at = timezone.now()
        history_obj.log_output = "\n".join(logs)
        history_obj.save()

from celery.signals import task_prerun, task_postrun

@task_prerun.connect
def task_prerun_handler(sender=None, task_id=None, task=None, *args, **kwargs):
    task_name = task.name if task else (sender.name if sender else None)
    if task_name == 'apps.scholar.tasks.crawl_and_integrate_all_task':
        try:
            settings_data = get_scholar_settings()
            settings_data['active_unified_task_id'] = task_id
            save_scholar_settings(settings_data)
        except Exception as e:
            logger.error(f"Error saving active task ID in signal: {e}")

@task_postrun.connect
def task_postrun_handler(sender=None, task_id=None, task=None, retval=None, state=None, *args, **kwargs):
    task_name = task.name if task else (sender.name if sender else None)
    if task_name == 'apps.scholar.tasks.crawl_and_integrate_all_task':
        try:
            settings_data = get_scholar_settings()
            if settings_data.get('active_unified_task_id') == task_id:
                settings_data['active_unified_task_id'] = None
                
            # Record last run metadata
            from django.utils import timezone
            now_vn = timezone.now().astimezone(timezone.get_default_timezone())
            
            settings_data['last_run_time'] = now_vn.strftime('%H:%M:%S %d/%m/%Y')
            settings_data['last_run_status'] = state
            
            if state == 'SUCCESS' and isinstance(retval, dict):
                msg = retval.get('message', '')
                if 'Skipped mapping' in msg or 'Bỏ qua' in msg:
                    settings_data['last_run_message'] = 'Hoàn tất cào dữ liệu thành công. Không có dữ liệu mới nên đã tự động bỏ qua giai đoạn Mapping.'
                else:
                    settings_data['last_run_message'] = f"Hoàn tất cào và mapping thành công. Đã cập nhật {retval.get('mapped_journals', 0)} tạp chí."
            else:
                settings_data['last_run_message'] = f"Tiến trình kết thúc với trạng thái: {state}."
                
            save_scholar_settings(settings_data)
        except Exception as e:
            logger.error(f"Error clearing active task ID in signal: {e}")


