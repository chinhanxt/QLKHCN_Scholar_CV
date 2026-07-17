import sqlite3
import json
import os
import hashlib

class ProfileDatabase:
    def __init__(self, db_path="saved_profiles.db"):
        # Put DB in the same directory as this file
        base_dir = os.path.dirname(os.path.abspath(__file__))
        self.db_path = os.path.join(base_dir, db_path)
        self.init_db()

    def init_db(self):
        conn = sqlite3.connect(self.db_path, timeout=30.0)
        cursor = conn.cursor()
        
        # Create authors table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS authors (
                scholar_id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                affiliation TEXT,
                citedby INTEGER,
                hindex INTEGER,
                i10index INTEGER,
                interests TEXT, -- JSON string array
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Create publications table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS publications (
                pub_id TEXT PRIMARY KEY,
                scholar_id TEXT,
                title TEXT NOT NULL,
                authors TEXT,
                venue TEXT,
                year TEXT,
                citations INTEGER,
                sjr_q TEXT,
                if_val TEXT,
                wos TEXT,
                cites_per_year TEXT, -- JSON string dict
                display_order INTEGER,
                FOREIGN KEY (scholar_id) REFERENCES authors (scholar_id) ON DELETE CASCADE
            )
        """)
        
        # Add display_order column if table already exists but lacks it
        try:
            cursor.execute("SELECT display_order FROM publications LIMIT 1")
        except sqlite3.OperationalError:
            cursor.execute("ALTER TABLE publications ADD COLUMN display_order INTEGER")
            
        conn.commit()
        conn.close()

    def save_profile(self, author_info, publications):
        """
        Saves or overwrites a profile and all its publications.
        author_info: dict containing name, scholar_id, affiliation, citedby, hindex, i10index, interests
        publications: list of dicts, each representing a publication
        """
        scholar_id = author_info.get("scholar_id") or author_info.get("id")
        if not scholar_id:
            # If no ID, compute a hash of name or similar to use as key
            name_str = author_info.get("name", "Unknown")
            scholar_id = "local_" + hashlib.md5(name_str.encode('utf-8')).hexdigest()[:12]
            
        conn = sqlite3.connect(self.db_path, timeout=30.0)
        cursor = conn.cursor()
        
        try:
            # Insert or replace author
            interests = author_info.get("interests", [])
            if not isinstance(interests, list):
                interests = []
            interests_json = json.dumps(interests, ensure_ascii=False)
            
            cursor.execute("""
                INSERT OR REPLACE INTO authors (scholar_id, name, affiliation, citedby, hindex, i10index, interests, last_updated)
                VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            """, (
                scholar_id,
                author_info.get("name", "Unknown"),
                author_info.get("affiliation", ""),
                author_info.get("citedby", 0),
                author_info.get("hindex", 0),
                author_info.get("i10index", 0),
                interests_json
            ))
            
            # Delete old publications for this author
            cursor.execute("DELETE FROM publications WHERE scholar_id = ?", (scholar_id,))
            
            # Insert new publications
            for idx, pub in enumerate(publications):
                title = pub.get("title", "")
                # Unique pub_id using scholar_id, title, and index to prevent UNIQUE constraint failure on duplicate titles
                pub_id = hashlib.md5(f"{scholar_id}_{title}_{idx}".encode('utf-8')).hexdigest()
                
                authors = pub.get("authors", "")
                venue = pub.get("venue", "")
                year = str(pub.get("year", "Không rõ"))
                citations = pub.get("citations", 0)
                
                # Ranks
                ranks = pub.get("ranks", {})
                sjr_q = ranks.get("SJR_Q", "N/A")
                
                # Impact factor formatting
                if_val = ranks.get("IF", "N/A")
                if if_val == 0.0 or if_val is None or if_val == "" or str(if_val).strip() in ("-", "0", "0.0", "N/A"):
                    display_if = "N/A"
                else:
                    display_if = f"{if_val:.3f}" if isinstance(if_val, (int, float)) else str(if_val)
                    
                wos = ranks.get("WoS_Core", "N/A")
                
                # Citation history from pub_source if available
                cites_history = pub.get("cites_per_year", {})
                if not cites_history:
                    pub_source = pub.get("pub_source")
                    if pub_source and isinstance(pub_source, dict):
                        cites_history = pub_source.get("cites_per_year", {})
                cites_history_json = json.dumps(cites_history, ensure_ascii=False)
                
                cursor.execute("""
                    INSERT INTO publications (pub_id, scholar_id, title, authors, venue, year, citations, sjr_q, if_val, wos, cites_per_year, display_order)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    pub_id,
                    scholar_id,
                    title,
                    authors,
                    venue,
                    year,
                    citations,
                    sjr_q,
                    display_if,
                    wos,
                    cites_history_json,
                    idx
                ))
                
            conn.commit()
            return True, scholar_id
        except Exception as e:
            conn.rollback()
            print(f"Error saving profile: {e}")
            return False, str(e)
        finally:
            conn.close()

    def get_all_authors(self):
        conn = sqlite3.connect(self.db_path, timeout=30.0)
        cursor = conn.cursor()
        cursor.execute("SELECT scholar_id, name, affiliation, citedby, hindex, i10index, interests, last_updated FROM authors ORDER BY name ASC")
        rows = cursor.fetchall()
        authors = []
        for r in rows:
            authors.append({
                "scholar_id": r[0],
                "name": r[1],
                "affiliation": r[2],
                "citedby": r[3],
                "hindex": r[4],
                "i10index": r[5],
                "interests": json.loads(r[6]) if r[6] else [],
                "last_updated": r[7]
            })
        conn.close()
        return authors

    def get_author_publications(self, scholar_id):
        conn = sqlite3.connect(self.db_path, timeout=30.0)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT title, authors, venue, year, citations, sjr_q, if_val, wos, cites_per_year 
            FROM publications 
            WHERE scholar_id = ?
            ORDER BY display_order ASC
        """, (scholar_id,))
        rows = cursor.fetchall()
        pubs = []
        for r in rows:
            cites_val = {}
            if r[8]:
                try:
                    cites_val = json.loads(r[8])
                    if not isinstance(cites_val, dict):
                        cites_val = {}
                except Exception:
                    cites_val = {}
            pubs.append({
                "title": r[0],
                "authors": r[1],
                "venue": r[2],
                "year": r[3],
                "citations": r[4],
                "sjr_q": r[5],
                "if_val": r[6],
                "wos": r[7],
                "cites_per_year": cites_val
            })
        conn.close()
        return pubs

    def delete_author(self, scholar_id):
        conn = sqlite3.connect(self.db_path, timeout=30.0)
        cursor = conn.cursor()
        try:
            cursor.execute("DELETE FROM authors WHERE scholar_id = ?", (scholar_id,))
            cursor.execute("DELETE FROM publications WHERE scholar_id = ?", (scholar_id,))
            conn.commit()
            return True
        except Exception as e:
            conn.rollback()
            print(f"Error deleting profile: {e}")
            return False
        finally:
            conn.close()
