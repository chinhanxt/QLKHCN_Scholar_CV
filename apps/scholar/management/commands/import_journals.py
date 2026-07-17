import sqlite3
import os
from django.core.management.base import BaseCommand
from django.db import transaction
from apps.scholar.models import Journal, JournalISSN, JournalRanking


class Command(BaseCommand):
    help = "Import journals from the SQLite database to the PostgreSQL database."

    def add_arguments(self, parser):
        parser.add_argument(
            "--db-path",
            default="scholarly_data-main/clarivate_mapped.db",
            help="Path to the clarivate_mapped.db SQLite file"
        )

    def handle(self, *args, **options):
        db_path = options["db_path"]
        
        # If running inside docker compose, the path is relative to /app
        if not os.path.exists(db_path):
            # Try absolute path within the workspace
            db_path = os.path.join("/app", db_path)

        if not os.path.exists(db_path):
            self.stdout.write(self.style.ERROR(f"SQLite file not found at {db_path}"))
            return

        self.stdout.write(f"Connecting to SQLite database at {db_path}...")
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        try:
            cursor.execute("SELECT COUNT(*) FROM journals")
            total_count = cursor.fetchone()[0]
            self.stdout.write(f"Found {total_count} journals to import.")

            cursor.execute("SELECT * FROM journals")
            
            # Import in a single transaction for maximum speed
            with transaction.atomic():
                imported_journals_count = 0
                imported_issns_count = 0
                imported_rankings_count = 0

                for idx, row in enumerate(cursor):
                    title_norm = row["title_normalized"]
                    if not title_norm:
                        continue
                    
                    # Create or get Journal
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
                        }
                    )

                    # Create ISSNs mapping
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
                        # Create unique ISSN link
                        _, issn_created = JournalISSN.objects.get_or_create(
                            issn=issn_code,
                            defaults={"journal": journal}
                        )
                        if issn_created:
                            imported_issns_count += 1

                    # Add latest metric as an annual ranking
                    ranking_year = row["scimago_year"] or row["bioxbio_year"]
                    if ranking_year:
                        _, ranking_created = JournalRanking.objects.get_or_create(
                            journal=journal,
                            year=ranking_year,
                            defaults={
                                "impact_factor": row["bioxbio_if"],
                                "sjr_score": row["scimago_sjr"],
                                "sjr_quartile": row["scimago_quartile"],
                                "h_index": row["scimago_hindex"],
                            }
                        )
                        if ranking_created:
                            imported_rankings_count += 1

                    if created:
                        imported_journals_count += 1

                    if (idx + 1) % 2000 == 0 or (idx + 1) == total_count:
                        self.stdout.write(f"Processed {idx + 1}/{total_count} journals...")

            self.stdout.write(
                self.style.SUCCESS(
                    f"Import completed successfully!\n"
                    f"Imported {imported_journals_count} new Journals.\n"
                    f"Imported {imported_issns_count} Journal ISSNs.\n"
                    f"Imported {imported_rankings_count} Journal Rankings."
                )
            )

        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error during import: {e}"))
        finally:
            conn.close()
