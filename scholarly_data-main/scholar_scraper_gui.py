import sys
import os
import re
import csv
import json
import sqlite3
import threading
import time
import unicodedata
from datetime import datetime
import pandas as pd
import openpyxl
import customtkinter as ctk
import tkinter as tk
from tkinter import ttk, messagebox, filedialog
from scholarly import scholarly, ProxyGenerator
from profile_db import ProfileDatabase

# Set appearance mode and color theme
ctk.set_appearance_mode("Dark")
ctk.set_default_color_theme("blue")

def extract_venue(citation_str):
    """Parse venue name from Google Scholar snippet citation string."""
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

def extract_author_id(url_or_name):
    """Extract Google Scholar author ID from a citation profile URL or return text."""
    if "citations" in url_or_name or "user=" in url_or_name:
        match = re.search(r'user=([^&]+)', url_or_name)
        if match:
            return match.group(1), True
    if len(url_or_name) == 12 and re.match(r'^[a-zA-Z0-9_-]{12}$', url_or_name):
        return url_or_name, True
    return url_or_name, False


class SQLiteClarivateMappedMatcher:
    """Matches journal venues and retrieves values (IF, SJR, quartile, wos) from the local clarivate_mapped.db."""
    def __init__(self, db_path):
        self.db_path = db_path
        self.loaded = os.path.exists(db_path)
        if not self.loaded:
            print(f"Warning: Clarivate Mapped database not found at {db_path}")

    def normalize(self, name):
        """Normalizes venue names for exact database lookup."""
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

    def get_conn(self):
        """Returns a sqlite3 connection."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def match_venue(self, venue_raw, target_year=None):
        if not self.loaded or not venue_raw:
            return {}
            
        norm_title = self.normalize(venue_raw)
        if not norm_title:
            return {}
            
        conn = self.get_conn()
        cursor = conn.cursor()
        try:
            # Query exact normalized title matching from journals table
            cursor.execute('''
                SELECT publication_id, clarivate_title, wos_core_collection, 
                       bioxbio_if, scimago_sjr, scimago_quartile
                FROM journals 
                WHERE title_normalized = ?
            ''', (norm_title,))
            row = cursor.fetchone()
            if row:
                res = dict(row)
                
                ranks = {}
                ranks['MatchedTitle'] = res.get('clarivate_title')
                ranks['MatchedBy'] = 'SQLite Clarivate Mapped'
                
                # IF
                biox_if = res.get('bioxbio_if')
                if biox_if is not None:
                    ranks['IF'] = biox_if
                else:
                    ranks['IF'] = 'N/A'
                
                # SJR Score
                sjr_score = res.get('scimago_sjr')
                if sjr_score is not None:
                    ranks['SJR_Score'] = sjr_score
                else:
                    ranks['SJR_Score'] = 'N/A'
                    
                # SJR Q
                sjr_q = res.get('scimago_quartile')
                if sjr_q and sjr_q != "-":
                    ranks['SJR_Q'] = sjr_q
                else:
                    ranks['SJR_Q'] = 'N/A'
                    
                # WoS Core Collection
                wos_val = res.get('wos_core_collection')
                if wos_val:
                    ranks['WoS_Core'] = wos_val
                else:
                    ranks['WoS_Core'] = 'N/A'
                    
                return ranks
        except sqlite3.Error as e:
            print(f"Database error in match_venue: {e}")
        finally:
            conn.close()
            
        # Return N/A values if journal not found in DB
        return {
            'IF': 'N/A',
            'SJR_Score': 'N/A',
            'SJR_Q': 'N/A',
            'WoS_Core': 'N/A'
        }


class ScholarScraperApp(ctk.CTk):
    def __init__(self):
        super().__init__()
        
        self.title("Google Scholar Profile Scraper & Ranking Matcher")
        self.geometry("1260x780")
        self.minsize(1100, 680)
        
        # Threading & Data state variables
        self.scraping_thread = None
        self.stop_requested = False
        self.choice_event = threading.Event()
        self.selected_candidate_idx = -1
        
        # Data storage
        self.all_scraped_data = []
        self.current_author_info = {}
        self.scraped_json_str = ""
        self.current_full_authors = ""
        self.current_selected_idx = -1
        
        # Initialize SQLite matcher relative to script path
        base_dir = os.path.dirname(os.path.abspath(__file__))
        mapped_db_path = os.path.join(base_dir, "clarivate_mapped.db")
        self.clarivate_matcher = SQLiteClarivateMappedMatcher(mapped_db_path)
        
        # Load ICORE rules from JSON file
        self.icore_rules = {}
        icore_path = os.path.join(base_dir, "icore_criteria", "icore_criteria_rules.json")
        if os.path.exists(icore_path):
            try:
                with open(icore_path, 'r', encoding='utf-8') as f:
                    self.icore_rules = json.load(f)
            except Exception as e:
                print(f"Error loading {icore_path}: {e}")
        
        # UI Configuration variables
        self.search_filter_var = tk.StringVar()
        self.min_year_var = tk.StringVar()
        self.max_year_var = tk.StringVar()
        self.rank_filter_var = tk.StringVar(value="Tất cả hạng")
        self.qty_filter_var = tk.StringVar(value="Tất cả")
        self.enable_matching_var = tk.BooleanVar(value=True)
        self.proxy_type_var = tk.StringVar(value="None")
        self.scraper_api_key_var = tk.StringVar()
        self.retries_var = tk.StringVar(value="2")
        self.sleep_time_var = tk.StringVar(value="1.5")
        self.threads_var = tk.StringVar(value="3")
        self.profile_db = ProfileDatabase()
        
        self.setup_ui()
        self.load_databases()

    def setup_ui(self):
        # Configure Grid Layout (1 row, 2 columns: Sidebar & Main panel)
        self.grid_rowconfigure(0, weight=1)
        self.grid_columnconfigure(1, weight=1)
        
        # --- SIDEBAR FRAME ---
        self.sidebar_frame = ctk.CTkFrame(self, width=330, corner_radius=0)
        self.sidebar_frame.grid(row=0, column=0, sticky="nsew")
        self.sidebar_frame.grid_rowconfigure(9, weight=1) # fill empty space
        
        # App Title
        self.app_title_lbl = ctk.CTkLabel(
            self.sidebar_frame, 
            text="🎓 Scholar Matcher v2.5", 
            font=ctk.CTkFont(size=20, weight="bold")
        )
        self.app_title_lbl.grid(row=0, column=0, padx=20, pady=(20, 10), sticky="w")
        
        # --- CHỨC NĂNG 1: THU THẬP DỮ LIỆU ---
        self.scrape_section_frame = ctk.CTkFrame(self.sidebar_frame, fg_color="transparent")
        self.scrape_section_frame.grid(row=1, column=0, padx=20, pady=5, sticky="ew")
        
        ctk.CTkLabel(
            self.scrape_section_frame, 
            text="CHỨC NĂNG 1: CÀO TOÀN BỘ DỮ LIỆU", 
            font=ctk.CTkFont(size=12, weight="bold"),
            text_color="#3498db"
        ).pack(anchor="w", pady=(5, 5))
        
        # Input Section
        ctk.CTkLabel(self.scrape_section_frame, text="Nhập URL, ID hoặc Tên tác giả:", font=ctk.CTkFont(size=11)).pack(anchor="w")
        self.input_entry = ctk.CTkEntry(
            self.scrape_section_frame, 
            placeholder_text="Dán link hoặc nhập tên tác giả...",
            width=280
        )
        self.input_entry.pack(fill="x", pady=2)
        
        # Scraping limit
        ctk.CTkLabel(self.scrape_section_frame, text="Giới hạn cào tối đa:", font=ctk.CTkFont(size=11)).pack(anchor="w", pady=(5, 0))
        self.limit_combo = ctk.CTkComboBox(self.scrape_section_frame, values=["50", "100", "200", "500", "Unlimited"], width=280)
        self.limit_combo.set("100")
        self.limit_combo.pack(fill="x", pady=2)
        
        # Switch for rankings matching (always enabled by default, toggle removed)
        # self.matching_switch = ctk.CTkSwitch(
        #     self.scrape_section_frame, 
        #     text="Bật đối chiếu xếp hạng (SJR)", 
        #     variable=self.enable_matching_var,
        #     onvalue=True,
        #     offvalue=False,
        #     font=ctk.CTkFont(size=11, weight="bold"),
        #     progress_color="#e67e22",
        #     command=self.on_match_switch_toggled
        # )
        # self.matching_switch.pack(anchor="w", pady=4)
        
        # Run Action Buttons
        self.run_btn = ctk.CTkButton(
            self.scrape_section_frame, 
            text="🚀 1. CÀO DANH SÁCH BÀI BÁO", 
            font=ctk.CTkFont(weight="bold"), 
            fg_color="#2ecc71",
            hover_color="#27ae60",
            command=self.start_list_scraping
        )
        self.run_btn.pack(fill="x", pady=5)

        self.detail_btn = ctk.CTkButton(
            self.scrape_section_frame, 
            text="⚡ 2. CÀO CHI TIẾT & ĐỐI CHIẾU", 
            font=ctk.CTkFont(weight="bold"), 
            fg_color="#e67e22",
            hover_color="#d35400",
            state="disabled",
            command=self.start_detail_scraping
        )
        self.detail_btn.pack(fill="x", pady=5)
        
        self.stop_btn = ctk.CTkButton(
            self.scrape_section_frame, 
            text="⏹️ Dừng cào", 
            fg_color="#c0392b", 
            hover_color="#e74c3c", 
            state="disabled",
            command=self.stop_scraping
        )
        self.stop_btn.pack(fill="x", pady=2)

        self.save_profile_btn = ctk.CTkButton(
            self.scrape_section_frame, 
            text="💾 LƯU HỒ SƠ (TOOL 6)", 
            font=ctk.CTkFont(weight="bold"), 
            fg_color="#3498db",
            hover_color="#2980b9",
            state="disabled",
            command=self.save_current_profile
        )
        self.save_profile_btn.pack(fill="x", pady=5)
        
        # Divider Line
        self.divider = ctk.CTkFrame(self.sidebar_frame, height=2, fg_color="#34495e")
        self.divider.grid(row=2, column=0, padx=20, pady=10, sticky="ew")
        
        # --- CƠ SỞ DỮ LIỆU TÍCH HỢP TỰ ĐỘNG ---
        self.db_lbl_frame = ctk.CTkFrame(self.sidebar_frame, fg_color="transparent")
        self.db_lbl_frame.grid(row=3, column=0, padx=20, pady=5, sticky="ew")
        
        ctk.CTkLabel(
            self.db_lbl_frame, 
            text="📁 CƠ SỞ DỮ LIỆU ĐỐI CHIẾU", 
            font=ctk.CTkFont(size=12, weight="bold"), 
            text_color="#e67e22"
        ).pack(anchor="w", pady=(0, 5))
        
        # Mode Selector
        self.db_mode_var = tk.StringVar(value="SQLite Clarivate Mapped")
        self.db_mode_combo = ctk.CTkOptionMenu(
            self.db_lbl_frame,
            values=["SQLite Clarivate Mapped"],
            variable=self.db_mode_var,
            width=280,
            command=self.on_db_mode_change
        )
        self.db_mode_combo.pack(fill="x", pady=(0, 10))
        
        self.db_status_names_lbl = ctk.CTkLabel(
            self.db_lbl_frame, 
            text="⌛ Đang tải dữ liệu tạp chí...", 
            font=ctk.CTkFont(size=11),
            text_color="gray"
        )
        self.db_status_names_lbl.pack(anchor="w", pady=2)
        
        self.db_status_acro_lbl = ctk.CTkLabel(
            self.db_lbl_frame, 
            text="⌛ Đang tải dữ liệu xếp hạng...", 
            font=ctk.CTkFont(size=11),
            text_color="gray"
        )
        self.db_status_acro_lbl.pack(anchor="w", pady=2)
        
        # Status Box & Progress
        self.status_frame = ctk.CTkFrame(self.sidebar_frame, fg_color="transparent")
        self.status_frame.grid(row=10, column=0, padx=20, pady=15, sticky="ew")
        
        self.status_lbl = ctk.CTkLabel(self.status_frame, text="Trạng thái: Sẵn sàng", text_color="#2ecc71", font=ctk.CTkFont(size=12))
        self.status_lbl.pack(anchor="w", pady=(0, 2))
        
        self.progress_bar = ctk.CTkProgressBar(self.status_frame, width=280)
        self.progress_bar.pack(fill="x", pady=5)
        self.progress_bar.set(0)
        
        # --- MAIN CONTENT AREA ---
        self.main_tabview = ctk.CTkTabview(self)
        self.main_tabview.grid(row=0, column=1, padx=20, pady=20, sticky="nsew")
        
        self.main_tabview.add("Danh sách bài báo")
        self.main_tabview.add("Xem trước JSON thô")
        self.main_tabview.add("Thống kê & Phân tích")
        self.main_tabview.add("Cấu hình hệ thống")
        
        self.setup_table_tab()
        self.setup_json_tab()
        self.setup_stats_tab()
        self.setup_settings_tab()

    def setup_table_tab(self):
        tab = self.main_tabview.tab("Danh sách bài báo")
        
        # Configure layout inside tab
        tab.grid_rowconfigure(1, weight=1)
        tab.grid_columnconfigure(0, weight=1)
        
        # --- CHỨC NĂNG 2: BỘ LỌC DỮ LIỆU ---
        self.filter_bar = ctk.CTkFrame(tab, height=75)
        self.filter_bar.grid(row=0, column=0, sticky="ew", pady=(0, 10), padx=5)
        
        # Title of Section
        self.filter_title_lbl = ctk.CTkLabel(
            self.filter_bar, 
            text="CHỨC NĂNG 2: BỘ LỌC BÀI BÁO, NĂM & SỐ LƯỢNG (DỮ LIỆU ĐÃ CÀO)", 
            font=ctk.CTkFont(size=11, weight="bold"),
            text_color="#e74c3c"
        )
        self.filter_title_lbl.grid(row=0, column=0, columnspan=12, padx=10, pady=(5, 0), sticky="w")
        
        # Filter: Search keyword
        ctk.CTkLabel(self.filter_bar, text="Từ khóa:", font=ctk.CTkFont(size=11)).grid(row=1, column=0, padx=(10, 5), pady=5, sticky="w")
        self.filter_search_entry = ctk.CTkEntry(self.filter_bar, width=150, placeholder_text="Tên bài báo, tác giả...", textvariable=self.search_filter_var, font=ctk.CTkFont(size=11))
        self.filter_search_entry.grid(row=1, column=1, padx=5, pady=5)
        
        # Filter: Min Year
        ctk.CTkLabel(self.filter_bar, text="Năm từ:", font=ctk.CTkFont(size=11)).grid(row=1, column=2, padx=(10, 5), pady=5, sticky="w")
        self.filter_min_yr = ctk.CTkEntry(self.filter_bar, width=50, placeholder_text="2020", textvariable=self.min_year_var, font=ctk.CTkFont(size=11))
        self.filter_min_yr.grid(row=1, column=3, padx=5, pady=5)
        
        # Filter: Max Year
        ctk.CTkLabel(self.filter_bar, text="Đến:", font=ctk.CTkFont(size=11)).grid(row=1, column=4, padx=(5, 5), pady=5, sticky="w")
        self.filter_max_yr = ctk.CTkEntry(self.filter_bar, width=50, placeholder_text="2026", textvariable=self.max_year_var, font=ctk.CTkFont(size=11))
        self.filter_max_yr.grid(row=1, column=5, padx=5, pady=5)
        
        # Filter: Rank
        self.filter_rank_lbl = ctk.CTkLabel(self.filter_bar, text="Hạng:", font=ctk.CTkFont(size=11))
        self.filter_rank_lbl.grid(row=1, column=6, padx=(10, 5), pady=5, sticky="w")
        self.filter_rank_combo = ctk.CTkOptionMenu(
            self.filter_bar, 
            values=["Tất cả hạng", "Q1", "Q2", "Q3", "Q4", "Unranked"],
            variable=self.rank_filter_var,
            width=100,
            font=ctk.CTkFont(size=11)
        )
        self.filter_rank_combo.grid(row=1, column=7, padx=5, pady=5)
        
        # Filter: Quantity limit
        ctk.CTkLabel(self.filter_bar, text="Số lượng:", font=ctk.CTkFont(size=11)).grid(row=1, column=8, padx=(10, 5), pady=5, sticky="w")
        self.filter_qty_combo = ctk.CTkOptionMenu(
            self.filter_bar,
            values=["Tất cả", "Top 10 (Trích dẫn)", "Top 25 (Trích dẫn)", "Top 50 (Trích dẫn)", "Top 100 (Trích dẫn)"],
            variable=self.qty_filter_var,
            width=130,
            font=ctk.CTkFont(size=11)
        )
        self.filter_qty_combo.grid(row=1, column=9, padx=5, pady=5)
        
        # Filter actions
        self.apply_filter_btn = ctk.CTkButton(self.filter_bar, text="Lọc ngay", width=70, height=26, font=ctk.CTkFont(size=11, weight="bold"), command=self.apply_filters)
        self.apply_filter_btn.grid(row=1, column=10, padx=(15, 5), pady=5)
        
        self.clear_filter_btn = ctk.CTkButton(self.filter_bar, text="Xóa lọc", width=60, height=26, font=ctk.CTkFont(size=11), fg_color="gray", hover_color="#6e6e6e", command=self.clear_filters)
        self.clear_filter_btn.grid(row=1, column=11, padx=5, pady=5)
        
        # --- TREEVIEW TABLE MAIN LAYOUT ---
        self.table_main_layout = ctk.CTkFrame(tab, fg_color="transparent")
        self.table_main_layout.grid(row=1, column=0, sticky="nsew", padx=5, pady=5)
        self.table_main_layout.grid_rowconfigure(0, weight=1)
        self.table_main_layout.grid_columnconfigure(0, weight=3) # Table gets 3/4
        self.table_main_layout.grid_columnconfigure(1, weight=1) # Detail panel gets 1/4
        
        self.table_container = ctk.CTkFrame(self.table_main_layout, corner_radius=10)
        self.table_container.grid(row=0, column=0, sticky="nsew")
        
        # Style treeview
        style = ttk.Style()
        style.theme_use("clam")
        style.configure("Treeview",
                        background="#2a2d2e",
                        foreground="#eaeaea",
                        rowheight=32,
                        fieldbackground="#2a2d2e",
                        gridcolor="#383b3c",
                        font=("Arial", 11),
                        borderwidth=0)
        style.map('Treeview', background=[('selected', '#1f538d')])
        
        style.configure("Treeview.Heading",
                        background="#1f2122",
                        foreground="white",
                        relief="flat",
                        font=("Arial", 11, "bold"))
        style.map("Treeview.Heading",
                  background=[('active', '#2d3031')])
        
        # Create Treeview
        columns = ("Title", "Authors", "Extracted Venue", "Year", "Citations", "Matched Rank", "IF", "WoS", "Reason")
        self.tree = ttk.Treeview(self.table_container, columns=columns, show="headings", selectmode="browse")
        
        # Headers & Columns definition
        self.tree.heading("Title", text="Tên bài báo", anchor="w")
        self.tree.heading("Authors", text="Tác giả", anchor="w")
        self.tree.heading("Extracted Venue", text="Tạp chí/Hội nghị", anchor="w")
        self.tree.heading("Year", text="Năm", anchor="center")
        self.tree.heading("Citations", text="Trích dẫn", anchor="center")
        self.tree.heading("Matched Rank", text="Phân hạng (SJR Q)", anchor="center")
        self.tree.heading("IF", text="Impact Factor (IF)", anchor="center")
        self.tree.heading("WoS", text="Web of Science (WoS)", anchor="center")
        self.tree.heading("Reason", text="Cơ sở đối chiếu", anchor="w")
        
        self.tree.column("Title", width=250, minwidth=180, anchor="w")
        self.tree.column("Authors", width=120, minwidth=80, anchor="w")
        self.tree.column("Extracted Venue", width=140, minwidth=90, anchor="w")
        self.tree.column("Year", width=50, minwidth=40, anchor="center")
        self.tree.column("Citations", width=55, minwidth=40, anchor="center")
        self.tree.column("Matched Rank", width=110, minwidth=80, anchor="center")
        self.tree.column("IF", width=80, minwidth=60, anchor="center")
        self.tree.column("WoS", width=150, minwidth=100, anchor="center")
        self.tree.column("Reason", width=130, minwidth=90, anchor="w")
        
        # Scrollbars
        self.tree_vsb = ttk.Scrollbar(self.table_container, orient="vertical", command=self.tree.yview)
        self.tree_hsb = ttk.Scrollbar(self.table_container, orient="horizontal", command=self.tree.xview)
        self.tree.configure(yscrollcommand=self.tree_vsb.set, xscrollcommand=self.tree_hsb.set)
        
        # Grid layout for table elements
        self.tree.grid(row=0, column=0, sticky="nsew")
        self.tree_vsb.grid(row=0, column=1, sticky="ns")
        self.tree_hsb.grid(row=1, column=0, sticky="ew")
        
        self.table_container.grid_rowconfigure(0, weight=1)
        self.table_container.grid_columnconfigure(0, weight=1)
        
        # --- DETAIL PANEL (Right Sidebar) ---
        self.detail_panel = ctk.CTkScrollableFrame(self.table_main_layout, label_text="Xem nhanh thông tin bài báo", label_font=ctk.CTkFont(size=12, weight="bold"))
        self.detail_panel.grid(row=0, column=1, sticky="nsew", padx=(10, 0))
        
        # Info labels
        # 1. Title
        self.det_title_lbl = ctk.CTkLabel(self.detail_panel, text="📌 Tên bài báo:", font=ctk.CTkFont(size=11, weight="bold"), text_color="#3498db")
        self.det_title_lbl.pack(anchor="w", pady=(5, 0))
        self.det_title_val = ctk.CTkLabel(self.detail_panel, text="Chưa chọn bài báo", font=ctk.CTkFont(size=12, weight="bold"), justify="left", wraplength=220)
        self.det_title_val.pack(anchor="w", pady=(0, 10))
        
        # 2. Authors
        self.authors_container = ctk.CTkFrame(self.detail_panel, fg_color="transparent")
        self.authors_container.pack(anchor="w", fill="x", pady=(5, 5))
        
        self.det_authors_lbl = ctk.CTkLabel(self.authors_container, text="👥 Tác giả:", font=ctk.CTkFont(size=11, weight="bold"), text_color="#bdc3c7")
        self.det_authors_lbl.pack(anchor="w", pady=(0, 0))
        
        self.det_authors_val = ctk.CTkLabel(self.authors_container, text="Chưa xác định", font=ctk.CTkFont(size=12), justify="left", wraplength=220)
        self.det_authors_val.pack(anchor="w", pady=(0, 0))
        
        self.det_authors_btn = ctk.CTkButton(
            self.authors_container,
            text="Xem thêm",
            width=80,
            height=20,
            font=ctk.CTkFont(size=11, weight="bold"),
            fg_color="#34495e",
            hover_color="#2c3e50",
            command=self.show_all_authors
        )
        
        # 3. Venue
        self.det_venue_lbl = ctk.CTkLabel(self.detail_panel, text="🏢 Tạp chí/Hội nghị:", font=ctk.CTkFont(size=11, weight="bold"), text_color="#bdc3c7")
        self.det_venue_lbl.pack(anchor="w", pady=(5, 0))
        self.det_venue_val = ctk.CTkLabel(self.detail_panel, text="Chưa xác định", font=ctk.CTkFont(size=12), justify="left", wraplength=220)
        self.det_venue_val.pack(anchor="w", pady=(0, 10))
        
        # 4. Year
        self.det_year_lbl = ctk.CTkLabel(self.detail_panel, text="📅 Năm xuất bản:", font=ctk.CTkFont(size=11, weight="bold"), text_color="#bdc3c7")
        self.det_year_lbl.pack(anchor="w", pady=(5, 0))
        self.det_year_val = ctk.CTkLabel(self.detail_panel, text="N/A", font=ctk.CTkFont(size=12))
        self.det_year_val.pack(anchor="w", pady=(0, 10))
        
        # 5. Citations
        self.citations_container = ctk.CTkFrame(self.detail_panel, fg_color="transparent")
        self.citations_container.pack(anchor="w", fill="x", pady=(5, 5))
        
        self.det_citations_lbl = ctk.CTkLabel(self.citations_container, text="💬 Số trích dẫn:", font=ctk.CTkFont(size=11, weight="bold"), text_color="#bdc3c7")
        self.det_citations_lbl.pack(anchor="w", pady=(0, 0))
        
        self.det_citations_val = ctk.CTkLabel(self.citations_container, text="0", font=ctk.CTkFont(size=12))
        self.det_citations_val.pack(anchor="w", pady=(0, 0))
        
        self.det_citations_chart_btn = ctk.CTkButton(
            self.citations_container,
            text="Xem biểu đồ",
            width=80,
            height=20,
            font=ctk.CTkFont(size=11, weight="bold"),
            fg_color="#34495e",
            hover_color="#2c3e50",
            command=self.show_publication_citation_chart
        )
        
        # 6. Rank
        self.det_rank_lbl = ctk.CTkLabel(self.detail_panel, text="🏆 Phân hạng (SJR Q):", font=ctk.CTkFont(size=11, weight="bold"), text_color="#2ecc71")
        self.det_rank_lbl.pack(anchor="w", pady=(5, 0))
        self.det_rank_val = ctk.CTkLabel(self.detail_panel, text="N/A", font=ctk.CTkFont(size=13, weight="bold"), text_color="#e67e22")
        self.det_rank_val.pack(anchor="w", pady=(0, 10))
        
        # 7. Impact Factor (IF)
        self.det_if_lbl = ctk.CTkLabel(self.detail_panel, text="📈 Impact Factor (IF):", font=ctk.CTkFont(size=11, weight="bold"), text_color="#1abc9c")
        self.det_if_lbl.pack(anchor="w", pady=(5, 0))
        self.det_if_val = ctk.CTkLabel(self.detail_panel, text="N/A", font=ctk.CTkFont(size=13, weight="bold"), text_color="#e67e22")
        self.det_if_val.pack(anchor="w", pady=(0, 10))
        
        # 8. Web of Science (WoS)
        self.det_wos_lbl = ctk.CTkLabel(self.detail_panel, text="🔍 Web of Science (WoS):", font=ctk.CTkFont(size=11, weight="bold"), text_color="#3498db")
        self.det_wos_lbl.pack(anchor="w", pady=(5, 0))
        self.det_wos_val = ctk.CTkLabel(self.detail_panel, text="N/A", font=ctk.CTkFont(size=13, weight="bold"), text_color="#e67e22")
        self.det_wos_val.pack(anchor="w", pady=(0, 10))
        
        # Event binding for row selection
        self.tree.bind("<<TreeviewSelect>>", self.on_tree_select)
        
        # --- EXPORT & FOOTER CONTROLS ---
        self.footer_frame = ctk.CTkFrame(tab, height=50, fg_color="transparent")
        self.footer_frame.grid(row=2, column=0, sticky="ew", pady=(10, 0), padx=5)
        
        self.showing_lbl = ctk.CTkLabel(self.footer_frame, text="Hiển thị 0 trong số 0 bài báo", font=ctk.CTkFont(size=12))
        self.showing_lbl.pack(side="left", padx=10)
        
        self.export_xls_btn = ctk.CTkButton(
            self.footer_frame, 
            text="🟢 Xuất Excel (.xlsx)", 
            fg_color="#27ae60", 
            hover_color="#219653", 
            command=lambda: self.export_data("excel")
        )
        self.export_xls_btn.pack(side="right", padx=5)
        
        self.export_csv_btn = ctk.CTkButton(
            self.footer_frame, 
            text="🔵 Xuất CSV (.csv)", 
            fg_color="#2980b9", 
            hover_color="#1f6696", 
            command=lambda: self.export_data("csv")
        )
        self.export_csv_btn.pack(side="right", padx=5)

    def setup_json_tab(self):
        tab = self.main_tabview.tab("Xem trước JSON thô")
        tab.grid_rowconfigure(1, weight=1)
        tab.grid_columnconfigure(0, weight=1)
        
        hdr_frame = ctk.CTkFrame(tab, fg_color="transparent")
        hdr_frame.grid(row=0, column=0, sticky="ew", pady=(5, 10))
        
        ctk.CTkLabel(
            hdr_frame, 
            text="Dữ liệu JSON thô thu được từ Chức năng cào Google Scholar (kèm theo phân hạng đa kênh):", 
            font=ctk.CTkFont(size=12, weight="bold")
        ).pack(side="left", padx=10)
        
        self.download_json_btn = ctk.CTkButton(
            hdr_frame, 
            text="💾 Tải tệp JSON (.json)", 
            fg_color="#9b59b6", 
            hover_color="#8e44ad",
            font=ctk.CTkFont(weight="bold"),
            command=self.download_json
        )
        self.download_json_btn.pack(side="right", padx=10)
        
        self.json_preview_textbox = ctk.CTkTextbox(tab, font=("Courier New", 12), wrap="none")
        self.json_preview_textbox.grid(row=1, column=0, sticky="nsew", padx=10, pady=5)
        self.json_preview_textbox.insert("1.0", "{\n  \"message\": \"Chưa có dữ liệu. Vui lòng thực hiện cào dữ liệu ở Chức năng 1 (Sidebar trái).\"\n}")
        self.json_preview_textbox.configure(state="disabled")

    def setup_stats_tab(self):
        tab = self.main_tabview.tab("Thống kê & Phân tích")
        
        tab.grid_rowconfigure(1, weight=1)
        tab.grid_rowconfigure(2, weight=1)
        tab.grid_columnconfigure(0, weight=1)
        tab.grid_columnconfigure(1, weight=1)
        
        # --- CARDS PANEL ---
        self.cards_frame = ctk.CTkFrame(tab, fg_color="transparent")
        self.cards_frame.grid(row=0, column=0, columnspan=2, sticky="ew", pady=(5, 15))
        self.cards_frame.grid_columnconfigure((0, 1, 2, 3), weight=1)
        
        # Card 1: Total Publications
        self.card1 = ctk.CTkFrame(self.cards_frame, height=90, fg_color="#2c3e50")
        self.card1.grid(row=0, column=0, padx=10, pady=5, sticky="ew")
        self.card1.grid_propagate(False)
        ctk.CTkLabel(self.card1, text="TỔNG SỐ BÀI BÁO", font=ctk.CTkFont(size=10, weight="bold"), text_color="#bdc3c7").pack(pady=(12, 0))
        self.stat_total_papers = ctk.CTkLabel(self.card1, text="0", font=ctk.CTkFont(size=26, weight="bold"))
        self.stat_total_papers.pack()
        
        # Card 2: Total Citations
        self.card2 = ctk.CTkFrame(self.cards_frame, height=90, fg_color="#16a085")
        self.card2.grid(row=0, column=1, padx=10, pady=5, sticky="ew")
        self.card2.grid_propagate(False)
        ctk.CTkLabel(self.card2, text="TỔNG SỐ TRÍCH DẪN", font=ctk.CTkFont(size=10, weight="bold"), text_color="#d5f5e3").pack(pady=(12, 0))
        self.stat_total_citations = ctk.CTkLabel(self.card2, text="0", font=ctk.CTkFont(size=26, weight="bold"))
        self.stat_total_citations.pack()
        
        # Card 3: h-index
        self.card3 = ctk.CTkFrame(self.cards_frame, height=90, fg_color="#8e44ad")
        self.card3.grid(row=0, column=2, padx=10, pady=5, sticky="ew")
        self.card3.grid_propagate(False)
        ctk.CTkLabel(self.card3, text="CHỈ SỐ H-INDEX (LỌC)", font=ctk.CTkFont(size=10, weight="bold"), text_color="#ebdef0").pack(pady=(12, 0))
        self.stat_h_index = ctk.CTkLabel(self.card3, text="0", font=ctk.CTkFont(size=26, weight="bold"))
        self.stat_h_index.pack()
        
        # Card 4: High Rankings
        self.card4 = ctk.CTkFrame(self.cards_frame, height=90, fg_color="#d35400")
        self.card4.grid(row=0, column=3, padx=10, pady=5, sticky="ew")
        self.card4.grid_propagate(False)
        self.card4_lbl = ctk.CTkLabel(self.card4, text="HẠNG CAO (Q1 / A* / A)", font=ctk.CTkFont(size=10, weight="bold"), text_color="#fdebd0")
        self.card4_lbl.pack(pady=(12, 0))
        self.stat_high_ranked = ctk.CTkLabel(self.card4, text="0", font=ctk.CTkFont(size=26, weight="bold"))
        self.stat_high_ranked.pack()
        
        # --- CHARTS CANVAS PANEL ---
        # Canvas 1: Ranks distribution
        self.rank_chart_frame = ctk.CTkFrame(tab)
        self.rank_chart_frame.grid(row=1, column=0, padx=10, pady=5, sticky="nsew")
        self.rank_canvas = tk.Canvas(self.rank_chart_frame, bg="#1a1c1d", highlightthickness=0)
        self.rank_canvas.pack(fill="both", expand=True, padx=10, pady=10)
        
        # Canvas 2: Years distribution
        self.year_chart_frame = ctk.CTkFrame(tab)
        self.year_chart_frame.grid(row=1, column=1, padx=10, pady=5, sticky="nsew")
        self.year_canvas = tk.Canvas(self.year_chart_frame, bg="#1a1c1d", highlightthickness=0)
        self.year_canvas.pack(fill="both", expand=True, padx=10, pady=10)
        
        # Canvas 3: Citation History distribution
        self.cite_chart_frame = ctk.CTkFrame(tab)
        self.cite_chart_frame.grid(row=2, column=0, columnspan=2, padx=10, pady=5, sticky="nsew")
        self.cite_canvas = tk.Canvas(self.cite_chart_frame, bg="#1a1c1d", highlightthickness=0)
        self.cite_canvas.pack(fill="both", expand=True, padx=10, pady=10)
        
        self.rank_canvas.bind("<Configure>", lambda event: self.draw_rank_chart())
        self.year_canvas.bind("<Configure>", lambda event: self.draw_year_chart())
        self.cite_canvas.bind("<Configure>", lambda event: self.draw_citation_history_chart())

    def setup_settings_tab(self):
        tab = self.main_tabview.tab("Cấu hình hệ thống")
        
        tab.grid_columnconfigure(0, weight=1)
        tab.grid_rowconfigure(2, weight=1)
        
        # --- SCRAPER PARAMETERS ---
        self.scrape_settings_frame = ctk.CTkFrame(tab)
        self.scrape_settings_frame.grid(row=0, column=0, padx=20, pady=10, sticky="ew")
        
        ctk.CTkLabel(self.scrape_settings_frame, text="🛰️ Cấu hình Yêu cầu & Tránh bị chặn", font=ctk.CTkFont(size=15, weight="bold")).grid(row=0, column=0, columnspan=2, padx=20, pady=10, sticky="w")
        
        ctk.CTkLabel(self.scrape_settings_frame, text="Thời gian chờ giữa các request (giây):").grid(row=1, column=0, padx=20, pady=5, sticky="w")
        self.sleep_entry = ctk.CTkEntry(self.scrape_settings_frame, textvariable=self.sleep_time_var, width=100)
        self.sleep_entry.grid(row=1, column=1, padx=20, pady=5, sticky="w")
        
        ctk.CTkLabel(self.scrape_settings_frame, text="Số lần thử lại khi lỗi HTTP:").grid(row=2, column=0, padx=20, pady=5, sticky="w")
        self.retries_entry = ctk.CTkEntry(self.scrape_settings_frame, textvariable=self.retries_var, width=100)
        self.retries_entry.grid(row=2, column=1, padx=20, pady=5, sticky="w")
        
        ctk.CTkLabel(self.scrape_settings_frame, text="Số luồng cào song song:").grid(row=3, column=0, padx=20, pady=5, sticky="w")
        self.threads_entry = ctk.CTkEntry(self.scrape_settings_frame, textvariable=self.threads_var, width=100)
        self.threads_entry.grid(row=3, column=1, padx=20, pady=5, sticky="w")
        
        # --- PROXY CONFIGURATION ---
        self.proxy_settings_frame = ctk.CTkFrame(tab)
        self.proxy_settings_frame.grid(row=1, column=0, padx=20, pady=10, sticky="ew")
        
        ctk.CTkLabel(self.proxy_settings_frame, text="🌐 Cấu hình Proxy (Độ tin cậy cao)", font=ctk.CTkFont(size=15, weight="bold")).grid(row=0, column=0, columnspan=2, padx=20, pady=10, sticky="w")
        
        ctk.CTkLabel(self.proxy_settings_frame, text="Loại Proxy:").grid(row=1, column=0, padx=20, pady=5, sticky="w")
        self.proxy_combo = ctk.CTkOptionMenu(
            self.proxy_settings_frame, 
            values=["None", "Free Proxies", "ScraperAPI"], 
            variable=self.proxy_type_var,
            width=150,
            command=self.on_proxy_change
        )
        self.proxy_combo.grid(row=1, column=1, padx=20, pady=5, sticky="w")
        
        self.key_lbl = ctk.CTkLabel(self.proxy_settings_frame, text="ScraperAPI Key:")
        self.key_lbl.grid(row=2, column=0, padx=20, pady=5, sticky="w")
        self.key_entry = ctk.CTkEntry(self.proxy_settings_frame, textvariable=self.scraper_api_key_var, width=280, placeholder_text="Nhập ScraperAPI key...")
        self.key_entry.grid(row=2, column=1, padx=20, pady=5, sticky="w")
        self.key_entry.configure(state="disabled")

    def on_proxy_change(self, value):
        if value == "ScraperAPI":
            self.key_entry.configure(state="normal")
        else:
            self.key_entry.configure(state="disabled")

    def on_match_switch_toggled(self):
        enabled = self.enable_matching_var.get()
        if enabled:
            self.filter_rank_combo.configure(state="normal")
            self.log("Đã bật tính năng đối chiếu xếp hạng.")
        else:
            self.filter_rank_combo.configure(state="disabled")
            self.rank_filter_var.set("Tất cả hạng")
            self.log("Đã tắt tính năng đối chiếu xếp hạng.")
            
        if self.all_scraped_data:
            self.apply_filters()

    def log(self, message):
        timestamp = datetime.now().strftime("%H:%M:%S")
        formatted_msg = f"[{timestamp}] {message}"
        print(formatted_msg)
        self.status_lbl.configure(text=f"Trạng thái: {message[:35]}...")

    def update_progress(self, val, status_text=None):
        self.progress_bar.set(val)
        if status_text:
            self.status_lbl.configure(text=f"Trạng thái: {status_text}")

    def load_databases(self):
        """Loads SQLite databases."""
        self.log("Đang nạp cơ sở dữ liệu đối chiếu...")
        
        base_dir = os.path.dirname(os.path.abspath(__file__))
        mapped_db_path = os.path.join(base_dir, "clarivate_mapped.db")
        self.clarivate_matcher = SQLiteClarivateMappedMatcher(mapped_db_path)
        success = self.clarivate_matcher.loaded
        
        journals_count = 0
        if success:
            try:
                conn = self.clarivate_matcher.get_conn()
                cursor = conn.cursor()
                journals_count = cursor.execute("SELECT count(*) FROM journals").fetchone()[0]
                conn.close()
            except Exception as e:
                print(f"Error querying Clarivate Mapped stats: {e}")
                success = False

        # Update labels
        db_txt = f"✓ Clarivate Mapped: {journals_count:,} Tạp chí" if success else "✗ Lỗi nạp Clarivate Mapped"
        
        self.db_status_names_lbl.configure(text=db_txt, text_color="#2ecc71" if success else "#e74c3c")
        self.db_status_acro_lbl.configure(text="Sử dụng DB chuẩn Clarivate Mapped", text_color="gray")
        
        if success:
            self.status_lbl.configure(text="Trạng thái: Đã nạp CSDL đối chiếu", text_color="#2ecc71")
        else:
            self.status_lbl.configure(text="Trạng thái: Lỗi nạp CSDL đối chiếu", text_color="#e74c3c")
            messagebox.showwarning("Cơ sở dữ liệu", "Không thể nạp cơ sở dữ liệu đối chiếu. Vui lòng chạy Tool 5 để tạo và cập nhật DB.")

    def show_selection_dialog(self, candidates):
        dialog = ctk.CTkToplevel(self)
        dialog.title("Lựa chọn Hồ sơ Tác giả")
        dialog.geometry("620x450")
        dialog.grab_set()
        dialog.resizable(False, False)
        
        dialog.update_idletasks()
        x = self.winfo_x() + (self.winfo_width() - dialog.winfo_width()) // 2
        y = self.winfo_y() + (self.winfo_height() - dialog.winfo_height()) // 2
        dialog.geometry(f"+{x}+{y}")
        
        ctk.CTkLabel(
            dialog, 
            text="Phát hiện nhiều tài khoản trùng tên. Vui lòng chọn hồ sơ:", 
            font=ctk.CTkFont(size=13, weight="bold")
        ).pack(pady=15)
        
        frame = ctk.CTkScrollableFrame(dialog, width=560, height=280)
        frame.pack(pady=10, padx=20, fill="both", expand=True)
        
        def select_author(idx):
            self.selected_candidate_idx = idx
            dialog.destroy()
            self.choice_event.set()
            
        def cancel_search():
            self.selected_candidate_idx = -1
            dialog.destroy()
            self.choice_event.set()
            
        dialog.protocol("WM_DELETE_WINDOW", cancel_search)
        
        for idx, author in enumerate(candidates):
            name = author.get('name', 'Không rõ')
            aff = author.get('affiliation', 'Không có thông tin tổ chức')
            citations = author.get('citedby', 0)
            interests = ", ".join(author.get('interests', []))
            
            info = f"👤 {name} (Tổng trích dẫn: {citations})\n🏢 {aff}\n🏷️ Lĩnh vực: {interests[:60]}"
            
            btn = ctk.CTkButton(
                frame, 
                text=info, 
                anchor="w", 
                justify="left",
                height=75,
                font=ctk.CTkFont(size=12),
                command=lambda i=idx: select_author(i)
            )
            btn.pack(pady=5, fill="x", padx=10)
            
        cancel_btn = ctk.CTkButton(dialog, text="Hủy tìm kiếm", fg_color="#c0392b", hover_color="#e74c3c", command=cancel_search)
        cancel_btn.pack(pady=15)

    def start_list_scraping(self):
        input_text = self.input_entry.get().strip()
        if not input_text:
            messagebox.showerror("Lỗi", "Vui lòng nhập Link hồ sơ, ID hoặc Tên tác giả Google Scholar.")
            return
            
        self.run_btn.configure(state="disabled")
        self.detail_btn.configure(state="disabled")
        self.save_profile_btn.configure(state="disabled")
        self.stop_btn.configure(state="normal")
        self.stop_requested = False
        self.update_progress(0.02, "Đang khởi tạo trình cào danh sách...")
        
        max_publications = self.limit_combo.get()
        
        self.scraping_thread = threading.Thread(
            target=self.run_list_scraping_worker,
            args=(input_text, max_publications)
        )
        self.scraping_thread.daemon = True
        self.scraping_thread.start()

    def start_detail_scraping(self):
        if not self.all_scraped_data:
            messagebox.showerror("Lỗi", "Không có danh sách bài báo nào để cào chi tiết. Vui lòng cào danh sách trước.")
            return
            
        self.run_btn.configure(state="disabled")
        self.detail_btn.configure(state="disabled")
        self.save_profile_btn.configure(state="disabled")
        self.stop_btn.configure(state="normal")
        self.stop_requested = False
        self.update_progress(0.0, "Bắt đầu cào chi tiết bài báo...")
        
        self.scraping_thread = threading.Thread(
            target=self.run_detail_scraping_worker
        )
        self.scraping_thread.daemon = True
        self.scraping_thread.start()

    def stop_scraping(self):
        self.stop_requested = True
        self.choice_event.set()
        self.log("Đang yêu cầu dừng tiến trình cào...")
        self.stop_btn.configure(state="disabled")

    def run_list_scraping_worker(self, input_text, max_publications):
        try:
            pg = None
            proxy_type = self.proxy_type_var.get()
            if proxy_type == "Free Proxies":
                self.log("Đang dò tìm Free Proxies. Có thể mất chút thời gian...")
                pg = ProxyGenerator()
                pg.FreeProxies()
                scholarly.use_proxy(pg)
            elif proxy_type == "ScraperAPI":
                api_key = self.scraper_api_key_var.get().strip()
                if not api_key:
                    self.log("Key ScraperAPI trống! Tiến hành cào trực tiếp...")
                    scholarly.use_proxy(None)
                else:
                    self.log("Cấu hình ScraperAPI...")
                    pg = ProxyGenerator()
                    pg.ScraperAPI(api_key)
                    scholarly.use_proxy(pg)
            else:
                self.log("Cào trực tiếp không dùng Proxy...")
                scholarly.use_proxy(None)
                
            try:
                scholarly.set_retries(int(self.retries_var.get()))
            except ValueError:
                scholarly.set_retries(2)
                
            author_id, is_id = extract_author_id(input_text)
            author = None
            
            if is_id:
                self.log(f"Đang lấy hồ sơ tác giả bằng ID: {author_id}")
                author = scholarly.search_author_id(author_id)
            else:
                self.log(f"Đang tìm kiếm hồ sơ tác giả theo tên: {input_text}")
                search_query = scholarly.search_author(input_text)
                
                candidates = []
                for _ in range(5):
                    try:
                        candidates.append(next(search_query))
                    except StopIteration:
                        break
                        
                if not candidates:
                    raise Exception(f"Không tìm thấy hồ sơ nào khớp với tên '{input_text}'.")
                    
                if len(candidates) > 1:
                    self.choice_event.clear()
                    self.selected_candidate_idx = -1
                    self.after(0, lambda: self.show_selection_dialog(candidates))
                    self.choice_event.wait()
                    
                    if self.selected_candidate_idx == -1:
                        raise Exception("Đã hủy cào. Không chọn hồ sơ tác giả.")
                        
                    author = candidates[self.selected_candidate_idx]
                else:
                    author = candidates[0]
            
            self.log(f"Đang lấy danh sách bài báo của tác giả: {author['name']}...")
            limit = 0 if max_publications == "Unlimited" else int(max_publications)
            
            author = scholarly.fill(author, sections=['basics', 'indices', 'counts', 'publications'], publication_limit=limit)
            
            pubs = author.get('publications', [])
            total_pubs = len(pubs)
            self.log(f"Tải thành công danh sách hồ sơ. Tìm thấy {total_pubs} bài báo.")
            
            scraped_data = []
            for idx, pub in enumerate(pubs):
                title = pub['bib'].get('title', 'Không rõ tiêu đề')
                authors = pub['bib'].get('author', '')
                if not authors:
                    authors = pub['bib'].get('citation', '')
                year = pub['bib'].get('pub_year', 'Không rõ')
                num_citations = pub.get('num_citations', 0)
                
                # Normalize authors
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
                
                # Try to extract venue from citation snippet if available
                citation_str = pub['bib'].get('citation', '')
                venue_raw = extract_venue(citation_str)
                if not venue_raw:
                    venue_raw = "Tạp chí/Hội nghị chưa xác định"
                    
                # Match to Database
                ranks = self.match_venue_by_mode(venue_raw, target_year=year)
                
                scraped_data.append({
                    'title': title,
                    'authors': authors_clean,
                    'venue': venue_raw,
                    'year': year,
                    'citations': num_citations,
                    'ranks': ranks,
                    'pub_source': pub
                })
                
                self.after(0, lambda i=idx+1, t=total_pubs: self.update_progress(i/t, f"Đang tải danh sách: {i}/{t} bài báo"))
            
            self.after(0, lambda: self.on_list_scraping_finished(scraped_data, author))
            
        except Exception as e:
            self.after(0, lambda err=str(e): self.on_scraping_error(err))

    def on_list_scraping_finished(self, scraped_data, author_info):
        self.all_scraped_data = scraped_data
        self.current_author_info = author_info
        
        self.run_btn.configure(state="normal")
        self.detail_btn.configure(state="normal")
        self.save_profile_btn.configure(state="normal")
        self.stop_btn.configure(state="disabled")
        self.progress_bar.set(1.0)
        self.status_lbl.configure(text="Trạng thái: Tải xong danh sách! Bấm nút 2 để cào chi tiết", text_color="#2ecc71")
        
        # Display publication list in Treeview
        self.clear_filters()
        
        # Save raw JSON
        self.update_json_preview()
        
        messagebox.showinfo("Hoàn tất", f"Đã tải xong danh sách {len(scraped_data)} bài báo của tác giả {author_info.get('name', 'Tác giả')}.\nBây giờ bạn có thể bấm nút '2. CÀO CHI TIẾT & ĐỐI CHIẾU' để tải chi tiết và đối chiếu điểm số.")

    def update_json_preview(self):
        clean_publications = []
        for pub_item in self.all_scraped_data:
            clean_pub = {k: v for k, v in pub_item.items() if k != 'pub_source'}
            clean_publications.append(clean_pub)
            
        json_output = {
            "author": {
                "name": self.current_author_info.get("name", "Unknown"),
                "scholar_id": self.current_author_info.get("scholar_id", ""),
                "affiliation": self.current_author_info.get("affiliation", ""),
                "citedby": self.current_author_info.get("citedby", 0),
                "hindex": self.current_author_info.get("hindex", 0),
                "i10index": self.current_author_info.get("i10index", 0),
                "interests": self.current_author_info.get("interests", [])
            },
            "publications": clean_publications
        }
        
        self.scraped_json_str = json.dumps(json_output, indent=4, ensure_ascii=False)
        self.json_preview_textbox.configure(state="normal")
        self.json_preview_textbox.delete("1.0", tk.END)
        self.json_preview_textbox.insert("1.0", self.scraped_json_str)
        self.json_preview_textbox.configure(state="disabled")

    def run_detail_scraping_worker(self):
        try:
            total_pubs = len(self.all_scraped_data)
            
            import concurrent.futures
            import random
            
            try:
                max_workers = int(self.threads_var.get())
            except ValueError:
                max_workers = 3
            data_lock = threading.Lock()
            processed_count = 0
            
            def process_detail(idx, item):
                nonlocal processed_count
                if self.stop_requested:
                    return None
                    
                pub_source = item.get('pub_source')
                if not pub_source:
                    return None
                    
                title = item['title']
                self.log(f"[{idx+1}/{total_pubs}] Đang lấy chi tiết: {title[:25]}...")
                
                # Fetch details
                try:
                    # Random delay before starting request to avoid bot detection
                    try:
                        base_sleep = float(self.sleep_time_var.get())
                    except ValueError:
                        base_sleep = 1.5
                    jitter = random.uniform(-0.3, 0.5)
                    actual_sleep = max(0.2, base_sleep + jitter)
                    time.sleep(actual_sleep)
                    
                    filled_pub = scholarly.fill(pub_source)
                    journal = filled_pub['bib'].get('journal', '')
                    conf = filled_pub['bib'].get('conference', '')
                    venue_raw = journal if journal else conf
                    filled_authors = filled_pub['bib'].get('author', '')
                    
                    # Update item in place
                    if venue_raw:
                        item['venue'] = venue_raw
                    if filled_authors:
                        if isinstance(filled_authors, list):
                            item['authors'] = ", ".join(filled_authors)
                        else:
                            authors_str = str(filled_authors)
                            if ' and ' in authors_str:
                                parts = [p.strip() for p in authors_str.split(' and ') if p.strip()]
                            else:
                                parts = [p.strip() for p in authors_str.split(',') if p.strip()]
                            item['authors'] = ", ".join(parts)
                    
                    # Re-match with updated venue
                    item['ranks'] = self.match_venue_by_mode(item['venue'], item.get('year'))
                    
                except Exception as e:
                    self.log(f"Lỗi lấy chi tiết '{title[:15]}': {str(e)}")
                    
                # Update progress bar and row in UI
                with data_lock:
                    processed_count += 1
                    pct = float(processed_count) / total_pubs
                    self.after(0, lambda p=pct, c=processed_count: self.update_progress(p, f"Đang tải chi tiết: {c}/{total_pubs} bài báo"))
                    
                    # Proactively update treeview row if it is currently displayed
                    self.after(0, lambda idx_val=idx, it=item: self.update_tree_row(idx_val, it))
                    
                return idx

            # Execute parallel processing
            futures = []
            with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
                for i, item in enumerate(self.all_scraped_data):
                    futures.append(executor.submit(process_detail, i, item))
                
                # Wait for all to complete
                for future in concurrent.futures.as_completed(futures):
                    if self.stop_requested:
                        for f in futures:
                            f.cancel()
                        break
                        
            self.after(0, self.on_detail_scraping_finished)
            
        except Exception as e:
            self.after(0, lambda err=str(e): self.on_scraping_error(err))

    def update_tree_row(self, overall_idx, item):
        # Find if this item is currently visible in the Treeview
        if not hasattr(self, 'current_filtered_data'):
            return
            
        for tree_idx, visible_item in enumerate(self.current_filtered_data):
            if visible_item['title'] == item['title']:
                ranks = item.get('ranks', {})
                matching_enabled = self.enable_matching_var.get()
                
                if matching_enabled and ranks:
                    sjr_q = ranks.get('SJR_Q', 'N/A')
                    display_rank = f"SJR: {sjr_q}" if sjr_q != 'N/A' else 'N/A'
                    
                    if_val = ranks.get('IF', 'N/A')
                    if if_val == 0.0 or if_val is None or if_val == "" or str(if_val).strip() in ("-", "0", "0.0", "N/A"):
                        display_if = "N/A"
                    else:
                        display_if = f"{if_val:.3f}" if isinstance(if_val, (int, float)) else str(if_val)
                        
                    display_wos = ranks.get('WoS_Core', 'N/A')
                    
                    reason_parts = []
                    matched_by = ranks.get('MatchedBy', '')
                    matched_title = ranks.get('MatchedTitle', '')
                    if matched_title:
                        reason_parts.append(f"{matched_by} ({matched_title})")
                    display_reason = " & ".join(reason_parts) if reason_parts else "Không khớp CSDL"
                else:
                    display_rank = "N/A"
                    display_if = "N/A"
                    display_wos = "N/A"
                    display_reason = "Đối chiếu đang tắt" if not matching_enabled else "Không khớp rank"
                
                try:
                    self.tree.item(
                        str(tree_idx),
                        values=(
                            item['title'],
                            item['authors'],
                            item['venue'],
                            item['year'],
                            item['citations'],
                            display_rank,
                            display_if,
                            display_wos,
                            display_reason
                        )
                    )
                except Exception:
                    pass
                break

    def on_detail_scraping_finished(self):
        self.run_btn.configure(state="normal")
        self.detail_btn.configure(state="normal")
        self.save_profile_btn.configure(state="normal")
        self.stop_btn.configure(state="disabled")
        self.progress_bar.set(1.0)
        self.status_lbl.configure(text="Trạng thái: Đã tải xong chi tiết bài báo!", text_color="#2ecc71")
        
        # Save JSON preview with updated detailed values
        self.update_json_preview()
        
        # Refresh statistics and charts
        if hasattr(self, 'current_filtered_data'):
            self.calculate_and_draw_stats(self.current_filtered_data)
            
        messagebox.showinfo("Hoàn tất", f"Đã cào chi tiết và đối chiếu xong toàn bộ bài báo!")

    def on_scraping_error(self, error_msg):
        self.run_btn.configure(state="normal")
        self.detail_btn.configure(state="normal")
        self.save_profile_btn.configure(state="normal" if hasattr(self, 'all_scraped_data') and self.all_scraped_data else "disabled")
        self.stop_btn.configure(state="disabled")
        self.progress_bar.set(0)
        self.status_lbl.configure(text="Trạng thái: Lỗi cào dữ liệu", text_color="#e74c3c")
        self.log(f"Lỗi: {error_msg}")
        messagebox.showerror("Lỗi hệ thống", f"Xảy ra lỗi trong quá trình thu thập:\n{error_msg}\n\nMẹo: Google Scholar chặn IP? Hãy kích hoạt Proxy trong cài đặt.")

    def save_current_profile(self):
        if not hasattr(self, 'all_scraped_data') or not self.all_scraped_data or not hasattr(self, 'current_author_info') or not self.current_author_info:
            messagebox.showerror("Lỗi", "Không có dữ liệu hồ sơ để lưu.")
            return
            
        success, msg_or_id = self.profile_db.save_profile(self.current_author_info, self.all_scraped_data)
        if success:
            messagebox.showinfo("Thành công", f"Đã lưu thành công hồ sơ của tác giả '{self.current_author_info.get('name')}' vào cơ sở dữ liệu Tool 6.\n(Nếu hồ sơ đã tồn tại, dữ liệu cũ đã được ghi đè).")
        else:
            messagebox.showerror("Lỗi", f"Không thể lưu hồ sơ: {msg_or_id}")

    def display_publications(self, data_list):
        for item in self.tree.get_children():
            self.tree.delete(item)
            
        # Store current filtered data list to map row index to actual dict reference
        self.current_filtered_data = data_list
        
        # Reset detail panel
        self.det_title_val.configure(text="Chưa chọn bài báo")
        self.det_authors_val.configure(text="Chưa xác định")
        self.det_authors_btn.pack_forget()
        self.current_full_authors = ""
        self.det_venue_val.configure(text="Chưa xác định")
        self.det_year_val.configure(text="N/A")
        self.det_citations_val.configure(text="0")
        self.det_citations_chart_btn.pack_forget()
        self.det_rank_val.configure(text="N/A")
        self.det_if_val.configure(text="N/A")
        self.det_wos_val.configure(text="N/A")
        
        matching_enabled = self.enable_matching_var.get()
        
        for idx, item in enumerate(data_list):
            ranks = item.get('ranks', {})
            
            if matching_enabled and ranks:
                # SJR
                sjr_q = ranks.get('SJR_Q', 'N/A')
                display_rank = f"SJR: {sjr_q}" if sjr_q != 'N/A' else 'N/A'
                
                # IF
                if_val = ranks.get('IF', 'N/A')
                if if_val == 0.0 or if_val is None or if_val == "" or str(if_val).strip() in ("-", "0", "0.0", "N/A"):
                    display_if = "N/A"
                else:
                    display_if = f"{if_val:.3f}" if isinstance(if_val, (int, float)) else str(if_val)
                
                # WoS
                display_wos = ranks.get('WoS_Core', 'N/A')
                
                # Reason
                reason_parts = []
                matched_by = ranks.get('MatchedBy', '')
                matched_title = ranks.get('MatchedTitle', '')
                if matched_title:
                    reason_parts.append(f"{matched_by} ({matched_title})")
                display_reason = " & ".join(reason_parts) if reason_parts else "Không khớp CSDL"
            else:
                display_rank = "N/A"
                display_if = "N/A"
                display_wos = "N/A"
                display_reason = "Đối chiếu đang tắt" if not matching_enabled else "Không khớp rank"
                
            self.tree.insert(
                "", 
                "end", 
                iid=str(idx),
                values=(
                    item['title'],
                    item['authors'],
                    item['venue'],
                    item['year'],
                    item['citations'],
                    display_rank,
                    display_if,
                    display_wos,
                    display_reason
                )
            )
            
        self.showing_lbl.configure(text=f"Đang hiển thị {len(data_list)} trong số {len(self.all_scraped_data)} bài báo đã cào")
        self.calculate_and_draw_stats(data_list)

    def apply_filters(self):
        if not self.all_scraped_data:
            return
            
        search_q = self.search_filter_var.get().strip().lower()
        
        try:
            min_year = int(self.min_year_var.get().strip()) if self.min_year_var.get().strip() else None
        except ValueError:
            min_year = None
            
        try:
            max_year = int(self.max_year_var.get().strip()) if self.max_year_var.get().strip() else None
        except ValueError:
            max_year = None
            
        selected_rank = self.rank_filter_var.get()
        selected_qty = self.qty_filter_var.get()
        matching_enabled = self.enable_matching_var.get()
        
        filtered_list = []
        for item in self.all_scraped_data:
            # 1. Keyword search (Title, Authors, Venue)
            if search_q:
                t_match = search_q in item['title'].lower()
                a_match = search_q in item['authors'].lower()
                v_match = search_q in item['venue'].lower()
                if not (t_match or a_match or v_match):
                    continue
            
            # 2. Publication year bounds
            year_str = str(item['year'])
            try:
                yr_match = re.search(r'\b(19|20)\d{2}\b', year_str)
                pub_yr = int(yr_match.group(0)) if yr_match else None
            except Exception:
                pub_yr = None
                
            if pub_yr is not None:
                if min_year is not None and pub_yr < min_year:
                    continue
                if max_year is not None and pub_yr > max_year:
                    continue
            elif min_year is not None or max_year is not None:
                continue
                
            # 3. Dynamic Rank Filtering
            if matching_enabled and selected_rank != "Tất cả hạng":
                ranks = item.get('ranks', {})
                has_rank = False
                
                proposed = ranks.get('Proposed_Rank')
                proposed_system, proposed_val = "", ""
                if proposed and ":" in proposed:
                    proposed_system, proposed_val = proposed.split(":", 1)
                    proposed_system = proposed_system.strip()
                    proposed_val = proposed_val.strip()
                
                if selected_rank in ["Q1", "Q2", "Q3", "Q4"]:
                    if proposed_system == "SJR":
                        has_rank = (proposed_val == selected_rank)
                    elif ranks.get('SJR_Q') == selected_rank:
                        has_rank = True
                elif selected_rank == "Unranked":
                    if proposed:
                        has_rank = False
                    else:
                        active_ranks = {k: v for k, v in ranks.items() if k not in ['MatchedBy', 'MatchedTitle', 'Proposed_Rank', 'IF_MatchedTitle', 'IF_RankingYear']}
                        if not active_ranks:
                            has_rank = True
                            
                if not has_rank:
                    continue
                    
            filtered_list.append(item)
            
        # 4. Top N Citations limit
        if selected_qty != "Tất cả":
            try:
                limit_num = int(re.search(r'\d+', selected_qty).group(0))
                filtered_list = sorted(filtered_list, key=lambda x: int(x['citations']), reverse=True)
                filtered_list = filtered_list[:limit_num]
            except Exception as e:
                self.log(f"Lỗi lọc số lượng: {str(e)}")
                
        self.display_publications(filtered_list)

    def clear_filters(self):
        self.search_filter_var.set("")
        self.min_year_var.set("")
        self.max_year_var.set("")
        self.rank_filter_var.set("Tất cả hạng")
        self.qty_filter_var.set("Tất cả")
        self.apply_filters()

    def calculate_and_draw_stats(self, dataset):
        total_papers = len(dataset)
        total_citations = sum([int(item['citations']) for item in dataset])
        
        citations_list = sorted([int(item['citations']) for item in dataset], reverse=True)
        h_index = 0
        for idx, val in enumerate(citations_list):
            if val >= idx + 1:
                h_index = idx + 1
            else:
                break
                
        matching_enabled = self.enable_matching_var.get()
        if matching_enabled:
            high_ranked_count = 0
            for item in dataset:
                ranks = item.get('ranks', {})
                proposed = ranks.get('Proposed_Rank')
                proposed_system, proposed_val = "", ""
                if proposed and ":" in proposed:
                    proposed_system, proposed_val = proposed.split(":", 1)
                    proposed_system = proposed_system.strip()
                    proposed_val = proposed_val.strip()
                
                is_high = False
                # SJR
                if proposed_system == "SJR":
                    if proposed_val == "Q1":
                        is_high = True
                elif ranks.get('SJR_Q') == "Q1":
                    is_high = True
                    
                if is_high:
                    high_ranked_count += 1
            self.stat_high_ranked.configure(text=str(high_ranked_count))
            self.card4_lbl.configure(text="HẠNG CAO (Q1)")
        else:
            self.stat_high_ranked.configure(text="N/A")
            self.card4_lbl.configure(text="ĐỐI CHIẾU ĐANG TẮT")
        
        self.stat_total_papers.configure(text=str(total_papers))
        self.stat_total_citations.configure(text=f"{total_citations:,}")
        self.stat_h_index.configure(text=str(h_index))
        
        self.draw_rank_chart()
        self.draw_year_chart()
        self.cite_canvas.after(0, self.draw_citation_history_chart)

    def get_rank_distribution_data(self):
        if not self.all_scraped_data or not self.enable_matching_var.get():
            return {}
            
        ranks = []
        for item in self.tree.get_children():
            # Extract ranks shown in table cell values
            val = str(self.tree.item(item)['values'][5])
            if val and val != "N/A" and val != "Unranked":
                # Splitting combined rank string 'SJR: Q1'
                parts = [p.split(":")[1].strip() for p in val.split("|") if ":" in p]
                for part in parts:
                    clean_part = part.split("(")[0].strip()
                    ranks.append(clean_part)
                
        if not ranks:
            return {}
            
        distribution = {"Q1": 0, "Q2": 0, "Q3": 0, "Q4": 0}
        for r in ranks:
            if r in distribution:
                distribution[r] += 1
                
        return {k: v for k, v in distribution.items() if v > 0}

    def get_year_distribution_data(self):
        years_list = []
        for item in self.tree.get_children():
            y = str(self.tree.item(item)['values'][3])
            match = re.search(r'\b(19|20)\d{2}\b', y)
            if match:
                years_list.append(int(match.group(0)))
                
        if not years_list:
            return {}
            
        min_y = min(years_list)
        max_y = max(years_list)
        
        dist = {y: 0 for y in range(min_y, max_y + 1)}
        for y in years_list:
            dist[y] += 1
            
        return dist

    def draw_rank_chart(self):
        enabled = self.enable_matching_var.get()
        if enabled:
            data = self.get_rank_distribution_data()
            self.draw_bar_chart(self.rank_canvas, data, "Phân phối Xếp hạng Bài báo", "#d35400")
        else:
            self.rank_canvas.delete("all")
            w = self.rank_canvas.winfo_width()
            h = self.rank_canvas.winfo_height()
            self.rank_canvas.create_text(w/2, h/2, text="Đang tắt tính năng đối chiếu xếp hạng", fill="gray", font=("Arial", 11))

    def draw_year_chart(self):
        data = self.get_year_distribution_data()
        self.draw_bar_chart(self.year_canvas, data, "Số lượng bài báo theo Năm", "#2980b9")

    def draw_citation_history_chart(self):
        cites_data = self.current_author_info.get('cites_per_year', {})
        if not cites_data:
            self.cite_canvas.delete("all")
            w = self.cite_canvas.winfo_width()
            h = self.cite_canvas.winfo_height()
            self.cite_canvas.create_text(w/2, h/2, text="Không có dữ liệu trích dẫn theo năm", fill="gray", font=("Arial", 11))
            return
            
        sorted_keys = sorted(cites_data.keys())
        data = {str(year): cites_data[year] for year in sorted_keys}
        
        total_cites = self.current_author_info.get('citedby', 0)
        title = f"Lịch sử Trích dẫn theo Năm (Tổng trích dẫn: {total_cites:,} trích dẫn)"
        self.draw_bar_chart(self.cite_canvas, data, title, "#7f8c8d")

    def draw_bar_chart(self, canvas, data, title, bar_color):
        canvas.delete("all")
        
        w = canvas.winfo_width()
        h = canvas.winfo_height()
        
        if w < 50 or h < 50:
            return
            
        canvas.create_text(w/2, 20, text=title, fill="white", font=("Arial", 12, "bold"), anchor="n")
        
        if not data:
            canvas.create_text(w/2, h/2, text="Không có dữ liệu hiển thị", fill="gray", font=("Arial", 11))
            return
            
        keys = list(data.keys())
        values = list(data.values())
        max_val = max(values) if values else 1
        if max_val == 0:
            max_val = 1
            
        num_items = len(keys)
        padding_x = 40
        padding_y_top = 70
        padding_y_bottom = 35
        
        chart_w = w - (2 * padding_x)
        chart_h = h - padding_y_top - padding_y_bottom
        
        bar_w = (chart_w / num_items) * 0.65
        spacing = (chart_w / num_items) * 0.35
        
        # Baseline
        canvas.create_line(padding_x, h - padding_y_bottom, w - padding_x, h - padding_y_bottom, fill="#4f5254", width=1)
        
        for idx, (k, v) in enumerate(zip(keys, values)):
            x_left = padding_x + (idx * (bar_w + spacing)) + (spacing / 2)
            x_right = x_left + bar_w
            
            bar_height = (v / max_val) * chart_h
            y_top = h - padding_y_bottom - bar_height
            y_bottom = h - padding_y_bottom
            
            if bar_height > 0:
                canvas.create_rectangle(x_left, y_top, x_right, y_bottom, fill=bar_color, outline="", width=0)
                canvas.create_text((x_left + x_right)/2, y_top - 10, text=str(v), fill="#eaeaea", font=("Arial", 9, "bold"))
                
            canvas.create_text((x_left + x_right)/2, y_bottom + 12, text=str(k), fill="#95a5a6", font=("Arial", 9))

    def download_json(self):
        if not self.scraped_json_str:
            messagebox.showwarning("Cảnh báo", "Không có dữ liệu JSON thô. Vui lòng thực hiện cào ở Chức năng 1 trước.")
            return
            
        author_name = self.current_author_info.get("name", "Scholar")
        author_clean = re.sub(r'[^a-zA-Z0-9]', '_', author_name)
        
        filename = filedialog.asksaveasfilename(
            title="Tải xuống tệp JSON thô",
            initialfile=f"{author_clean}_raw_data.json",
            filetypes=[("JSON Files", "*.json")],
            defaultextension=".json"
        )
        if filename:
            try:
                with open(filename, 'w', encoding='utf-8') as f:
                    f.write(self.scraped_json_str)
                self.log(f"Đã tải xuống tệp JSON thô: {filename}")
                messagebox.showinfo("Thành công", "Đã tải xuống tệp JSON thô thành công!")
            except Exception as e:
                messagebox.showerror("Lỗi", f"Không thể lưu tệp JSON:\n{str(e)}")

    def export_data(self, file_type):
        rows = self.tree.get_children()
        if not rows:
            messagebox.showwarning("Xuất báo cáo", "Không có dữ liệu bài báo hiển thị trong bảng để xuất file.")
            return
            
        export_list = []
        for r in rows:
            values = self.tree.item(r)['values']
            export_list.append({
                "Tên bài báo": values[0],
                "Tác giả": values[1],
                "Tạp chí/Hội nghị": values[2],
                "Năm": values[3],
                "Số trích dẫn": values[4],
                "Hạng (SJR Q)": values[5],
                "Impact Factor (IF)": values[6],
                "Web of Science": values[7],
                "Chi tiết đối chiếu": values[8]
            })
            
        df = pd.DataFrame(export_list)
        
        author_name = self.current_author_info.get("name", "Scholar")
        author_clean = re.sub(r'[^a-zA-Z0-9]', '_', author_name)
        
        if file_type == "excel":
            filename = filedialog.asksaveasfilename(
                title="Xuất báo cáo sang Excel",
                initialfile=f"{author_clean}_bai_bao_da_loc.xlsx",
                filetypes=[("Excel Files", "*.xlsx")],
                defaultextension=".xlsx"
            )
            if filename:
                try:
                    df.to_excel(filename, index=False, engine='openpyxl')
                    self.log(f"Xuất file thành công: {filename}")
                    messagebox.showinfo("Thành công", "Đã xuất file Excel bài báo thành công!")
                except Exception as e:
                    messagebox.showerror("Lỗi", f"Không thể lưu file Excel:\n{str(e)}")
        else:
            filename = filedialog.asksaveasfilename(
                title="Xuất báo cáo sang CSV",
                initialfile=f"{author_clean}_bai_bao_da_loc.csv",
                filetypes=[("CSV Files", "*.csv")],
                defaultextension=".csv"
            )
            if filename:
                try:
                    df.to_csv(filename, index=False, encoding='utf-8-sig')
                    self.log(f"Xuất file thành công: {filename}")
                    messagebox.showinfo("Thành công", "Đã xuất file CSV bài báo thành công!")
                except Exception as e:
                    messagebox.showerror("Lỗi", f"Không thể lưu file CSV:\n{str(e)}")

    def on_tree_select(self, event):
        selected_items = self.tree.selection()
        if not selected_items:
            self.det_title_val.configure(text="Chưa chọn bài báo")
            self.det_authors_val.configure(text="Chưa xác định")
            self.det_authors_btn.pack_forget()
            self.current_full_authors = ""
            self.current_selected_idx = -1
            self.det_venue_val.configure(text="Chưa xác định")
            self.det_year_val.configure(text="N/A")
            self.det_citations_val.configure(text="0")
            self.det_citations_chart_btn.pack_forget()
            self.det_rank_val.configure(text="N/A")
            self.det_if_val.configure(text="N/A")
            self.det_wos_val.configure(text="N/A")
            return
            
        idx = int(selected_items[0])
        if not hasattr(self, 'current_filtered_data') or idx >= len(self.current_filtered_data):
            return
            
        pub_item = self.current_filtered_data[idx]
        self.current_selected_idx = idx
        
        # Update labels
        self.det_title_val.configure(text=pub_item['title'])
        
        # Format and show authors (truncate if too many)
        full_authors = pub_item.get('authors', '')
        self.current_full_authors = full_authors
        
        if not full_authors or full_authors == "Chưa xác định":
            self.det_authors_val.configure(text="Chưa xác định")
            self.det_authors_btn.pack_forget()
        else:
            author_list = [a.strip() for a in re.split(r'\s+and\s+|,', full_authors) if a.strip()]
            if author_list and author_list[-1] in ('...', '…'):
                author_list.pop()
                
            if len(author_list) > 3:
                short_text = ", ".join(author_list[:3]) + "..."
                self.det_authors_val.configure(text=short_text)
                self.det_authors_btn.pack(anchor="w", pady=(5, 0))
            else:
                self.det_authors_val.configure(text=full_authors)
                self.det_authors_btn.pack_forget()

        self.det_venue_val.configure(text=pub_item['venue'])
        self.det_year_val.configure(text=str(pub_item['year']))
        self.det_citations_val.configure(text=str(pub_item['citations']))
        
        # Show citation chart button if citations > 0
        try:
            cites_count = int(pub_item.get('citations', 0))
        except ValueError:
            cites_count = 0
            
        if cites_count > 0:
            self.det_citations_chart_btn.pack(anchor="w", pady=(5, 0))
        else:
            self.det_citations_chart_btn.pack_forget()
        
        # Form rank string
        ranks = pub_item.get('ranks', {})
        matching_enabled = self.enable_matching_var.get()
        
        if matching_enabled and ranks:
            # SJR
            sjr_q = ranks.get('SJR_Q', 'N/A')
            display_rank = f"SJR: {sjr_q}" if sjr_q != 'N/A' else 'N/A'
            
            # IF
            if 'IF' in ranks:
                if_val = ranks['IF']
                if if_val == 0.0 or if_val is None or if_val == "" or str(if_val).strip() in ("-", "0", "0.0", "N/A"):
                    display_if = "N/A"
                else:
                    display_if = f"{if_val:.3f}" if isinstance(if_val, (int, float)) else str(if_val)
            else:
                display_if = "N/A"
                
            # WoS
            display_wos = ranks.get('WoS_Core', 'N/A')
        else:
            display_rank = "N/A"
            display_if = "N/A"
            display_wos = "N/A"
            
        self.det_rank_val.configure(text=display_rank)
        self.det_if_val.configure(text=display_if)
        self.det_wos_val.configure(text=display_wos)

    def show_all_authors(self):
        if not hasattr(self, 'current_selected_idx') or self.current_selected_idx < 0:
            return
        if not hasattr(self, 'current_filtered_data') or self.current_selected_idx >= len(self.current_filtered_data):
            return
            
        pub_item = self.current_filtered_data[self.current_selected_idx]
        pub_source = pub_item.get('pub_source')
        
        # Check if the author list is truncated (ends with ... or … or contains …)
        authors_val = pub_item.get('authors', '')
        is_truncated = (
            authors_val.endswith('...') or 
            authors_val.endswith('…') or 
            '…' in authors_val
        )
        
        if is_truncated and pub_source and not pub_source.get('filled', False):
            # We need to fetch the full authors list on-demand!
            self.det_authors_btn.configure(text="Đang tải...", state="disabled")
            
            def fetch_on_demand():
                try:
                    self.log(f"Đang tải danh sách tác giả đầy đủ cho bài báo: {pub_item['title'][:30]}...")
                    # Perform fill
                    filled_pub = scholarly.fill(pub_source)
                    
                    # Extract authors
                    filled_authors = filled_pub['bib'].get('author', '')
                    if filled_authors:
                        # Normalize authors
                        if isinstance(filled_authors, list):
                            authors_clean = ", ".join(filled_authors)
                        else:
                            authors_str = str(filled_authors)
                            if ' and ' in authors_str:
                                parts = [p.strip() for p in authors_str.split(' and ') if p.strip()]
                            else:
                                parts = [p.strip() for p in authors_str.split(',') if p.strip()]
                            authors_clean = ", ".join(parts)
                            
                        # Update the item in our list!
                        pub_item['authors'] = authors_clean
                        self.current_full_authors = authors_clean
                        
                        # Update treeview
                        self.after(0, lambda: self.tree.set(str(self.current_selected_idx), "Authors", authors_clean))
                        # Update the detailed panel text label as well
                        author_list = [a.strip() for a in re.split(r'\s+and\s+|,', authors_clean) if a.strip()]
                        if author_list and author_list[-1] in ('...', '…'):
                            author_list.pop()
                        if len(author_list) > 3:
                            short_text = ", ".join(author_list[:3]) + "..."
                        else:
                            short_text = authors_clean
                        self.after(0, lambda st=short_text: self.det_authors_val.configure(text=st))
                    
                    # Once done, launch the dialog in the main thread
                    self.after(0, self.open_authors_dialog)
                except Exception as e:
                    self.log(f"Lỗi tải tác giả chi tiết: {str(e)}")
                    self.after(0, self.open_authors_dialog)
                finally:
                    self.after(0, lambda: self.det_authors_btn.configure(text="Xem thêm", state="normal"))
            
            threading.Thread(target=fetch_on_demand, daemon=True).start()
        else:
            # Not truncated or already filled, just show it
            self.open_authors_dialog()

    def open_authors_dialog(self):
        if not hasattr(self, 'current_full_authors') or not self.current_full_authors:
            return
            
        dialog = ctk.CTkToplevel(self)
        dialog.title("Danh sách Tác giả đầy đủ")
        dialog.geometry("500x350")
        dialog.grab_set()
        dialog.resizable(False, False)
        
        dialog.update_idletasks()
        x = self.winfo_x() + (self.winfo_width() - dialog.winfo_width()) // 2
        y = self.winfo_y() + (self.winfo_height() - dialog.winfo_height()) // 2
        dialog.geometry(f"+{x}+{y}")
        
        ctk.CTkLabel(
            dialog, 
            text="👥 Danh sách Tác giả đầy đủ", 
            font=ctk.CTkFont(size=13, weight="bold"),
            text_color="#3498db"
        ).pack(pady=(15, 5))
        
        textbox = ctk.CTkTextbox(dialog, width=460, height=220, font=ctk.CTkFont(size=12))
        textbox.pack(pady=10, padx=20, fill="both", expand=True)
        
        authors_raw = self.current_full_authors
        author_list = [a.strip() for a in re.split(r'\s+and\s+|,', authors_raw) if a.strip()]
        if author_list and author_list[-1] in ('...', '…'):
            author_list.pop()
            
        formatted_authors = "\n".join([f"{idx+1}. {author}" for idx, author in enumerate(author_list)])
        
        textbox.insert("1.0", formatted_authors)
        textbox.configure(state="disabled")
        
        ctk.CTkButton(
            dialog, 
            text="Đóng", 
            width=100, 
            command=dialog.destroy
        ).pack(pady=(5, 15))

    def show_publication_citation_chart(self):
        if not hasattr(self, 'current_selected_idx') or self.current_selected_idx < 0:
            return
        if not hasattr(self, 'current_filtered_data') or self.current_selected_idx >= len(self.current_filtered_data):
            return
            
        pub_item = self.current_filtered_data[self.current_selected_idx]
        pub_source = pub_item.get('pub_source')
        
        cites_per_year = pub_item.get('cites_per_year')
        if not cites_per_year and pub_source:
            cites_per_year = pub_source.get('cites_per_year')
            
        if not cites_per_year and pub_source and not pub_source.get('filled', False):
            # We need to load it dynamically on-demand!
            self.det_citations_chart_btn.configure(text="Đang tải...", state="disabled")
            
            def fetch_on_demand():
                try:
                    self.log(f"Đang tải biểu đồ trích dẫn cho bài báo: {pub_item['title'][:30]}...")
                    filled_pub = scholarly.fill(pub_source)
                    
                    cites_history = filled_pub.get('cites_per_year', {})
                    pub_item['cites_per_year'] = cites_history
                    
                    # Update authors if filled, just in case
                    filled_authors = filled_pub['bib'].get('author', '')
                    if filled_authors:
                        if isinstance(filled_authors, list):
                            authors_clean = ", ".join(filled_authors)
                        else:
                            authors_str = str(filled_authors)
                            if ' and ' in authors_str:
                                parts = [p.strip() for p in authors_str.split(' and ') if p.strip()]
                            else:
                                parts = [p.strip() for p in authors_str.split(',') if p.strip()]
                            authors_clean = ", ".join(parts)
                        pub_item['authors'] = authors_clean
                        self.current_full_authors = authors_clean
                        self.after(0, lambda: self.tree.set(str(self.current_selected_idx), "Authors", authors_clean))
                        
                        author_list = [a.strip() for a in re.split(r'\s+and\s+|,', authors_clean) if a.strip()]
                        if author_list and author_list[-1] in ('...', '…'):
                            author_list.pop()
                        if len(author_list) > 3:
                            short_text = ", ".join(author_list[:3]) + "..."
                        else:
                            short_text = authors_clean
                        self.after(0, lambda st=short_text: self.det_authors_val.configure(text=st))
                    
                    self.after(0, self.open_publication_citation_dialog)
                except Exception as e:
                    self.log(f"Lỗi tải chi tiết bài báo: {str(e)}")
                    self.after(0, self.open_publication_citation_dialog)
                finally:
                    self.after(0, lambda: self.det_citations_chart_btn.configure(text="Xem biểu đồ", state="normal"))
            
            threading.Thread(target=fetch_on_demand, daemon=True).start()
        else:
            if cites_per_year:
                pub_item['cites_per_year'] = cites_per_year
            self.open_publication_citation_dialog()

    def open_publication_citation_dialog(self):
        if not hasattr(self, 'current_selected_idx') or self.current_selected_idx < 0:
            return
        pub_item = self.current_filtered_data[self.current_selected_idx]
        cites_data = pub_item.get('cites_per_year', {})
        
        dialog = ctk.CTkToplevel(self)
        dialog.title("Biểu đồ Trích dẫn theo Năm")
        dialog.geometry("850x500")
        dialog.grab_set()
        dialog.resizable(False, False)
        
        dialog.update_idletasks()
        x = self.winfo_x() + (self.winfo_width() - dialog.winfo_width()) // 2
        y = self.winfo_y() + (self.winfo_height() - dialog.winfo_height()) // 2
        dialog.geometry(f"+{x}+{y}")
        
        title_label = ctk.CTkLabel(
            dialog, 
            text=pub_item['title'], 
            font=ctk.CTkFont(size=12, weight="bold"),
            justify="center",
            wraplength=780,
            text_color="#3498db"
        )
        title_label.pack(pady=(15, 10), padx=20)
        
        canvas_frame = ctk.CTkFrame(dialog)
        canvas_frame.pack(fill="both", expand=True, padx=20, pady=5)
        
        canvas = tk.Canvas(canvas_frame, bg="#1a1c1d", highlightthickness=0)
        canvas.pack(fill="both", expand=True, padx=10, pady=10)
        
        ctk.CTkButton(
            dialog, 
            text="Đóng", 
            width=100, 
            command=dialog.destroy
        ).pack(pady=(10, 15))
        
        def on_configure(event):
            if not cites_data:
                canvas.delete("all")
                w = canvas.winfo_width()
                h = canvas.winfo_height()
                canvas.create_text(w/2, h/2, text="Không có dữ liệu trích dẫn chi tiết theo năm", fill="gray", font=("Arial", 11))
                return
                
            sorted_keys = sorted(cites_data.keys())
            data = {str(year): cites_data[year] for year in sorted_keys}
            title = f"Tổng số trích dẫn bài báo này: {pub_item['citations']} trích dẫn"
            self.draw_bar_chart(canvas, data, title, "#7f8c8d")
            
        canvas.bind("<Configure>", on_configure)

    def on_db_mode_change(self, value):
        self.log(f"Chuyển chế độ CSDL đối chiếu sang: {value}")
        
        # Refresh SQLite counts if SQLite mode is selected
        try:
            self.clarivate_matcher.loaded = os.path.exists(self.clarivate_matcher.db_path)
            
            journals_count = 0
            if self.clarivate_matcher.loaded:
                conn = self.clarivate_matcher.get_conn()
                journals_count = conn.execute("SELECT count(*) FROM journals").fetchone()[0]
                conn.close()
                
            db_txt = f"✓ Clarivate Mapped: {journals_count:,} Tạp chí" if self.clarivate_matcher.loaded else "✗ Lỗi nạp Clarivate Mapped"
            self.db_status_names_lbl.configure(text=db_txt, text_color="#2ecc71" if self.clarivate_matcher.loaded else "#e74c3c")
            self.db_status_acro_lbl.configure(text="Sử dụng DB chuẩn Clarivate Mapped", text_color="gray")
        except Exception as e:
            print(f"Error updating SQLite stats: {e}")
                
        if self.all_scraped_data:
            # Re-match rankings for all scraped articles
            for item in self.all_scraped_data:
                item['ranks'] = self.match_venue_by_mode(item['venue'], item.get('year'))
            self.apply_filters()

    def match_venue_by_mode(self, venue_raw, target_year=None):
        ranks = {}
        if hasattr(self, 'clarivate_matcher') and self.clarivate_matcher.loaded:
            clarivate_ranks = self.clarivate_matcher.match_venue(venue_raw, target_year=target_year)
            ranks.update(clarivate_ranks)
        return ranks

if __name__ == "__main__":
    app = ScholarScraperApp()
    app.mainloop()
