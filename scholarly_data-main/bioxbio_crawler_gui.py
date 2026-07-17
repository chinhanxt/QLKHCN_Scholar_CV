import os
import sys
import time
import sqlite3
import re
import queue
import threading
import tkinter as tk
from tkinter import ttk, messagebox
import customtkinter as ctk
import pandas as pd

# Import backend modules
from bioxbio_crawler import crawl_bioxbio_deep, init_db, normalize_title

ctk.set_appearance_mode("Dark")
ctk.set_default_color_theme("blue")

class ThreadSafeConsoleQueue:
    """Queue to collect stdout prints from background thread and send to GUI."""
    def __init__(self):
        self.q = queue.Queue()

    def write(self, text):
        self.q.put(text)

    def flush(self):
        pass

class BioxBioCrawlerApp(ctk.CTk):
    def __init__(self):
        super().__init__()

        self.title("BioxBio Impact Factor (IF) - Database Manager")
        self.geometry("1200x750")
        
        # Configure paths
        self.script_dir = os.path.dirname(os.path.abspath(__file__))
        self.db_file_path = os.path.join(self.script_dir, "bioxbio_all.db")

        # Initialize SQLite DB
        init_db(self.db_file_path)
        
        # Background task queue & variables
        self.msg_queue = queue.Queue()
        self.console_queue = ThreadSafeConsoleQueue()
        
        # Save original stdout
        self.old_stdout = sys.stdout
        sys.stdout = self.console_queue

        self.crawler_thread = None
        self.stop_event = threading.Event()
        self.is_running = False

        # GUI Layout Config
        self.grid_columnconfigure(1, weight=1)
        self.grid_rowconfigure(0, weight=1)

        # Create Sidebar
        self.create_sidebar()

        # Create Main Panel with Tabs
        self.create_main_panel()

        # Load initial statistics & search
        self.update_db_stats()
        self.refresh_year_dropdown()
        self.search_db()

        # Start periodic GUI updates
        self.after(100, self.process_queues)

    def create_sidebar(self):
        self.sidebar = ctk.CTkFrame(self, width=240, corner_radius=0)
        self.sidebar.grid(row=0, column=0, sticky="nsew", padx=0, pady=0)
        self.sidebar.grid_rowconfigure(6, weight=1)  # spacer

        # Brand Title
        self.app_title = ctk.CTkLabel(
            self.sidebar, 
            text="BIOPBIO IF CRAWLER", 
            font=ctk.CTkFont(size=15, weight="bold"),
            text_color="#1f538d"
        )
        self.app_title.grid(row=0, column=0, padx=15, pady=(15, 5), sticky="w")
        
        # Divider
        self.divider = ctk.CTkFrame(self.sidebar, height=2, fg_color="#34495e")
        self.divider.grid(row=1, column=0, padx=15, pady=5, sticky="ew")

        # Operations Box
        self.ops_box = ctk.CTkFrame(self.sidebar, fg_color="#1e2122", corner_radius=8)
        self.ops_box.grid(row=2, column=0, padx=15, pady=10, sticky="ew")
        
        self.ops_title = ctk.CTkLabel(self.ops_box, text="CẤP NHẬT DỮ LIỆU IF", font=ctk.CTkFont(size=11, weight="bold"), text_color="#1f538d")
        self.ops_title.pack(anchor="w", padx=10, pady=(8, 2))
        
        self.start_url_lbl = ctk.CTkLabel(self.ops_box, text="URL khởi đầu:", font=ctk.CTkFont(size=10))
        self.start_url_lbl.pack(anchor="w", padx=10, pady=(4, 0))

        self.start_url_entry = ctk.CTkEntry(
            self.ops_box, 
            height=28,
            placeholder_text="https://www.bioxbio.com/journal/"
        )
        self.start_url_entry.insert(0, "https://www.bioxbio.com/journal/")
        self.start_url_entry.pack(fill="x", padx=10, pady=2)
        
        self.delay_lbl = ctk.CTkLabel(self.ops_box, text="Khoảng nghỉ (giây):", font=ctk.CTkFont(size=10))
        self.delay_lbl.pack(anchor="w", padx=10, pady=(4, 0))

        self.delay_entry = ctk.CTkEntry(
            self.ops_box, 
            height=28,
            placeholder_text="1.5"
        )
        self.delay_entry.insert(0, "1.5")
        self.delay_entry.pack(fill="x", padx=10, pady=2)

        self.download_btn = ctk.CTkButton(
            self.ops_box, 
            text="🚀 Bắt đầu cào (Selenium)", 
            height=30,
            fg_color="#1f538d", 
            hover_color="#143d66",
            font=ctk.CTkFont(weight="bold"),
            command=self.start_crawling
        )
        self.download_btn.pack(fill="x", padx=10, pady=(10, 4))

        self.stop_btn = ctk.CTkButton(
            self.ops_box, 
            text="🛑 Dừng cào", 
            height=30,
            fg_color="#e74c3c", 
            hover_color="#c0392b",
            font=ctk.CTkFont(weight="bold"),
            command=self.stop_crawling,
            state="disabled"
        )
        self.stop_btn.pack(fill="x", padx=10, pady=(2, 8))

        # DB Statistics Box
        self.stats_box = ctk.CTkFrame(self.sidebar, fg_color="#1e2122", corner_radius=8)
        self.stats_box.grid(row=3, column=0, padx=15, pady=10, sticky="ew")

        self.stats_title = ctk.CTkLabel(self.stats_box, text="THÔNG TIN CƠ SỞ DỮ LIỆU", font=ctk.CTkFont(size=11, weight="bold"), text_color="#2ecc71")
        self.stats_title.pack(anchor="w", padx=10, pady=(8, 2))

        self.stat_journals_lbl = ctk.CTkLabel(self.stats_box, text="Tạp chí: 0", font=ctk.CTkFont(size=11))
        self.stat_journals_lbl.pack(anchor="w", padx=10, pady=2)

        self.stat_issns_lbl = ctk.CTkLabel(self.stats_box, text="Số ISSN: 0", font=ctk.CTkFont(size=11))
        self.stat_issns_lbl.pack(anchor="w", padx=10, pady=2)

        self.stat_rankings_lbl = ctk.CTkLabel(self.stats_box, text="Lịch sử IF: 0 dòng", font=ctk.CTkFont(size=11))
        self.stat_rankings_lbl.pack(anchor="w", padx=10, pady=(2, 8))

    def create_main_panel(self):
        self.main_panel = ctk.CTkFrame(self, fg_color="transparent")
        self.main_panel.grid(row=0, column=1, sticky="nsew", padx=10, pady=10)
        self.main_panel.grid_rowconfigure(0, weight=1)
        self.main_panel.grid_columnconfigure(0, weight=1)

        # Tabview
        self.tabview = ctk.CTkTabview(self.main_panel)
        self.tabview.grid(row=0, column=0, sticky="nsew")

        self.tab_browser = self.tabview.add("Trình Duyệt Dữ Liệu")
        self.tab_logs = self.tabview.add("Nhật ký (Logs)")

        self.setup_browser_tab()
        self.setup_logs_tab()

    def setup_browser_tab(self):
        self.tab_browser.grid_rowconfigure(1, weight=1)
        self.tab_browser.grid_columnconfigure(0, weight=1)

        # 1. Filter bar
        self.filter_bar = ctk.CTkFrame(self.tab_browser, height=50)
        self.filter_bar.grid(row=0, column=0, sticky="ew", padx=5, pady=5)
        
        self.search_lbl = ctk.CTkLabel(self.filter_bar, text="Tìm kiếm:")
        self.search_lbl.grid(row=0, column=0, padx=(15, 5), pady=10, sticky="w")

        self.search_entry = ctk.CTkEntry(
            self.filter_bar, 
            width=280, 
            placeholder_text="Tìm theo tên Tạp chí hoặc ISSN..."
        )
        self.search_entry.grid(row=0, column=1, padx=5, pady=10, sticky="w")
        self.search_entry.bind("<KeyRelease>", lambda e: self.search_db())

        # Year dropdown
        self.year_lbl = ctk.CTkLabel(self.filter_bar, text="Năm:")
        self.year_lbl.grid(row=0, column=2, padx=(15, 2), pady=10, sticky="w")
        
        self.year_filter = ctk.CTkOptionMenu(
            self.filter_bar, 
            width=90, 
            values=["-"],
            command=lambda val: self.search_db()
        )
        self.year_filter.grid(row=0, column=3, padx=(5, 15), pady=10, sticky="w")

        # 2. Split Treeview & Details
        self.data_layout = ctk.CTkFrame(self.tab_browser, fg_color="transparent")
        self.data_layout.grid(row=1, column=0, sticky="nsew", padx=5, pady=5)
        self.data_layout.grid_rowconfigure(0, weight=1)
        self.data_layout.grid_columnconfigure(0, weight=4)  # Treeview gets 4/5
        self.data_layout.grid_columnconfigure(1, weight=1)  # Details get 1/5

        # 3. Treeview Table Container
        self.tree_container = ctk.CTkFrame(self.data_layout, corner_radius=8)
        self.tree_container.grid(row=0, column=0, sticky="nsew", padx=(0, 5))
        self.tree_container.grid_rowconfigure(0, weight=1)
        self.tree_container.grid_columnconfigure(0, weight=1)

        style = ttk.Style()
        style.theme_use("clam")
        style.configure("Treeview",
                        background="#2a2d2e",
                        foreground="#eaeaea",
                        rowheight=28,
                        fieldbackground="#2a2d2e",
                        gridcolor="#383b3c",
                        font=("Arial", 10),
                        borderwidth=0)
        style.map('Treeview', background=[('selected', '#1f538d')])
        style.configure("Treeview.Heading",
                        background="#1f2122",
                        foreground="white",
                        relief="flat",
                        font=("Arial", 10, "bold"))
        style.map("Treeview.Heading", background=[('active', '#2d3031')])

        columns = ("SourceID", "Title", "ISSN", "LatestYear", "ImpactFactor", "Articles", "Cites")
        self.tree = ttk.Treeview(self.tree_container, columns=columns, show="headings", selectmode="browse")
        
        self.tree.heading("SourceID", text="ID", anchor="center")
        self.tree.heading("Title", text="Tên Tạp chí (BioxBio)", anchor="w")
        self.tree.heading("ISSN", text="ISSN", anchor="center")
        self.tree.heading("LatestYear", text="Năm", anchor="center")
        self.tree.heading("ImpactFactor", text="IF Score", anchor="center")
        self.tree.heading("Articles", text="Số Bài", anchor="center")
        self.tree.heading("Cites", text="Số Trích Dẫn", anchor="center")

        self.tree.column("SourceID", width=60, minwidth=50, anchor="center")
        self.tree.column("Title", width=340, minwidth=200, anchor="w")
        self.tree.column("ISSN", width=90, minwidth=80, anchor="center")
        self.tree.column("LatestYear", width=65, minwidth=50, anchor="center")
        self.tree.column("ImpactFactor", width=85, minwidth=70, anchor="center")
        self.tree.column("Articles", width=70, minwidth=60, anchor="center")
        self.tree.column("Cites", width=95, minwidth=80, anchor="center")

        self.scrollbar = ctk.CTkScrollbar(self.tree_container, command=self.tree.yview)
        self.tree.configure(yscrollcommand=self.scrollbar.set)
        
        self.tree.grid(row=0, column=0, sticky="nsew", padx=(5, 0), pady=5)
        self.scrollbar.grid(row=0, column=1, sticky="ns", padx=(0, 5), pady=5)

        self.tree.bind("<<TreeviewSelect>>", self.on_journal_selected)

        # 4. Detail Panel Container
        self.detail_container = ctk.CTkFrame(self.data_layout, corner_radius=8, fg_color="#1e2122")
        self.detail_container.grid(row=0, column=1, sticky="nsew", padx=(5, 0))
        self.detail_container.grid_rowconfigure(3, weight=1)

        self.detail_lbl = ctk.CTkLabel(self.detail_container, text="CHI TIẾT TẠP CHÍ", font=ctk.CTkFont(size=12, weight="bold"), text_color="#1f538d")
        self.detail_lbl.grid(row=0, column=0, padx=15, pady=(10, 5), sticky="w")

        self.info_text = tk.Text(self.detail_container, height=6, bg="#1e2122", fg="#eaeaea", bd=0, wrap="word", font=("Arial", 10))
        self.info_text.grid(row=1, column=0, padx=15, pady=5, sticky="ew")
        self.info_text.insert("1.0", "Hãy chọn một tạp chí để xem lịch sử điểm IF.")
        self.info_text.configure(state="disabled")

        self.history_title = ctk.CTkLabel(self.detail_container, text="Lịch sử Impact Factor:", font=ctk.CTkFont(size=11, weight="bold"))
        self.history_title.grid(row=2, column=0, padx=15, pady=(10, 2), sticky="w")

        hist_columns = ("Year", "IF", "Cites")
        self.hist_tree = ttk.Treeview(self.detail_container, columns=hist_columns, show="headings", height=8)
        self.hist_tree.heading("Year", text="Năm", anchor="center")
        self.hist_tree.heading("IF", text="Impact Factor", anchor="center")
        self.hist_tree.heading("Cites", text="Trích Dẫn", anchor="center")
        
        self.hist_tree.column("Year", width=60, anchor="center")
        self.hist_tree.column("IF", width=95, anchor="center")
        self.hist_tree.column("Cites", width=80, anchor="center")

        self.hist_tree.grid(row=3, column=0, padx=15, pady=(0, 15), sticky="nsew")

    def setup_logs_tab(self):
        self.tab_logs.grid_rowconfigure(2, weight=1)
        self.tab_logs.grid_columnconfigure(0, weight=1)
        self.tab_logs.grid_columnconfigure(1, weight=1)

        self.progress_panel = ctk.CTkFrame(self.tab_logs, height=100)
        self.progress_panel.grid(row=0, column=0, columnspan=2, sticky="ew", padx=5, pady=5)
        
        self.status_title_lbl = ctk.CTkLabel(self.progress_panel, text="TIẾN TRÌNH CÀO DỮ LIỆU", font=ctk.CTkFont(size=12, weight="bold"))
        self.status_title_lbl.pack(anchor="w", padx=15, pady=(10, 2))

        self.status_desc_lbl = ctk.CTkLabel(self.progress_panel, text="Trạng thái: Sẵn sàng", text_color="#2ecc71", font=ctk.CTkFont(size=13, weight="bold"))
        self.status_desc_lbl.pack(anchor="w", padx=15, pady=2)

        self.progress_bar = ctk.CTkProgressBar(self.progress_panel, width=500)
        self.progress_bar.pack(anchor="w", padx=15, pady=(5, 10))
        self.progress_bar.set(0)

        # Console Logs Area (Left side)
        self.logs_container = ctk.CTkFrame(self.tab_logs)
        self.logs_container.grid(row=2, column=0, sticky="nsew", padx=(5, 5), pady=5)
        self.logs_container.grid_rowconfigure(1, weight=1)
        self.logs_container.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(self.logs_container, text="NHẬT KÝ CHI TIẾT (CONSOLE LOG)", font=ctk.CTkFont(size=12, weight="bold")).grid(row=0, column=0, padx=15, pady=(10, 5), sticky="w")
        
        self.log_textbox = ctk.CTkTextbox(self.logs_container, wrap="word", font=("Courier", 10))
        self.log_textbox.grid(row=1, column=0, sticky="nsew", padx=15, pady=(0, 15))
        self.log_textbox.configure(state="disabled")

        # Crawling Status stats (Right side)
        self.dl_status_container = ctk.CTkFrame(self.tab_logs)
        self.dl_status_container.grid(row=2, column=1, sticky="nsew", padx=(5, 5), pady=5)
        self.dl_status_container.grid_rowconfigure(1, weight=1)
        self.dl_status_container.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(self.dl_status_container, text="THÔNG TIN TIẾN TRÌNH CÀO", font=ctk.CTkFont(size=12, weight="bold")).grid(row=0, column=0, padx=15, pady=(10, 5), sticky="w")

        self.crawled_scroll_frame = ctk.CTkScrollableFrame(self.dl_status_container, fg_color="transparent")
        self.crawled_scroll_frame.grid(row=1, column=0, sticky="nsew", padx=15, pady=(0, 15))
        
        self.page_status_lbl = ctk.CTkLabel(self.crawled_scroll_frame, text="Chưa bắt đầu cào.", justify="left", anchor="w")
        self.page_status_lbl.pack(fill="x", padx=5, pady=5)

    def crawler_callback(self, action, data):
        self.msg_queue.put((action, data))

    def process_queues(self):
        # 1. Process stdout
        while not self.console_queue.q.empty():
            text = self.console_queue.q.get()
            self.log_textbox.configure(state="normal")
            self.log_textbox.insert("end", text)
            self.log_textbox.see("end")
            self.log_textbox.configure(state="disabled")

        # 2. Process status messages
        try:
            while True:
                action, data = self.msg_queue.get_nowait()
                if action == "status":
                    self.status_desc_lbl.configure(text=data, text_color="#f1c40f")
                    
                elif action == "crawl_start":
                    self.is_running = True
                    self.status_desc_lbl.configure(text=data["msg"], text_color="#f1c40f")
                    self.progress_bar.set(0.05)
                    self.download_btn.configure(state="disabled")
                    self.stop_btn.configure(state="normal")
                    self.page_status_lbl.configure(text="Đang kết nối tới BioxBio...")
                    
                elif action == "crawl_browser_opened":
                    self.status_desc_lbl.configure(text=data["msg"], text_color="#f1c40f")
                    
                elif action == "crawl_page_start":
                    msg = f"Đang quét trang {data['page']}..."
                    self.status_desc_lbl.configure(text=msg, text_color="#f1c40f")
                    self.page_status_lbl.configure(text=f"Đang quét trang danh sách {data['page']}...")
                    
                elif action == "crawl_detail_start":
                    msg = f"Trang {data['page']}: Đang cào [{data['idx']}/{data['total']}] {data['title']}"
                    self.status_desc_lbl.configure(text=msg, text_color="#f1c40f")
                    self.page_status_lbl.configure(text=msg)
                    
                elif action == "crawl_page_success":
                    self.update_db_stats()
                    status_text = f"Đã cào xong trang {data['page']}. \nThêm được {data['scraped_in_page']} tạp chí. \nTổng cộng đã cào: {data['total_scraped']} tạp chí."
                    self.page_status_lbl.configure(text=status_text)
                    self.refresh_year_dropdown()
                    
                elif action == "crawl_page_empty":
                    self.page_status_lbl.configure(text=data["msg"], text_color="#e74c3c")
                    
                elif action == "crawl_fail":
                    self.is_running = False
                    self.status_desc_lbl.configure(text=f"Lỗi: {data['error']}", text_color="#e74c3c")
                    self.progress_bar.set(0)
                    self.download_btn.configure(state="normal")
                    self.stop_btn.configure(state="disabled")
                    messagebox.showerror("Lỗi", f"Quá trình cào thất bại:\n{data['error']}")
                    self.update_db_stats()
                    
                elif action == "crawl_end":
                    self.is_running = False
                    self.status_desc_lbl.configure(text=data["msg"], text_color="#2ecc71")
                    self.progress_bar.set(1.0)
                    self.download_btn.configure(state="normal")
                    self.stop_btn.configure(state="disabled")
                    self.update_db_stats()
                    self.refresh_year_dropdown()
                    self.search_db()
                    
        except queue.Empty:
            pass

        self.after(100, self.process_queues)

    def start_crawling(self):
        if self.is_running:
            return
            
        start_url = self.start_url_entry.get().strip()
        if not start_url:
            messagebox.showwarning("Cảnh báo", "Vui lòng nhập URL khởi đầu.")
            return

        try:
            delay = float(self.delay_entry.get().strip())
        except ValueError:
            messagebox.showwarning("Cảnh báo", "Khoảng nghỉ phải là số giây hợp lệ (Ví dụ: 1.5).")
            return

        self.tabview.set("Nhật ký (Logs)")
        self.stop_event.clear()
        
        self.crawler_thread = threading.Thread(
            target=crawl_bioxbio_deep,
            args=(start_url, self.db_file_path, delay, self.crawler_callback, self.stop_event),
            daemon=True
        )
        self.crawler_thread.start()

    def stop_crawling(self):
        if not self.is_running:
            return
        self.status_desc_lbl.configure(text="Đang gửi yêu cầu dừng cào...", text_color="#e67e22")
        self.stop_event.set()

    def update_db_stats(self):
        """Query SQLite database statistics and update UI labels."""
        if not os.path.exists(self.db_file_path):
            return

        conn = sqlite3.connect(self.db_file_path)
        cursor = conn.cursor()
        try:
            journals_count = cursor.execute("SELECT count(*) FROM journals").fetchone()[0]
            issns_count = cursor.execute("SELECT count(*) FROM issns").fetchone()[0]
            rankings_count = cursor.execute("SELECT count(*) FROM rankings").fetchone()[0]
            
            self.stat_journals_lbl.configure(text=f"Tạp chí: {journals_count:,}")
            self.stat_issns_lbl.configure(text=f"Số ISSN: {issns_count:,}")
            self.stat_rankings_lbl.configure(text=f"Lịch sử IF: {rankings_count:,} dòng")
        except Exception as e:
            print(f"Error updating stats: {e}")
        finally:
            conn.close()

    def refresh_year_dropdown(self):
        """Get list of available years in database and update dropdown filter."""
        if not os.path.exists(self.db_file_path):
            return

        conn = sqlite3.connect(self.db_file_path)
        cursor = conn.cursor()
        years = ["-"]
        try:
            rows = cursor.execute("SELECT DISTINCT year FROM rankings ORDER BY year DESC").fetchall()
            for r in rows:
                years.append(str(r[0]))
        except Exception as e:
            print(f"Error fetching dropdown years: {e}")
        finally:
            conn.close()

        # Save current selected year
        current_sel = self.year_filter.get()
        self.year_filter.configure(values=years)
        if current_sel in years:
            self.year_filter.set(current_sel)
        else:
            self.year_filter.set("-")

    def search_db(self):
        """Queries the SQLite database based on filter inputs and updates the treeview."""
        if not os.path.exists(self.db_file_path):
            return

        # Clear existing items
        for item in self.tree.get_children():
            self.tree.delete(item)

        search_query = self.search_entry.get().strip()
        selected_year = self.year_filter.get()

        conn = sqlite3.connect(self.db_file_path)
        cursor = conn.cursor()
        
        try:
            query = """
                SELECT j.source_id, j.title, GROUP_CONCAT(i.issn, ', ') as issn_list,
                       r.year, r.impact_factor, r.total_articles, r.total_cites
                FROM journals j
                LEFT JOIN issns i ON j.source_id = i.source_id
                LEFT JOIN rankings r ON j.source_id = r.source_id
            """
            
            conditions = []
            params = []
            
            # Handle search keyword (title or ISSN)
            if search_query:
                conditions.append("(j.title LIKE ? OR i.issn LIKE ?)")
                params.append(f"%{search_query}%")
                params.append(f"%{search_query}%")
                
            # Handle year filter
            if selected_year and selected_year != "-":
                conditions.append("r.year = ?")
                params.append(int(selected_year))
                
            if conditions:
                query += " WHERE " + " AND ".join(conditions)
                
            query += " GROUP BY j.source_id"
            
            # If no year is filtered, show the latest rank year
            if selected_year == "-":
                # Find the maximum year for each journal
                query = f"""
                    SELECT t.source_id, t.title, t.issn_list, t.year, t.impact_factor, t.total_articles, t.total_cites
                    FROM ({query}) t
                    INNER JOIN (
                        SELECT source_id, MAX(year) as max_year 
                        FROM rankings 
                        GROUP BY source_id
                    ) ym ON t.source_id = ym.source_id AND (t.year = ym.max_year OR t.year IS NULL)
                """
                
            query += " ORDER BY t.impact_factor DESC, t.title ASC LIMIT 500" if selected_year == "-" else " ORDER BY r.impact_factor DESC, j.title ASC LIMIT 500"
            
            cursor.execute(query, params)
            rows = cursor.fetchall()
            
            for idx, row in enumerate(rows):
                sid, title, issn, year, val_if, art, cites = row
                
                # Format variables
                issn_display = issn if issn else "N/A"
                year_display = str(year) if year else "-"
                if_display = f"{val_if:.3f}" if val_if is not None else "-"
                art_display = f"{art:,}" if art else "-"
                cites_display = f"{cites:,}" if cites else "-"
                
                self.tree.insert(
                    "", 
                    "end", 
                    iid=str(idx), 
                    values=(sid, title, issn_display, year_display, if_display, art_display, cites_display)
                )
        except Exception as e:
            print(f"Error querying search database: {e}")
        finally:
            conn.close()

    def on_journal_selected(self, event):
        """Fires when a row in the journal list is selected; updates detail panels."""
        selected_items = self.tree.selection()
        if not selected_items:
            return
            
        idx = selected_items[0]
        values = self.tree.item(idx)['values']
        source_id = values[0]
        title = values[1]
        issn_list = values[2]
        
        # 1. Update text info box
        self.info_text.configure(state="normal")
        self.info_text.delete("1.0", "end")
        self.info_text.insert("1.0", f"📌 Tên Tạp chí:\n{title}\n\n")
        self.info_text.insert("end", f"🔑 ISSN: {issn_list}\n")
        self.info_text.insert("end", f"🆔 Source ID: {source_id}\n")
        self.info_text.configure(state="disabled")

        # 2. Fetch history from DB and update history table
        for item in self.hist_tree.get_children():
            self.hist_tree.delete(item)

        conn = sqlite3.connect(self.db_file_path)
        cursor = conn.cursor()
        try:
            cursor.execute('''
                SELECT year, impact_factor, total_cites 
                FROM rankings 
                WHERE source_id = ? 
                ORDER BY year DESC
            ''', (source_id,))
            rows = cursor.fetchall()
            for r in rows:
                yr, val_if, cites = r
                if_disp = f"{val_if:.3f}" if val_if is not None else "-"
                cite_disp = f"{cites:,}" if cites else "-"
                self.hist_tree.insert("", "end", values=(yr, if_disp, cite_disp))
        except Exception as e:
            print(f"Error fetching history: {e}")
        finally:
            conn.close()

if __name__ == "__main__":
    app = BioxBioCrawlerApp()
    app.mainloop()
