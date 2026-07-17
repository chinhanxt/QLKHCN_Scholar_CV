import sqlite3
import os
import json
from django.core.management.base import BaseCommand
from django.db import transaction
from apps.scholar.models import (
    ClarivateJournal, ClarivateCrawlerProgress,
    ScimagoJournal, ScimagoISSN, ScimagoRanking,
    BioxbioJournal, BioxbioISSN, BioxbioRanking, BioxbioCrawlerProgress,
    Journal, JournalISSN, JournalRanking,
    AuthorProfile, Publication
)


class Command(BaseCommand):
    help = "Import all 5 scholarly databases (BioxBio, SCImago, Clarivate raw, Mapped, and Saved Profiles) into PostgreSQL."

    def add_arguments(self, parser):
        parser.add_argument(
            "--folder",
            default="scholarly_data-main",
            help="Folder containing the sqlite database files"
        )

    def handle(self, *args, **options):
        folder = options["folder"]
        
        # If running inside docker compose, the path is relative to /app
        if not os.path.exists(folder):
            folder = os.path.join("/app", folder)

        if not os.path.exists(folder):
            self.stdout.write(self.style.ERROR(f"Folder not found at {folder}"))
            return

        self.stdout.write(self.style.SUCCESS(f"Found scholarly data directory at: {folder}"))

        # Database file paths
        bioxbio_db = os.path.join(folder, "bioxbio_all.db")
        scimago_db = os.path.join(folder, "scimagojr_all.db")
        clarivate_raw_db = os.path.join(folder, "clarivate_all.db")
        clarivate_mapped_db = os.path.join(folder, "clarivate_mapped.db")
        saved_profiles_db = os.path.join(folder, "saved_profiles.db")

        # ----------------------------------------------------------------------
        # Phase 1: Import BioxBio Database
        # ----------------------------------------------------------------------
        if os.path.exists(bioxbio_db):
            self.import_bioxbio(bioxbio_db)
        else:
            self.stdout.write(self.style.WARNING(f"BioxBio database not found at {bioxbio_db}, skipping."))

        # ----------------------------------------------------------------------
        # Phase 2: Import SCImago Database
        # ----------------------------------------------------------------------
        if os.path.exists(scimago_db):
            self.import_scimago(scimago_db)
        else:
            self.stdout.write(self.style.WARNING(f"SCImago database not found at {scimago_db}, skipping."))

        # ----------------------------------------------------------------------
        # Phase 3: Import Clarivate Raw Database
        # ----------------------------------------------------------------------
        if os.path.exists(clarivate_raw_db):
            self.import_clarivate_raw(clarivate_raw_db)
        else:
            self.stdout.write(self.style.WARNING(f"Clarivate Raw database not found at {clarivate_raw_db}, skipping."))

        # ----------------------------------------------------------------------
        # Phase 4: Import Clarivate Mapped Database & Link to Staging DBs
        # ----------------------------------------------------------------------
        if os.path.exists(clarivate_mapped_db):
            self.import_clarivate_mapped(clarivate_mapped_db)
        else:
            self.stdout.write(self.style.WARNING(f"Clarivate Mapped database not found at {clarivate_mapped_db}, skipping."))

        # ----------------------------------------------------------------------
        # Phase 5: Import Saved Profiles Database
        # ----------------------------------------------------------------------
        if os.path.exists(saved_profiles_db):
            self.import_saved_profiles(saved_profiles_db)
        else:
            self.stdout.write(self.style.WARNING(f"Saved Profiles database not found at {saved_profiles_db}, skipping."))

        self.stdout.write(self.style.SUCCESS("All databases imported and linked successfully!"))


    def import_bioxbio(self, db_path):
        self.stdout.write("\n>>> [1/5] Importing BioxBio Database...")
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        try:
            # 1. Journals (Bulk)
            cursor.execute("SELECT COUNT(*) FROM journals")
            total = cursor.fetchone()[0]
            self.stdout.write(f"Found {total} BioxBio journals to import.")
            
            cursor.execute("SELECT * FROM journals")
            rows = cursor.fetchall()
            
            journals_to_create = []
            for row in rows:
                journals_to_create.append(BioxbioJournal(
                    source_id=row["source_id"],
                    title=row["title"],
                    title_normalized=row["title_normalized"]
                ))
            
            # Bulk create in chunks of 5000
            for i in range(0, len(journals_to_create), 5000):
                BioxbioJournal.objects.bulk_create(journals_to_create[i:i+5000], ignore_conflicts=True)
                self.stdout.write(f"  Processed {min(i+5000, total)}/{total} BioxBio journals...")

            # Load created journals into memory cache
            self.stdout.write("  Caching BioxBio journals for ISSN/Rankings mapping...")
            biox_cache = {obj.source_id: obj.id for obj in BioxbioJournal.objects.exclude(source_id__isnull=True)}

            # 2. ISSNs (Bulk)
            cursor.execute("SELECT COUNT(*) FROM issns")
            total_issns = cursor.fetchone()[0]
            cursor.execute("SELECT * FROM issns")
            issn_rows = cursor.fetchall()
            
            issns_to_create = []
            for row in issn_rows:
                j_id = biox_cache.get(row["source_id"])
                if j_id:
                    cleaned_issn = row["issn"].replace("-", "").strip().upper()
                    if cleaned_issn:
                        issns_to_create.append(BioxbioISSN(
                            journal_id=j_id,
                            issn=cleaned_issn
                        ))
            
            for i in range(0, len(issns_to_create), 5000):
                BioxbioISSN.objects.bulk_create(issns_to_create[i:i+5000], ignore_conflicts=True)
            self.stdout.write(f"  Imported {total_issns} BioxBio ISSNs.")

            # 3. Rankings (Bulk)
            cursor.execute("SELECT COUNT(*) FROM rankings")
            total_ranks = cursor.fetchone()[0]
            cursor.execute("SELECT * FROM rankings")
            rank_rows = cursor.fetchall()
            
            ranks_to_create = []
            for row in rank_rows:
                j_id = biox_cache.get(row["source_id"])
                if j_id:
                    ranks_to_create.append(BioxbioRanking(
                        journal_id=j_id,
                        year=row["year"],
                        impact_factor=row["impact_factor"],
                        total_articles=row["total_articles"],
                        total_cites=row["total_cites"]
                    ))
            
            for i in range(0, len(ranks_to_create), 5000):
                BioxbioRanking.objects.bulk_create(ranks_to_create[i:i+5000], ignore_conflicts=True)
            self.stdout.write(f"  Imported {total_ranks} BioxBio rankings.")

            # 4. Progress
            cursor.execute("SELECT * FROM subject_progress")
            for row in cursor:
                BioxbioCrawlerProgress.objects.get_or_create(
                    subject=row["subject"],
                    defaults={
                        "last_completed_page": row["last_completed_page"],
                        "is_completed": bool(row["is_completed"])
                    }
                )
            self.stdout.write("  Imported BioxBio subject progress.")

        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error importing BioxBio: {e}"))
        finally:
            conn.close()


    def import_scimago(self, db_path):
        self.stdout.write("\n>>> [2/5] Importing SCImago Database...")
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        try:
            # 1. Journals (Bulk)
            cursor.execute("SELECT COUNT(*) FROM journals")
            total = cursor.fetchone()[0]
            self.stdout.write(f"Found {total} SCImago journals to import.")
            
            cursor.execute("SELECT * FROM journals")
            rows = cursor.fetchall()
            
            journals_to_create = []
            for row in rows:
                journals_to_create.append(ScimagoJournal(
                    source_id=row["source_id"],
                    title=row["title"],
                    title_normalized=row["title_normalized"],
                    journal_type=row["type"],
                    publisher=row["publisher"],
                    country=row["country"]
                ))
            
            for i in range(0, len(journals_to_create), 5000):
                ScimagoJournal.objects.bulk_create(journals_to_create[i:i+5000], ignore_conflicts=True)
                self.stdout.write(f"  Processed {min(i+5000, total)}/{total} SCImago journals...")

            # Cache SCImago journals in memory
            self.stdout.write("  Caching SCImago journals for ISSN/Rankings mapping...")
            scimago_cache = {obj.source_id: obj.id for obj in ScimagoJournal.objects.all()}

            # 2. ISSNs (Bulk)
            cursor.execute("SELECT COUNT(*) FROM issns")
            total_issns = cursor.fetchone()[0]
            cursor.execute("SELECT * FROM issns")
            issn_rows = cursor.fetchall()
            
            issns_to_create = []
            for row in issn_rows:
                j_id = scimago_cache.get(row["source_id"])
                if j_id:
                    cleaned_issn = row["issn"].replace("-", "").strip().upper()
                    if cleaned_issn:
                        issns_to_create.append(ScimagoISSN(
                            journal_id=j_id,
                            issn=cleaned_issn
                        ))
            
            for i in range(0, len(issns_to_create), 5000):
                ScimagoISSN.objects.bulk_create(issns_to_create[i:i+5000], ignore_conflicts=True)
            self.stdout.write(f"  Imported {total_issns} SCImago ISSNs.")

            # 3. Rankings (Bulk in chunks to prevent memory/DB overhead)
            cursor.execute("SELECT COUNT(*) FROM rankings")
            total_ranks = cursor.fetchone()[0]
            self.stdout.write(f"Found {total_ranks} SCImago rankings to import.")
            
            cursor.execute("SELECT * FROM rankings")
            
            # Fetch and process in batches of 50,000 to keep memory low
            batch_size = 50000
            while True:
                rank_rows = cursor.fetchmany(batch_size)
                if not rank_rows:
                    break
                
                ranks_to_create = []
                for row in rank_rows:
                    j_id = scimago_cache.get(row["source_id"])
                    if j_id:
                        ranks_to_create.append(ScimagoRanking(
                            journal_id=j_id,
                            year=row["year"],
                            sjr_score=row["sjr_score"],
                            sjr_quartile=row["sjr_quartile"],
                            h_index=row["h_index"]
                        ))
                
                # Bulk insert this batch
                ScimagoRanking.objects.bulk_create(ranks_to_create, ignore_conflicts=True)
                self.stdout.write("  Inserted a batch of SCImago rankings...")
                
            self.stdout.write(f"  Imported all {total_ranks} SCImago rankings.")

        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error importing SCImago: {e}"))
        finally:
            conn.close()


    def import_clarivate_raw(self, db_path):
        self.stdout.write("\n>>> [3/5] Importing Clarivate Raw Database...")
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        try:
            # 1. Journals (Bulk)
            cursor.execute("SELECT COUNT(*) FROM journals")
            total = cursor.fetchone()[0]
            self.stdout.write(f"Found {total} Clarivate journals to import.")
            
            cursor.execute("SELECT * FROM journals")
            rows = cursor.fetchall()
            
            journals_to_create = []
            for row in rows:
                journals_to_create.append(ClarivateJournal(
                    publication_id=row["publication_id"],
                    title=row["clarivate_title"],
                    title_normalized=row["title_normalized"],
                    issn=row["issn"],
                    eissn=row["eissn"],
                    publisher=row["publisher"],
                    country=row["country"],
                    wos_core_collection=row["wos_core_collection"],
                    additional_wos_indexes=row["additional_wos_indexes"]
                ))
            
            for i in range(0, len(journals_to_create), 5000):
                ClarivateJournal.objects.bulk_create(journals_to_create[i:i+5000], ignore_conflicts=True)
                self.stdout.write(f"  Processed {min(i+5000, total)}/{total} Clarivate raw journals...")

            # 2. Progress
            cursor.execute("SELECT * FROM page_progress")
            progress_rows = cursor.fetchall()
            for row in progress_rows:
                ClarivateCrawlerProgress.objects.get_or_create(
                    page=row["page_num"],
                    defaults={"is_completed": row["status"] == "COMPLETED"}
                )
            self.stdout.write("  Imported Clarivate page progress.")

        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error importing Clarivate Raw: {e}"))
        finally:
            conn.close()


    def import_clarivate_mapped(self, db_path):
        self.stdout.write("\n>>> [4/5] Importing Clarivate Mapped Database & Linking...")
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        try:
            cursor.execute("SELECT COUNT(*) FROM journals")
            total_count = cursor.fetchone()[0]
            self.stdout.write(f"Found {total_count} mapped journals to import/update.")

            cursor.execute("SELECT * FROM journals")
            rows = cursor.fetchall()
            
            # Load caches
            self.stdout.write("  Caching BioxBio and SCImago raw databases for fast lookup...")
            biox_cache = {obj.source_id: obj for obj in BioxbioJournal.objects.exclude(source_id__isnull=True)}
            scimago_cache = {obj.source_id: obj for obj in ScimagoJournal.objects.all()}

            # Process and commit in small transactional chunks of 2000 to keep postgres memory safe
            chunk_size = 2000
            for start_idx in range(0, len(rows), chunk_size):
                batch_rows = rows[start_idx:start_idx+chunk_size]
                
                with transaction.atomic():
                    for row in batch_rows:
                        title_norm = row["title_normalized"]
                        if not title_norm:
                            continue
                        
                        b_source_id = row["bioxbio_source_id"]
                        s_source_id = row["scimago_source_id"]

                        bioxbio_journal_fk = biox_cache.get(b_source_id) if b_source_id else None
                        scimago_journal_fk = scimago_cache.get(s_source_id) if s_source_id else None

                        # Create or update Journal
                        journal, created = Journal.objects.get_or_create(
                            title_normalized=title_norm,
                            defaults={
                                "clarivate_title": row["clarivate_title"],
                                "issn": row["issn"],
                                "eissn": row["eissn"],
                                "publisher": row["publisher"],
                                "country": row["country"],
                                "wos_core_collection": row["wos_core_collection"],
                                "additional_wos_indexes": row["additional_wos_indexes"],
                                "latest_if": row["bioxbio_if"],
                                "latest_if_year": row["bioxbio_year"],
                                "latest_sjr": row["scimago_sjr"],
                                "latest_sjr_year": row["scimago_year"],
                                "latest_quartile": row["scimago_quartile"],
                                "latest_h_index": row["scimago_hindex"],
                                "bioxbio_match": row["bioxbio_match"],
                                "bioxbio_journal": bioxbio_journal_fk,
                                "scimago_match": row["scimago_match"],
                                "scimago_journal": scimago_journal_fk,
                            }
                        )

                        if not created:
                            journal.bioxbio_journal = bioxbio_journal_fk
                            journal.scimago_journal = scimago_journal_fk
                            journal.bioxbio_match = row["bioxbio_match"]
                            journal.scimago_match = row["scimago_match"]
                            journal.save(update_fields=["bioxbio_journal", "scimago_journal", "bioxbio_match", "scimago_match"])

                        # Create unique JournalISSNs
                        issns_to_add = []
                        if row["issn"]:
                            cleaned_issn = row["issn"].replace("-", "").strip().upper()
                            if cleaned_issn:
                                issns_to_add.append(cleaned_issn)
                        if row["eissn"]:
                            cleaned_eissn = row["eissn"].replace("-", "").strip().upper()
                            if cleaned_eissn:
                                issns_to_add.append(cleaned_eissn)

                        for issn_code in set(issns_to_add):
                            JournalISSN.objects.get_or_create(
                                issn=issn_code,
                                defaults={"journal": journal}
                            )

                        # Add latest metric as an annual ranking
                        ranking_year = row["scimago_year"] or row["bioxbio_year"]
                        if ranking_year:
                            JournalRanking.objects.get_or_create(
                                journal=journal,
                                year=ranking_year,
                                defaults={
                                    "impact_factor": row["bioxbio_if"],
                                    "sjr_score": row["scimago_sjr"],
                                    "sjr_quartile": row["scimago_quartile"],
                                    "h_index": row["scimago_hindex"],
                                }
                            )
                
                self.stdout.write(f"  Processed {min(start_idx+chunk_size, total_count)}/{total_count} mapped journals...")

            self.stdout.write("  Mapped database imported/updated successfully.")

        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error during import: {e}"))
        finally:
            conn.close()


    def import_saved_profiles(self, db_path):
        self.stdout.write("\n>>> [5/5] Importing Saved Profiles (Authors & Publications)...")
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        try:
            # 1. Authors
            cursor.execute("SELECT COUNT(*) FROM authors")
            total = cursor.fetchone()[0]
            self.stdout.write(f"Found {total} author profiles to import.")
            
            cursor.execute("SELECT * FROM authors")
            author_rows = cursor.fetchall()
            author_map = {}
            
            with transaction.atomic():
                for row in author_rows:
                    interests = []
                    if row["interests"]:
                        try:
                            interests = json.loads(row["interests"])
                        except Exception:
                            interests = []
                            
                    author, created = AuthorProfile.objects.get_or_create(
                        scholar_id=row["scholar_id"],
                        defaults={
                            "name": row["name"],
                            "affiliation": row["affiliation"],
                            "citedby": row["citedby"],
                            "hindex": row["hindex"],
                            "i10index": row["i10index"],
                            "interests": interests,
                        }
                    )
                    author_map[row["scholar_id"]] = author
            self.stdout.write(f"  Imported {total} author profiles.")

            # 2. Publications
            cursor.execute("SELECT COUNT(*) FROM publications")
            total_pubs = cursor.fetchone()[0]
            cursor.execute("SELECT * FROM publications")
            pub_rows = cursor.fetchall()
            
            # Cache Journal mapping title_normalized
            journal_cache = {obj.title_normalized: obj for obj in Journal.objects.all()}

            with transaction.atomic():
                imported_pubs = 0
                for row in pub_rows:
                    author_obj = author_map.get(row["scholar_id"])
                    if not author_obj:
                        continue
                    
                    cites_history = {}
                    if row["cites_per_year"]:
                        try:
                            cites_history = json.loads(row["cites_per_year"])
                        except Exception:
                            cites_history = {}
                    
                    venue_raw = row["venue"]
                    journal_fk = None
                    if venue_raw:
                        import re, unicodedata
                        name = venue_raw.upper().replace("&AMP;", "&").replace(" AND ", "")
                        if name.startswith("THE "):
                            name = name[4:]
                        if name.endswith(", THE"):
                            name = name[:-5]
                        name = unicodedata.normalize('NFD', name)
                        norm_venue = re.sub(r'[^A-Z0-9]', '', name)
                        journal_fk = journal_cache.get(norm_venue)

                    Publication.objects.get_or_create(
                        author=author_obj,
                        title=row["title"],
                        display_order=row["display_order"] or 0,
                        defaults={
                            "authors_list": row["authors"],
                            "venue": row["venue"],
                            "year": row["year"],
                            "citations": row["citations"],
                            "cites_per_year": cites_history,
                            "journal": journal_fk,
                            "sjr_q": row["sjr_q"] or "N/A",
                            "if_val": row["if_val"] or "N/A",
                            "wos": row["wos"] or "N/A",
                        }
                    )
                    imported_pubs += 1
                self.stdout.write(f"  Imported {imported_pubs}/{total_pubs} publications.")

        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error importing Saved Profiles: {e}"))
        finally:
            conn.close()
