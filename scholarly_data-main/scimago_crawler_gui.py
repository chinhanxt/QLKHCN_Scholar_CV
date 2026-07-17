import os
import sys
import time
import glob
import sqlite3
import re
import queue
import threading
import tkinter as tk
from tkinter import ttk, messagebox
import customtkinter as ctk
import pandas as pd

# Import backend modules
from scimago_crawler import crawl_years, build_database, init_db, normalize_title
from scimago_db_matcher import SCImagoDBMatcher

ctk.set_appearance_mode("Dark")
ctk.set_default_color_theme("blue")

def parse_years_input(input_str):
    """Parses ranges like 1999-2005 or lists like 2024, 2025, 2026 into a list of integers."""
    years = []
    parts = re.split(r'[,;\s]+', input_str)
    for part in parts:
        part = part.strip()
        if not part:
            continue
        if '-' in part:
            subparts = part.split('-')
            if len(subparts) == 2:
                try:
                    start = int(subparts[0].strip())
                    end = int(subparts[1].strip())
                    years.extend(range(min(start, end), max(start, end) + 1))
                except ValueError:
                    pass
        else:
            try:
                years.append(int(part))
            except ValueError:
                pass
    return sorted(list(set(years)))

class ThreadSafeConsoleQueue:
    """Queue to collect stdout prints from background thread and send to GUI."""
    def __init__(self):
        self.q = queue.Queue()

    def write(self, text):
        self.q.put(text)

    def flush(self):
        pass

class SCImagoCrawlerApp(ctk.CTk):
    def __init__(self):
        super().__init__()

        self.title("SCImago Journal Rank (SJR) - Database Manager")
        self.geometry("1200x750")
        
        # Configure paths
        self.script_dir = os.path.dirname(os.path.abspath(__file__))
        self.download_folder = os.path.join(self.script_dir, "scimagojr_downloads")
        self.db_file_path = os.path.join(self.script_dir, "scimagojr_all.db")
        os.makedirs(self.download_folder, exist_ok=True)

        self.matcher = SCImagoDBMatcher(self.db_file_path)
        
        # Background task queue & variables
        self.msg_queue = queue.Queue()
        self.console_queue = ThreadSafeConsoleQueue()
        
        # Save original stdout
        self.old_stdout = sys.stdout
        sys.stdout = self.console_queue

        self.crawler_thread = None
        self.is_running = False

        # GUI Layout Config
        self.grid_columnconfigure(1, weight=1)
        self.grid_rowconfigure(0, weight=1)

        # Create Sidebar
        self.create_sidebar()

        # Create Main Panel with Tabs
        self.create_main_panel()

        # Load initial statistics
        self.update_db_stats()
        self.refresh_downloads_list()
        self.refresh_year_dropdown()
        self.search_db()

        # Start periodic GUI updates
        self.after(100, self.process_queues)

    def create_sidebar(self):
        # Narrower sidebar to leave 80% room for main list
        self.sidebar = ctk.CTkFrame(self, width=240, corner_radius=0)
        self.sidebar.grid(row=0, column=0, sticky="nsew", padx=0, pady=0)
        self.sidebar.grid_rowconfigure(4, weight=1)  # spacer

        # Brand Title
        self.app_title = ctk.CTkLabel(
            self.sidebar, 
            text="SJR CRAWLER & DB", 
            font=ctk.CTkFont(size=16, weight="bold"),
            text_color="#1f538d"
        )
        self.app_title.grid(row=0, column=0, padx=15, pady=(15, 5), sticky="w")
        
        # Divider
        self.divider = ctk.CTkFrame(self.sidebar, height=2, fg_color="#34495e")
        self.divider.grid(row=1, column=0, padx=15, pady=5, sticky="ew")

        # Compact Operations Box (Square Box)
        self.ops_box = ctk.CTkFrame(self.sidebar, fg_color="#1e2122", corner_radius=8)
        self.ops_box.grid(row=2, column=0, padx=15, pady=10, sticky="ew")
        
        self.ops_title = ctk.CTkLabel(self.ops_box, text="CẬP NHẬT DỮ LIỆU", font=ctk.CTkFont(size=11, weight="bold"), text_color="#1f538d")
        self.ops_title.pack(anchor="w", padx=10, pady=(8, 2))
        
        self.year_input_entry = ctk.CTkEntry(
            self.ops_box, 
            height=28,
            placeholder_text="Nhập năm (VD: 2026)"
        )
        self.year_input_entry.pack(fill="x", padx=10, pady=5)
        self.year_input_entry.bind("<KeyRelease>", lambda e: self.refresh_downloads_list())
        
        self.download_btn = ctk.CTkButton(
            self.ops_box, 
            text="Tải về (Cào)", 
            height=28,
            fg_color="#1f538d", 
            hover_color="#143d66",
            font=ctk.CTkFont(weight="bold"),
            command=self.start_crawling
        )
        self.download_btn.pack(fill="x", padx=10, pady=4)

        self.update_db_btn = ctk.CTkButton(
            self.ops_box, 
            text="Cập nhật DB", 
            height=28,
            fg_color="#2ecc71", 
            hover_color="#27ae60",
            text_color="black",
            font=ctk.CTkFont(weight="bold"),
            command=self.start_db_build
        )
        self.update_db_btn.pack(fill="x", padx=10, pady=(4, 10))

        # Database Stats Panel (gridded below)
        self.stats_frame = ctk.CTkFrame(self.sidebar, fg_color="#1e2122", corner_radius=8)
        self.stats_frame.grid(row=3, column=0, padx=15, pady=5, sticky="ew")
        
        self.stats_title = ctk.CTkLabel(self.stats_frame, text="THỐNG KÊ DATABASE", font=ctk.CTkFont(size=10, weight="bold"), text_color="#95a5a6")
        self.stats_title.pack(anchor="w", padx=10, pady=(8, 4))
        
        self.journals_stat_lbl = ctk.CTkLabel(self.stats_frame, text="Tạp chí: 0", font=ctk.CTkFont(size=11))
        self.journals_stat_lbl.pack(anchor="w", padx=15, pady=2)
        
        self.issns_stat_lbl = ctk.CTkLabel(self.stats_frame, text="Mã ISSN: 0", font=ctk.CTkFont(size=11))
        self.issns_stat_lbl.pack(anchor="w", padx=15, pady=2)
        
        self.rankings_stat_lbl = ctk.CTkLabel(self.stats_frame, text="Lịch sử phân hạng: 0", font=ctk.CTkFont(size=11))
        self.rankings_stat_lbl.pack(anchor="w", padx=15, pady=(2, 10))
        # Spacer row configure
        self.sidebar.grid_rowconfigure(4, weight=1)

    def create_main_panel(self):
        self.main_tabview = ctk.CTkTabview(self)
        self.main_tabview.grid(row=0, column=1, sticky="nsew", padx=10, pady=(10, 10))

        # Add tabs
        self.tab_browser = self.main_tabview.add("Trình duyệt dữ liệu DB")
        self.tab_logs = self.main_tabview.add("Nhật ký & Tiến trình")

        self.setup_browser_tab()
        self.setup_logs_tab()

    def setup_browser_tab(self):
        # Configure layout inside tab
        self.tab_browser.grid_rowconfigure(1, weight=1)
        self.tab_browser.grid_columnconfigure(0, weight=1)

        # 1. Filter Top Bar
        self.filter_bar = ctk.CTkFrame(self.tab_browser, height=60, fg_color="transparent")
        self.filter_bar.grid(row=0, column=0, sticky="ew", padx=5, pady=5)
        
        # Search Box
        self.search_entry = ctk.CTkEntry(self.filter_bar, width=320, placeholder_text="Nhập tên tạp chí hoặc mã ISSN...")
        self.search_entry.grid(row=0, column=0, padx=(5, 10), pady=10, sticky="w")
        self.search_entry.bind("<Return>", lambda e: self.search_db())
        self.search_entry.bind("<KeyRelease>", lambda e: self.search_db())

        # Year dropdown
        self.year_lbl = ctk.CTkLabel(self.filter_bar, text="Năm:")
        self.year_lbl.grid(row=0, column=1, padx=2, pady=10, sticky="w")
        
        self.year_filter = ctk.CTkOptionMenu(
            self.filter_bar, 
            width=90, 
            values=["-"],
            command=lambda val: self.search_db()
        )
        self.year_filter.grid(row=0, column=2, padx=(5, 15), pady=10, sticky="w")

        # Quartile dropdown
        self.q_lbl = ctk.CTkLabel(self.filter_bar, text="Hạng:")
        self.q_lbl.grid(row=0, column=3, padx=2, pady=10, sticky="w")
        
        self.quartile_filter = ctk.CTkOptionMenu(
            self.filter_bar, 
            width=90, 
            values=["Q1", "Q2", "Q3", "Q4", "-"],
            command=lambda val: self.search_db()
        )
        self.quartile_filter.grid(row=0, column=4, padx=(5, 15), pady=10, sticky="w")

        # 2. Main data display grid (Split Treeview & Details)
        self.data_layout = ctk.CTkFrame(self.tab_browser, fg_color="transparent")
        self.data_layout.grid(row=1, column=0, sticky="nsew", padx=5, pady=5)
        self.data_layout.grid_rowconfigure(0, weight=1)
        self.data_layout.grid_columnconfigure(0, weight=4) # Treeview gets 4/5
        self.data_layout.grid_columnconfigure(1, weight=1) # Detail gets 1/5

        # 3. Treeview Table Container
        self.tree_container = ctk.CTkFrame(self.data_layout, corner_radius=8)
        self.tree_container.grid(row=0, column=0, sticky="nsew", padx=(0, 5))
        self.tree_container.grid_rowconfigure(0, weight=1)
        self.tree_container.grid_columnconfigure(0, weight=1)

        # Style Treeview
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

        columns = ("SourceID", "Title", "Quartile", "SJR", "HIndex", "Type", "Country")
        self.tree = ttk.Treeview(self.tree_container, columns=columns, show="headings", selectmode="browse")
        
        # Set headings
        self.tree.heading("SourceID", text="ID", anchor="center")
        self.tree.heading("Title", text="Tên Tạp chí (SJR)", anchor="w")
        self.tree.heading("Quartile", text="Quartile", anchor="center")
        self.tree.heading("SJR", text="Điểm SJR", anchor="center")
        self.tree.heading("HIndex", text="H-Index", anchor="center")
        self.tree.heading("Type", text="Loại", anchor="center")
        self.tree.heading("Country", text="Quốc gia", anchor="w")

        # Set column widths
        self.tree.column("SourceID", width=65, minwidth=50, anchor="center")
        self.tree.column("Title", width=340, minwidth=200, anchor="w")
        self.tree.column("Quartile", width=75, minwidth=60, anchor="center")
        self.tree.column("SJR", width=85, minwidth=70, anchor="center")
        self.tree.column("HIndex", width=65, minwidth=55, anchor="center")
        self.tree.column("Type", width=80, minwidth=70, anchor="center")
        self.tree.column("Country", width=110, minwidth=90, anchor="w")

        # Add tags for cell/row highlighting based on SJR Quartile
        self.tree.tag_configure('Q1', background='#163020', foreground='#2ecc71')
        self.tree.tag_configure('Q2', background='#3a3010', foreground='#ffd166')
        self.tree.tag_configure('Q3', background='#3a2010', foreground='#f3722c')
        self.tree.tag_configure('Q4', background='#3a1010', foreground='#f94144')
        self.tree.tag_configure('other', background='#2a2d2e', foreground='#eaeaea')

        # Scrollbar
        self.scrollbar = ctk.CTkScrollbar(self.tree_container, command=self.tree.yview)
        self.tree.configure(yscrollcommand=self.scrollbar.set)
        
        self.tree.grid(row=0, column=0, sticky="nsew", padx=(5, 0), pady=5)
        self.scrollbar.grid(row=0, column=1, sticky="ns", padx=(0, 5), pady=5)

        self.tree.bind("<<TreeviewSelect>>", self.on_journal_selected)

        # 4. Detail Panel Container
        self.detail_container = ctk.CTkFrame(self.data_layout, corner_radius=8, fg_color="#1e2122")
        self.detail_container.grid(row=0, column=1, sticky="nsew", padx=(5, 0))
        self.detail_container.grid_rowconfigure(3, weight=1) # History table gets remaining space

        self.detail_lbl = ctk.CTkLabel(self.detail_container, text="CHI TIẾT TẠP CHÍ", font=ctk.CTkFont(size=12, weight="bold"), text_color="#1f538d")
        self.detail_lbl.grid(row=0, column=0, padx=15, pady=(10, 5), sticky="w")

        # Info Box (Text wrapper)
        self.info_text = tk.Text(self.detail_container, height=6, bg="#1e2122", fg="#eaeaea", bd=0, wrap="word", font=("Arial", 10))
        self.info_text.grid(row=1, column=0, padx=15, pady=5, sticky="ew")
        self.info_text.insert("1.0", "Hãy chọn một tạp chí trong danh sách để xem chi tiết.")
        self.info_text.configure(state="disabled")

        # History list
        self.history_title = ctk.CTkLabel(self.detail_container, text="Lịch sử xếp hạng:", font=ctk.CTkFont(size=11, weight="bold"))
        self.history_title.grid(row=2, column=0, padx=15, pady=(10, 2), sticky="w")

        # Treeview for history
        hist_columns = ("Year", "Quartile", "SJR")
        self.hist_tree = ttk.Treeview(self.detail_container, columns=hist_columns, show="headings", height=8)
        self.hist_tree.heading("Year", text="Năm", anchor="center")
        self.hist_tree.heading("Quartile", text="Hạng", anchor="center")
        self.hist_tree.heading("SJR", text="SJR", anchor="center")
        
        self.hist_tree.column("Year", width=60, anchor="center")
        self.hist_tree.column("Quartile", width=65, anchor="center")
        self.hist_tree.column("SJR", width=80, anchor="center")

        # History tags
        self.hist_tree.tag_configure('Q1', background='#163020', foreground='#2ecc71')
        self.hist_tree.tag_configure('Q2', background='#3a3010', foreground='#ffd166')
        self.hist_tree.tag_configure('Q3', background='#3a2010', foreground='#f3722c')
        self.hist_tree.tag_configure('Q4', background='#3a1010', foreground='#f94144')
        self.hist_tree.tag_configure('other', background='#2a2d2e', foreground='#eaeaea')

        self.hist_tree.grid(row=3, column=0, padx=15, pady=(0, 15), sticky="nsew")

    def setup_logs_tab(self):
        # Configure layout inside logs tab
        self.tab_logs.grid_rowconfigure(2, weight=1)
        self.tab_logs.grid_columnconfigure(0, weight=1)
        self.tab_logs.grid_columnconfigure(1, weight=1)

        # 1. State / Current Action Display
        self.progress_panel = ctk.CTkFrame(self.tab_logs, height=100)
        self.progress_panel.grid(row=0, column=0, columnspan=2, sticky="ew", padx=5, pady=5)
        
        self.status_title_lbl = ctk.CTkLabel(self.progress_panel, text="TIẾN TRÌNH HIỆN TẠI", font=ctk.CTkFont(size=12, weight="bold"))
        self.status_title_lbl.pack(anchor="w", padx=15, pady=(10, 2))

        self.status_desc_lbl = ctk.CTkLabel(self.progress_panel, text="Trạng thái: Sẵn sàng", text_color="#2ecc71", font=ctk.CTkFont(size=13, weight="bold"))
        self.status_desc_lbl.pack(anchor="w", padx=15, pady=2)

        self.progress_bar = ctk.CTkProgressBar(self.progress_panel, width=500)
        self.progress_bar.pack(anchor="w", padx=15, pady=(5, 10))
        self.progress_bar.set(0)

        # 2. Main Logs Area (Left side)
        self.logs_container = ctk.CTkFrame(self.tab_logs)
        self.logs_container.grid(row=2, column=0, sticky="nsew", padx=(5, 5), pady=5)
        self.logs_container.grid_rowconfigure(1, weight=1)
        self.logs_container.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(self.logs_container, text="NHẬT KÝ CHI TIẾT (CONSOLE LOG)", font=ctk.CTkFont(size=12, weight="bold")).grid(row=0, column=0, padx=15, pady=(10, 5), sticky="w")
        
        self.log_textbox = ctk.CTkTextbox(self.logs_container, wrap="word", font=("Courier", 10))
        self.log_textbox.grid(row=1, column=0, sticky="nsew", padx=15, pady=(0, 15))
        self.log_textbox.configure(state="disabled")

        # 3. Downloads Status list (Right side)
        self.dl_status_container = ctk.CTkFrame(self.tab_logs)
        self.dl_status_container.grid(row=2, column=1, sticky="nsew", padx=(5, 5), pady=5)
        self.dl_status_container.grid_rowconfigure(1, weight=1)
        self.dl_status_container.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(self.dl_status_container, text="TRẠNG THÁI FILE THEO NĂM (DOWNLOADS)", font=ctk.CTkFont(size=12, weight="bold")).grid(row=0, column=0, padx=15, pady=(10, 5), sticky="w")

        # Scrollable Frame for files status
        self.files_scroll_frame = ctk.CTkScrollableFrame(self.dl_status_container, fg_color="transparent")
        self.files_scroll_frame.grid(row=1, column=0, sticky="nsew", padx=15, pady=(0, 15))
        
        self.year_rows = {}  # Keep track of UI widgets for each year

    # --- Worker Thread Callbacks ---
    def crawler_callback(self, action, data):
        """Processes crawler updates safely by pushing to queue."""
        self.msg_queue.put((action, data))

    def process_queues(self):
        """Processes messages from background thread and updates GUI (runs on main thread)."""
        # 1. Process stdout prints
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
                    start, end = data["start"], data["end"]
                    self.status_desc_lbl.configure(
                        text=f"Đang chạy cào dữ liệu từ năm {start} đến {end}...", 
                        text_color="#f1c40f"
                    )
                    self.progress_bar.set(0.05)
                    self.download_btn.configure(state="disabled")
                    self.update_db_btn.configure(state="disabled")
                    
                elif action == "crawl_browser_opened":
                    self.status_desc_lbl.configure(text=data["msg"], text_color="#f1c40f")
                    
                elif action == "crawl_year_start":
                    year = data["year"]
                    is_first = data["is_first"]
                    msg = f"Đang quét & tải năm {year}..."
                    if is_first:
                        msg += " (Chờ vượt Cloudflare nếu có)"
                    self.status_desc_lbl.configure(text=msg, text_color="#f1c40f")
                    self.update_year_row_status(year, "Đang tải...", "#f1c40f")
                    
                elif action == "crawl_wait_user":
                    self.status_desc_lbl.configure(text=data["msg"], text_color="#e74c3c")
                    
                elif action == "crawl_year_success":
                    year = data["year"]
                    self.update_year_row_status(year, "Hoàn thành", "#2ecc71")
                    self.refresh_downloads_list()
                    
                elif action == "crawl_year_skip":
                    year = data["year"]
                    self.update_year_row_status(year, "Đã có file (Skip)", "#3498db")
                    
                elif action == "crawl_year_timeout":
                    year = data["year"]
                    self.update_year_row_status(year, "Timeout / Không có dữ liệu", "#95a5a6")
                    
                elif action == "crawl_fail":
                    self.is_running = False
                    self.status_desc_lbl.configure(text=f"Lỗi: {data['error']}", text_color="#e74c3c")
                    self.progress_bar.set(0)
                    self.download_btn.configure(state="normal")
                    self.update_db_btn.configure(state="normal")
                    messagebox.showerror("Lỗi", f"Quá trình cào dữ liệu thất bại:\n{data['error']}")
                    
                elif action == "crawl_end":
                    self.is_running = False
                    self.status_desc_lbl.configure(text="Tải file thành công! Hãy nhấn Cập nhật Database.", text_color="#2ecc71")
                    self.progress_bar.set(1.0)
                    self.download_btn.configure(state="normal")
                    self.update_db_btn.configure(state="normal")
                    self.refresh_downloads_list()
                    messagebox.showinfo("Hoàn thành", "Đã tải xong toàn bộ các năm dữ liệu!")

                elif action == "db_build_start":
                    self.is_running = True
                    self.status_desc_lbl.configure(text="Đang ghi dữ liệu vào cơ sở dữ liệu SQLite...", text_color="#f1c40f")
                    self.progress_bar.set(0.1)
                    self.download_btn.configure(state="disabled")
                    self.update_db_btn.configure(state="disabled")

                elif action == "db_build_count":
                    self.total_db_files = data["total"]
                    self.processed_db_files = 0

                elif action == "parse_year_start":
                    year = data["year"]
                    self.status_desc_lbl.configure(text=f"Đang ghi chỉ mục (Parse) năm {year}...", text_color="#f1c40f")

                elif action == "parse_year_success":
                    year = data["year"]
                    self.processed_db_files += 1
                    pct = float(self.processed_db_files) / max(1, self.total_db_files)
                    self.progress_bar.set(pct)
                    self.update_db_stats()

                elif action == "db_build_success":
                    self.is_running = False
                    self.status_desc_lbl.configure(text="Cơ sở dữ liệu đã cập nhật thành công!", text_color="#2ecc71")
                    self.progress_bar.set(1.0)
                    self.download_btn.configure(state="normal")
                    self.update_db_btn.configure(state="normal")
                    
                    self.matcher = SCImagoDBMatcher(self.db_file_path) # Reload matcher
                    self.update_db_stats()
                    self.refresh_year_dropdown()
                    self.search_db()
                    
                    messagebox.showinfo("Thành công", "Đã cập nhật cơ sở dữ liệu SQLite thành công!")
                
                elif action == "db_build_fail":
                    self.is_running = False
                    self.status_desc_lbl.configure(text=f"Lỗi DB: {data['error']}", text_color="#e74c3c")
                    self.progress_bar.set(0)
                    self.download_btn.configure(state="normal")
                    self.update_db_btn.configure(state="normal")
                    messagebox.showerror("Lỗi", f"Tạo cơ sở dữ liệu thất bại:\n{data['error']}")
                    
        except queue.Empty:
            pass

        self.after(100, self.process_queues)

    # --- Action handlers ---
    def start_crawling(self):
        if self.is_running:
            return
            
        input_str = self.year_input_entry.get().strip()
        if not input_str:
            messagebox.showerror("Lỗi", "Vui lòng nhập năm cần cào! (Ví dụ: 2026 hoặc 2024, 2025)")
            return
            
        years = parse_years_input(input_str)
        if not years:
            messagebox.showerror("Lỗi", "Không tìm thấy năm hợp lệ trong ô nhập! Vui lòng nhập số nguyên (Ví dụ: 2026).")
            return

        self.refresh_downloads_list()
        
        # Run crawler in background thread with the list of years
        self.crawler_thread = threading.Thread(
            target=crawl_years,
            args=(years, self.download_folder, self.crawler_callback),
            daemon=True
        )
        self.crawler_thread.start()

    def start_db_build(self):
        if self.is_running:
            return

        # Run database builder in background thread
        self.crawler_thread = threading.Thread(
            target=build_database,
            args=(self.download_folder, self.db_file_path, self.crawler_callback),
            daemon=True
        )
        self.crawler_thread.start()

    # --- UI Helpers ---
    def update_db_stats(self):
        """Query SQLite counts and update Sidebar labels."""
        if not os.path.exists(self.db_file_path):
            return
            
        try:
            conn = sqlite3.connect(self.db_file_path)
            cursor = conn.cursor()
            
            cursor.execute("SELECT COUNT(*) FROM journals")
            j_count = cursor.fetchone()[0]
            
            cursor.execute("SELECT COUNT(*) FROM issns")
            i_count = cursor.fetchone()[0]
            
            cursor.execute("SELECT COUNT(*) FROM rankings")
            r_count = cursor.fetchone()[0]
            
            self.journals_stat_lbl.configure(text=f"Tạp chí: {j_count:,}")
            self.issns_stat_lbl.configure(text=f"Mã ISSN: {i_count:,}")
            self.rankings_stat_lbl.configure(text=f"Lịch sử xếp hạng: {r_count:,}")
            
            conn.close()
        except Exception:
            pass

    def refresh_downloads_list(self):
        """Scans folder and populates list showing which years are downloaded."""
        for widget in self.files_scroll_frame.winfo_children():
            widget.destroy()
            
        self.year_rows = {}
        
        # 1. Gather all years from scimagojr_downloads folder
        years_in_folder = set()
        csv_files = glob.glob(os.path.join(self.download_folder, "scimagojr *.csv"))
        for csv_file in csv_files:
            filename = os.path.basename(csv_file)
            match = re.search(r'scimagojr\s+(\d{4})\.csv', filename)
            if match:
                years_in_folder.add(int(match.group(1)))
                
        # 2. Gather years from input entry
        input_str = ""
        if hasattr(self, 'year_input_entry'):
            input_str = self.year_input_entry.get().strip()
        years_from_input = parse_years_input(input_str)
        
        # Combine and sort
        all_years = sorted(list(years_in_folder.union(years_from_input)))
        
        # If no years, default to 1999-2025 for display
        if not all_years:
            all_years = list(range(1999, 2026))
            
        for year in all_years:
            frame = ctk.CTkFrame(self.files_scroll_frame, fg_color="transparent")
            frame.pack(fill="x", padx=5, pady=2)
            
            expected_file = os.path.join(self.download_folder, f"scimagojr {year}.csv")
            
            lbl_year = ctk.CTkLabel(frame, text=f"Năm {year}:", font=ctk.CTkFont(weight="bold"), width=70, anchor="w")
            lbl_year.pack(side="left", padx=5)
            
            status_text = "Chưa tải"
            status_color = "#e74c3c"
            
            if os.path.exists(expected_file):
                size_mb = os.path.getsize(expected_file) / (1024 * 1024)
                if size_mb > 0:
                    status_text = f"Đã tải ({size_mb:.1f} MB)"
                    status_color = "#2ecc71"
                    
            lbl_status = ctk.CTkLabel(frame, text=status_text, text_color=status_color, font=ctk.CTkFont(size=11))
            lbl_status.pack(side="left", padx=5)
            
            self.year_rows[year] = lbl_status

    def update_year_row_status(self, year, status_text, color):
        """Dynamically update status description for a specific year in the scroll frame."""
        if year in self.year_rows:
            self.year_rows[year].configure(text=status_text, text_color=color)

    def refresh_year_dropdown(self):
        """Populate year filtering dropdown from DB rankings."""
        if not os.path.exists(self.db_file_path):
            values = ["-"]
        else:
            try:
                conn = sqlite3.connect(self.db_file_path)
                cursor = conn.cursor()
                cursor.execute("SELECT DISTINCT year FROM rankings ORDER BY year DESC")
                years = [str(r[0]) for r in cursor.fetchall()]
                conn.close()
                values = years if years else ["-"]
            except Exception as e:
                print("Error refreshing year dropdown:", e)
                values = ["-"]
                
        # Recreate the OptionMenu dynamically to prevent CTkOptionMenu render/update bugs
        self.year_filter.destroy()
        
        self.year_filter = ctk.CTkOptionMenu(
            self.filter_bar, 
            width=90, 
            values=values,
            command=lambda val: self.search_db()
        )
        self.year_filter.grid(row=0, column=2, padx=(5, 15), pady=10, sticky="w")
        self.year_filter.set(values[0])

    # --- DB Querying & Treeview Display ---
    def search_db(self):
        if not os.path.exists(self.db_file_path):
            return
            
        search_query = self.search_entry.get().strip()
        selected_year = self.year_filter.get()
        selected_quartile = self.quartile_filter.get()
        
        # Clear Treeview
        for item in self.tree.get_children():
            self.tree.delete(item)
            
        conn = sqlite3.connect(self.db_file_path)
        cursor = conn.cursor()
        
        sql = '''
            SELECT j.source_id, j.title, r.sjr_quartile, r.sjr_score, r.h_index, j.type, j.country 
            FROM journals j
        '''
        
        params = []
        where_clauses = []
        
        # Handle Year filter
        if selected_year and selected_year not in ("Tất cả", "-"):
            sql += ' JOIN rankings r ON j.source_id = r.source_id AND r.year = ?'
            params.append(int(selected_year))
        else:
            # Join with the latest year rank by default to show scores
            sql += '''
                LEFT JOIN rankings r ON j.source_id = r.source_id AND r.year = (
                    SELECT MAX(year) FROM rankings WHERE source_id = j.source_id
                )
            '''
            
        # Handle search keyword (Title or ISSN)
        if search_query:
            norm_search = normalize_title(search_query)
            clean_issn = search_query.replace("-", "").upper()
            
            where_clauses.append(
                '(j.title_normalized LIKE ? OR j.source_id IN (SELECT source_id FROM issns WHERE issn LIKE ?))'
            )
            params.append(f"%{norm_search}%")
            params.append(f"%{clean_issn}%")
            
        # Handle Quartile filter
        if selected_quartile != "Tất cả":
            where_clauses.append('r.sjr_quartile = ?')
            params.append(selected_quartile)
            
        if where_clauses:
            sql += ' WHERE ' + ' AND '.join(where_clauses)
            
        # Sort by SJR Score desc
        sql += ' ORDER BY r.sjr_score DESC, j.title ASC LIMIT 200'
        
        try:
            cursor.execute(sql, params)
            rows = cursor.fetchall()
            for r in rows:
                source_id, title, q, sjr, h_index, j_type, country = r
                
                # Format SJR float
                sjr_str = f"{sjr:.3f}" if sjr is not None else "-"
                h_str = str(h_index) if h_index is not None else "-"
                q_str = str(q) if q else "-"
                
                # Add tagging to highlight the SJR Quartile column
                tag = 'other'
                if q_str in ['Q1', 'Q2', 'Q3', 'Q4']:
                    tag = q_str
                    
                self.tree.insert("", "end", values=(source_id, title, q_str, sjr_str, h_str, j_type, country), tags=(tag,))
        except sqlite3.Error as e:
            print("Search database query failed:", e)
        finally:
            conn.close()

    def clear_filters(self):
        self.search_entry.delete(0, "end")
        self.quartile_filter.set("Q1")
        # Reset year filter to the latest year available
        values = self.year_filter.cget("values")
        if values and values[0] != "-":
            self.year_filter.set(values[0])
        else:
            self.year_filter.set("-")
        self.search_db()

    def on_journal_selected(self, event):
        selected_items = self.tree.selection()
        if not selected_items:
            return
            
        item = selected_items[0]
        values = self.tree.item(item, "values")
        source_id = int(values[0])
        
        # Query details from database
        conn = sqlite3.connect(self.db_file_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # 1. Fetch master info
        cursor.execute("SELECT * FROM journals WHERE source_id = ?", (source_id,))
        journal = cursor.fetchone()
        
        # 2. Fetch all ISSNs
        cursor.execute("SELECT issn FROM issns WHERE source_id = ?", (source_id,))
        issns = [r['issn'] for r in cursor.fetchall()]
        # Format as standard ISSN with hyphen (e.g. 1234-5678)
        formatted_issns = []
        for i in issns:
            if len(i) == 8:
                formatted_issns.append(f"{i[:4]}-{i[4:]}")
            else:
                formatted_issns.append(i)
        
        # 3. Fetch rank history
        cursor.execute("SELECT year, sjr_score, sjr_quartile, h_index FROM rankings WHERE source_id = ? ORDER BY year DESC", (source_id,))
        rankings = cursor.fetchall()
        
        conn.close()
        
        # Update Info TextBox
        self.info_text.configure(state="normal")
        self.info_text.delete("1.0", "end")
        
        if journal:
            info_str = f"TÊN TẠP CHÍ:\n{journal['title']}\n\n"
            info_str += f"NHÀ XUẤT BẢN: {journal['publisher']}\n"
            info_str += f"QUỐC GIA: {journal['country']}\n"
            info_str += f"LOẠI HÌNH: {journal['type']}\n"
            info_str += f"MÃ ISSN: {', '.join(formatted_issns) if formatted_issns else '-'}\n"
            self.info_text.insert("1.0", info_str)
            
        self.info_text.configure(state="disabled")
        
        # Populate history sub-table
        for h_item in self.hist_tree.get_children():
            self.hist_tree.delete(h_item)
            
        for r in rankings:
            year = r['year']
            q = r['sjr_quartile']
            sjr = r['sjr_score']
            h_index = r['h_index']
            
            sjr_str = f"{sjr:.3f}" if sjr is not None else "-"
            h_str = str(h_index) if h_index is not None else "-"
            q_str = str(q) if q else "-"
            
            tag = 'other'
            if q_str in ['Q1', 'Q2', 'Q3', 'Q4']:
                tag = q_str
                
            self.hist_tree.insert("", "end", values=(year, q_str, sjr_str), tags=(tag,))

    def __del__(self):
        # Restore stdout
        sys.stdout = self.old_stdout

if __name__ == "__main__":
    app = SCImagoCrawlerApp()
    app.mainloop()
