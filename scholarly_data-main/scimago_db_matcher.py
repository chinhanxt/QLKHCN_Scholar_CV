import sqlite3
import os
import re
import unicodedata

class SCImagoDBMatcher:
    """Interface to match journal venues and retrieve rankings from the local SQLite database."""
    def __init__(self, db_path):
        self.db_path = db_path
        self.loaded = os.path.exists(db_path)
        if not self.loaded:
            print(f"Warning: SCImago database not found at {db_path}")

    def normalize(self, name):
        """Normalizes venue names for exact database lookup (matches main app normalization)."""
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

    def clean_issn(self, issn):
        """Cleans ISSN formatting (remove hyphens, spaces, uppercase)."""
        if not issn or not isinstance(issn, str):
            return ""
        return issn.replace("-", "").strip().upper()

    def get_conn(self):
        """Returns a sqlite3 connection."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def find_journal_by_title(self, venue_name):
        """Look up journal by title (normalized)."""
        if not self.loaded:
            return None
            
        norm_title = self.normalize(venue_name)
        if not norm_title:
            return None
            
        conn = self.get_conn()
        cursor = conn.cursor()
        try:
            # Query exact normalized title matching
            cursor.execute('''
                SELECT source_id, title, type, publisher, country 
                FROM journals 
                WHERE title_normalized = ?
            ''', (norm_title,))
            row = cursor.fetchone()
            if row:
                return dict(row)
        except sqlite3.Error as e:
            print(f"Database error in find_journal_by_title: {e}")
        finally:
            conn.close()
        return None

    def find_journal_by_issn(self, issn_str):
        """Look up journal by a single ISSN or a string of ISSNs."""
        if not self.loaded or not issn_str:
            return None
            
        # Extract potential ISSNs from string
        tokens = re.split(r'[,;\s]+', issn_str)
        cleaned_issns = [self.clean_issn(t) for t in tokens if self.clean_issn(t)]
        
        if not cleaned_issns:
            return None
            
        conn = self.get_conn()
        cursor = conn.cursor()
        try:
            for clean_issn in cleaned_issns:
                cursor.execute('''
                    SELECT j.source_id, j.title, j.type, j.publisher, j.country 
                    FROM issns i
                    JOIN journals j ON i.source_id = j.source_id
                    WHERE i.issn = ?
                ''', (clean_issn,))
                row = cursor.fetchone()
                if row:
                    return dict(row)
        except sqlite3.Error as e:
            print(f"Database error in find_journal_by_issn: {e}")
        finally:
            conn.close()
        return None

    def get_rankings(self, source_id):
        """Retrieve all historical rankings for a specific journal source_id."""
        if not self.loaded:
            return []
            
        conn = self.get_conn()
        cursor = conn.cursor()
        rankings = []
        try:
            cursor.execute('''
                SELECT year, sjr_score, sjr_quartile, h_index 
                FROM rankings 
                WHERE source_id = ?
                ORDER BY year DESC
            ''', (source_id,))
            rows = cursor.fetchall()
            for r in rows:
                rankings.append(dict(r))
        except sqlite3.Error as e:
            print(f"Database error in get_rankings: {e}")
        finally:
            conn.close()
        return rankings

    def match_venue_ranking(self, venue_raw, issn_raw=None, target_year=None):
        """Matches a venue by title/ISSN and returns the quartile for a target year.
        
        If target_year is not specified or not found, falls back to the most recent year available.
        """
        if not self.loaded:
            return {}
            
        # 1. Try finding by ISSN first (if provided)
        journal = None
        if issn_raw:
            journal = self.find_journal_by_issn(issn_raw)
            
        # 2. Try finding by Title if not found by ISSN
        if not journal and venue_raw:
            journal = self.find_journal_by_title(venue_raw)
            
        if not journal:
            return {} # Not found
            
        source_id = journal['source_id']
        all_ranks = self.get_rankings(source_id)
        
        if not all_ranks:
            return {
                'title': journal['title'],
                'type': journal['type'],
                'publisher': journal['publisher'],
                'country': journal['country'],
                'matched_by': 'ISSN' if issn_raw and self.find_journal_by_issn(issn_raw) else 'Title'
            }
            
        # 3. Find ranking for target year, or handle missing year data
        sjr_q = "-"
        sjr_score = None
        h_index = None
        matched_year = None
        
        # Sort rankings by year DESC
        all_ranks = sorted(all_ranks, key=lambda x: x['year'], reverse=True)
        
        has_target_year = False
        target_year_val = None
        if target_year:
            try:
                target_year_val = int(target_year)
                has_target_year = True
            except ValueError:
                pass
                
        if has_target_year:
            # Try exact year match
            for r in all_ranks:
                if r['year'] == target_year_val:
                    sjr_q = r['sjr_quartile']
                    sjr_score = r['sjr_score']
                    h_index = r['h_index']
                    matched_year = target_year_val
                    break
                    
            # If target year not found, set as N/A instead of falling back
            if not matched_year:
                sjr_q = f"N/A (Chưa có dữ liệu {target_year_val})"
                sjr_score = None
                h_index = None
                matched_year = target_year_val
        else:
            # If no target year was specified or it was invalid, return N/A
            sjr_q = "N/A (Thiếu năm)"
            sjr_score = None
            h_index = None
            matched_year = None
            
        return {
            'source_id': source_id,
            'title': journal['title'],
            'type': journal['type'],
            'publisher': journal['publisher'],
            'country': journal['country'],
            'matched_by': 'ISSN' if issn_raw and self.find_journal_by_issn(issn_raw) else 'Title',
            'sjr_quartile': sjr_q,
            'sjr_score': sjr_score,
            'h_index': h_index,
            'ranking_year': matched_year,
            'history': {r['year']: r['sjr_quartile'] for r in all_ranks}
        }

class BioxBioDBMatcher:
    """Interface to match journal venues and retrieve Impact Factor (IF) rankings from bioxbio_all.db."""
    def __init__(self, db_path):
        self.db_path = db_path
        self.loaded = os.path.exists(db_path)
        if not self.loaded:
            print(f"Warning: BioxBio database not found at {db_path}")

    def normalize(self, name):
        """Normalizes venue names for exact database lookup (matches main app normalization)."""
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

    def clean_issn(self, issn):
        """Cleans ISSN formatting (remove hyphens, spaces, uppercase)."""
        if not issn or not isinstance(issn, str):
            return ""
        return issn.replace("-", "").strip().upper()

    def get_conn(self):
        """Returns a sqlite3 connection."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def find_journal_by_title(self, venue_name):
        """Look up journal by title (normalized)."""
        if not self.loaded:
            return None
            
        norm_title = self.normalize(venue_name)
        if not norm_title:
            return None
            
        conn = self.get_conn()
        cursor = conn.cursor()
        try:
            cursor.execute('''
                SELECT source_id, title 
                FROM journals 
                WHERE title_normalized = ?
            ''', (norm_title,))
            row = cursor.fetchone()
            if row:
                return dict(row)
        except sqlite3.Error as e:
            print(f"Database error in BioxBio find_journal_by_title: {e}")
        finally:
            conn.close()
        return None

    def find_journal_by_issn(self, issn_str):
        """Look up journal by a single ISSN or a string of ISSNs."""
        if not self.loaded or not issn_str:
            return None
            
        # Extract potential ISSNs from string
        tokens = re.split(r'[,;\s]+', issn_str)
        cleaned_issns = [self.clean_issn(t) for t in tokens if self.clean_issn(t)]
        
        if not cleaned_issns:
            return None
            
        conn = self.get_conn()
        cursor = conn.cursor()
        try:
            for clean_issn in cleaned_issns:
                cursor.execute('''
                    SELECT j.source_id, j.title 
                    FROM issns i
                    JOIN journals j ON i.source_id = j.source_id
                    WHERE i.issn = ?
                ''', (clean_issn,))
                row = cursor.fetchone()
                if row:
                    return dict(row)
        except sqlite3.Error as e:
            print(f"Database error in BioxBio find_journal_by_issn: {e}")
        finally:
            conn.close()
        return None

    def get_rankings(self, source_id):
        """Retrieve all historical rankings for a specific journal source_id."""
        if not self.loaded:
            return []
            
        conn = self.get_conn()
        cursor = conn.cursor()
        rankings = []
        try:
            cursor.execute('''
                SELECT year, impact_factor, total_articles, total_cites 
                FROM rankings 
                WHERE source_id = ?
                ORDER BY year DESC
            ''', (source_id,))
            rows = cursor.fetchall()
            for r in rows:
                rankings.append(dict(r))
        except sqlite3.Error as e:
            print(f"Database error in BioxBio get_rankings: {e}")
        finally:
            conn.close()
        return rankings

    def match_venue_ranking(self, venue_raw, issn_raw=None, target_year=None):
        """Matches a venue by title/ISSN and returns the Impact Factor for a target year."""
        if not self.loaded:
            return {}
            
        # 1. Try finding by ISSN first (if provided)
        journal = None
        if issn_raw:
            journal = self.find_journal_by_issn(issn_raw)
            
        # 2. Try finding by Title if not found by ISSN
        if not journal and venue_raw:
            journal = self.find_journal_by_title(venue_raw)
            
        if not journal:
            return {} # Not found
            
        source_id = journal['source_id']
        all_ranks = self.get_rankings(source_id)
        
        if not all_ranks:
            return {
                'title': journal['title'],
                'matched_by': 'ISSN' if issn_raw and self.find_journal_by_issn(issn_raw) else 'Title'
            }
            
        impact_factor = None
        matched_year = None
        
        # Sort rankings by year DESC
        all_ranks = sorted(all_ranks, key=lambda x: x['year'], reverse=True)
        
        has_target_year = False
        target_year_val = None
        if target_year:
            try:
                target_year_val = int(target_year)
                has_target_year = True
            except ValueError:
                pass
                
        if has_target_year:
            # Try exact year match
            for r in all_ranks:
                if r['year'] == target_year_val:
                    impact_factor = r['impact_factor']
                    matched_year = target_year_val
                    break
                    
            # If target year not found, set as N/A instead of falling back
            if not matched_year:
                impact_factor = f"N/A (Chưa có dữ liệu {target_year_val})"
                matched_year = target_year_val
        else:
            # If no target year was specified or it was invalid, return N/A
            impact_factor = "N/A (Thiếu năm)"
            matched_year = None
            
        return {
            'source_id': source_id,
            'title': journal['title'],
            'matched_by': 'ISSN' if issn_raw and self.find_journal_by_issn(issn_raw) else 'Title',
            'impact_factor': impact_factor,
            'ranking_year': matched_year,
            'history': {r['year']: r['impact_factor'] for r in all_ranks}
        }

if __name__ == "__main__":
    # Test script if executed directly
    db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "scimagojr_all.db")
    matcher = SCImagoDBMatcher(db_path)
    if matcher.loaded:
        print("SCImago Database loaded. Testing matching...")
        test_title = "Ca-A Cancer Journal for Clinicians"
        result = matcher.match_venue_ranking(test_title, target_year=2023)
        print(f"Match results for '{test_title}':", result)
        
    biox_db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "bioxbio_all.db")
    biox_matcher = BioxBioDBMatcher(biox_db_path)
    if biox_matcher.loaded:
        print("\nBioxBio Database loaded. Testing matching...")
        test_title = "Cell"
        result = biox_matcher.match_venue_ranking(test_title, target_year=2024)
        print(f"Match results for '{test_title}':", result)
