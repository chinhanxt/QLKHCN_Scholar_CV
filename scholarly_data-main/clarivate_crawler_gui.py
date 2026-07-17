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

# Import backend modules
from clarivate_crawler import crawl_clarivate, init_db, normalize_title

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

class ClarivateCrawlerApp(ctk.CTk):
    def __init__(self):
        super().__init__()

        self.title("Web of Science (Clarivate) Master Journal List - Downloader & Manager")
        self.geometry("1200x780")
        
        # Configure paths
        self.script_dir = os.path.dirname(os.path.abspath(__file__))
        self.db_file_path = os.path.join(self.script_dir, "clarivate_all.db")
        self.scimago_db_path = os.path.join(self.script_dir, "scimagojr_all.db")
        self.bioxbio_db_path = os.path.join(self.script_dir, "bioxbio_all.db")

        # Initialize SQLite DB
        init_db(self.db_file_path)
        
        # Background task variables
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
        self.search_db()

        # Start periodic GUI updates
        self.after(100, self.process_queues)

    def create_sidebar(self):
        self.sidebar = ctk.CTkFrame(self, width=250, corner_radius=0)
        self.sidebar.grid(row=0, column=0, sticky="nsew", padx=0, pady=0)
        self.sidebar.grid_rowconfigure(6, weight=1)  # spacer

        # Brand Title
        self.app_title = ctk.CTkLabel(
            self.sidebar, 
            text="CLARIVATE DOWNLOADER", 
            font=ctk.CTkFont(size=14, weight="bold"),
            text_color="#1f538d"
        )
        self.app_title.grid(row=0, column=0, padx=15, pady=(15, 5), sticky="w")
        
        # Divider
        self.divider = ctk.CTkFrame(self.sidebar, height=2, fg_color="#34495e")
        self.divider.grid(row=1, column=0, padx=15, pady=5, sticky="ew")

        # Operations Box
        self.ops_box = ctk.CTkFrame(self.sidebar, fg_color="#1e2122", corner_radius=8)
        self.ops_box.grid(row=2, column=0, padx=15, pady=10, sticky="ew")
        
        self.ops_title = ctk.CTkLabel(self.ops_box, text="CẤP NHẬT DB CHỈ MỤC", font=ctk.CTkFont(size=11, weight="bold"), text_color="#1f538d")
        self.ops_title.pack(anchor="w", padx=10, pady=(8, 2))
        
        self.delay_lbl = ctk.CTkLabel(self.ops_box, text="Khoảng nghỉ giữa request (giây):", font=ctk.CTkFont(size=10))
        self.delay_lbl.pack(anchor="w", padx=10, pady=(4, 0))

        self.delay_entry = ctk.CTkEntry(
            self.ops_box, 
            height=28,
            placeholder_text="1.5"
        )
        self.delay_entry.insert(0, "1.5")
        self.delay_entry.pack(fill="x", padx=10, pady=2)
        
        self.threads_lbl = ctk.CTkLabel(self.ops_box, text="Số luồng tải song song (threads):", font=ctk.CTkFont(size=10))
        self.threads_lbl.pack(anchor="w", padx=10, pady=(4, 0))

        self.threads_entry = ctk.CTkEntry(
            self.ops_box, 
            height=28,
            placeholder_text="3"
        )
        self.threads_entry.insert(0, "3")
        self.threads_entry.pack(fill="x", padx=10, pady=2)

        self.download_btn = ctk.CTkButton(
            self.ops_box, 
            text="🚀 Bắt đầu tải chỉ mục", 
            height=30,
            fg_color="#1f538d", 
            hover_color="#143d66",
            font=ctk.CTkFont(weight="bold"),
            command=self.start_crawling
        )
        self.download_btn.pack(fill="x", padx=10, pady=(10, 4))

        self.stop_btn = ctk.CTkButton(
            self.ops_box, 
            text="🛑 Dừng tải", 
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

        self.stat_total_lbl = ctk.CTkLabel(self.stats_box, text="Tạp chí đã lưu: 0", font=ctk.CTkFont(size=11))
        self.stat_total_lbl.pack(anchor="w", padx=10, pady=2)

        self.stat_pages_lbl = ctk.CTkLabel(self.stats_box, text="Trang đã tải: 0", font=ctk.CTkFont(size=11))
        self.stat_pages_lbl.pack(anchor="w", padx=10, pady=2)

        self.stat_scie_lbl = ctk.CTkLabel(self.stats_box, text="Chỉ mục SCIE: 0", font=ctk.CTkFont(size=11))
        self.stat_scie_lbl.pack(anchor="w", padx=10, pady=2)

        self.stat_ssci_lbl = ctk.CTkLabel(self.stats_box, text="Chỉ mục SSCI: 0", font=ctk.CTkFont(size=11))
        self.stat_ssci_lbl.pack(anchor="w", padx=10, pady=(2, 8))

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
            placeholder_text="Tìm theo Tạp chí, ISSN..."
        )
        self.search_entry.grid(row=0, column=1, padx=5, pady=10, sticky="w")
        self.search_entry.bind("<KeyRelease>", lambda e: self.search_db())

        # Coverage Filter
        self.coverage_lbl = ctk.CTkLabel(self.filter_bar, text="Chỉ mục WoS Core:")
        self.coverage_lbl.grid(row=0, column=2, padx=(15, 2), pady=10, sticky="w")
        
        self.coverage_filter = ctk.CTkOptionMenu(
            self.filter_bar, 
            width=220, 
            values=["Tất cả chỉ mục Core", "Science Citation Index Expanded (SCIE)", "Social Sciences Citation Index (SSCI)", "Arts & Humanities Citation Index (AHCI)", "Emerging Sources Citation Index (ESCI)"],
            command=lambda val: self.search_db()
        )
        self.coverage_filter.grid(row=0, column=3, padx=(5, 15), pady=10, sticky="w")

        # 2. Split Treeview & Details
        self.data_layout = ctk.CTkFrame(self.tab_browser, fg_color="transparent")
        self.data_layout.grid(row=1, column=0, sticky="nsew", padx=5, pady=5)
        self.data_layout.grid_rowconfigure(0, weight=1)
        self.data_layout.grid_columnconfigure(0, weight=3)  # Treeview gets 3/4
        self.data_layout.grid_columnconfigure(1, weight=1)  # Details get 1/4

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

        columns = ("ID", "Title", "ISSN", "WoSCore")
        self.tree = ttk.Treeview(self.tree_container, columns=columns, show="headings", selectmode="browse")
        
        self.tree.heading("ID", text="Pub ID", anchor="center")
        self.tree.heading("Title", text="Tên Tạp chí (Web of Science)", anchor="w")
        self.tree.heading("ISSN", text="ISSN / eISSN", anchor="center")
        self.tree.heading("WoSCore", text="Web of Science Core Collection", anchor="w")

        self.tree.column("ID", width=65, minwidth=50, anchor="center")
        self.tree.column("Title", width=340, minwidth=200, anchor="w")
        self.tree.column("ISSN", width=130, minwidth=100, anchor="center")
        self.tree.column("WoSCore", width=250, minwidth=150, anchor="w")

        self.scrollbar = ctk.CTkScrollbar(self.tree_container, command=self.tree.yview)
        self.tree.configure(yscrollcommand=self.scrollbar.set)
        
        self.tree.grid(row=0, column=0, sticky="nsew", padx=(5, 0), pady=5)
        self.scrollbar.grid(row=0, column=1, sticky="ns", padx=(0, 5), pady=5)

        self.tree.bind("<<TreeviewSelect>>", self.on_journal_selected)

        # 4. Detail Panel Container
        self.detail_container = ctk.CTkFrame(self.data_layout, corner_radius=8, fg_color="#1e2122")
        self.detail_container.grid(row=0, column=1, sticky="nsew", padx=(5, 0))
        self.detail_container.grid_rowconfigure(1, weight=1)
        self.detail_container.grid_columnconfigure(0, weight=1)

        self.detail_lbl = ctk.CTkLabel(self.detail_container, text="CHI TIẾT TẠP CHÍ", font=ctk.CTkFont(size=12, weight="bold"), text_color="#1f538d")
        self.detail_lbl.grid(row=0, column=0, padx=15, pady=(10, 5), sticky="w")

        # Scrollable textbox to show details
        self.info_text = tk.Text(
            self.detail_container, 
            bg="#1e2122", 
            fg="#eaeaea", 
            bd=0, 
            wrap="word", 
            font=("Arial", 11),
            padx=10, 
            pady=10
        )
        self.info_text.grid(row=1, column=0, padx=10, pady=(5, 10), sticky="nsew")
        self.info_text.insert("1.0", "Hãy chọn một tạp chí từ bảng bên trái để xem đầy đủ thông tin chỉ mục từ Web of Science (Clarivate).")
        self.info_text.configure(state="disabled")

    def setup_logs_tab(self):
        self.tab_logs.grid_rowconfigure(2, weight=1)
        self.tab_logs.grid_columnconfigure(0, weight=1)
        self.tab_logs.grid_columnconfigure(1, weight=1)

        self.progress_panel = ctk.CTkFrame(self.tab_logs, height=100)
        self.progress_panel.grid(row=0, column=0, columnspan=2, sticky="ew", padx=5, pady=5)
        
        self.status_lbl = ctk.CTkLabel(self.progress_panel, text="TRẠNG THÁI TIẾN TRÌNH", font=ctk.CTkFont(weight="bold"))
        self.status_lbl.grid(row=0, column=0, padx=15, pady=(10, 2), sticky="w")

        self.status_desc_lbl = ctk.CTkLabel(self.progress_panel, text="Đang rảnh (Idle)", text_color="#2ecc71")
        self.status_desc_lbl.grid(row=1, column=0, padx=15, pady=(0, 5), sticky="w")

        self.progress_bar = ctk.CTkProgressBar(self.progress_panel)
        self.progress_bar.grid(row=2, column=0, padx=15, pady=(5, 15), sticky="ew")
        self.progress_bar.set(0)
        self.progress_panel.grid_columnconfigure(0, weight=1)

        # Left console log
        self.log_lbl = ctk.CTkLabel(self.tab_logs, text="Nhật ký hoạt động (Console Log):", font=ctk.CTkFont(weight="bold"))
        self.log_lbl.grid(row=1, column=0, padx=5, pady=(10, 2), sticky="w")

        self.log_box = tk.Text(self.tab_logs, bg="#1a1c1e", fg="#eaeaea", bd=0, font=("Courier", 10))
        self.log_box.grid(row=2, column=0, padx=5, pady=(0, 10), sticky="nsew")

        self.log_scroll = ctk.CTkScrollbar(self.tab_logs, command=self.log_box.yview)
        self.log_box.configure(yscrollcommand=self.log_scroll.set)
        self.log_scroll.grid(row=2, column=0, sticky="nse", padx=(0, 5), pady=(0, 10))

        # Right console log (Errors / Excludes)
        self.error_lbl = ctk.CTkLabel(self.tab_logs, text="Nhật ký Lỗi / Bỏ qua:", font=ctk.CTkFont(weight="bold"))
        self.error_lbl.grid(row=1, column=1, padx=5, pady=(10, 2), sticky="w")

        self.error_box = tk.Text(self.tab_logs, bg="#1a1c1e", fg="#e74c3c", bd=0, font=("Courier", 10))
        self.error_box.grid(row=2, column=1, padx=5, pady=(0, 10), sticky="nsew")

        self.error_scroll = ctk.CTkScrollbar(self.tab_logs, command=self.error_box.yview)
        self.error_box.configure(yscrollcommand=self.error_scroll.set)
        self.error_scroll.grid(row=2, column=1, sticky="nse", padx=(0, 5), pady=(0, 10))

    # --- Worker queues processing ---
    def process_queues(self):
        # 1. Print stdout from ThreadSafeConsoleQueue to GUI log box
        try:
            while True:
                msg = self.console_queue.q.get_nowait()
                self.log_box.insert("end", msg)
                self.log_box.see("end")
        except queue.Empty:
            pass

        # 2. Process custom background thread callbacks
        try:
            while True:
                action, data = self.msg_queue.get_nowait()
                
                if action == "crawl_start":
                    self.is_running = True
                    self.status_desc_lbl.configure(text=data["msg"], text_color="#f1c40f")
                    self.progress_bar.set(0.01)
                    self.download_btn.configure(state="disabled")
                    self.stop_btn.configure(state="normal")
                    
                elif action == "page_scraped":
                    total_pages = data["total_pages"]
                    processed_pages = data["processed_pages"]
                    pct = float(processed_pages) / max(1, total_pages)
                    self.progress_bar.set(pct)
                    self.status_desc_lbl.configure(
                        text=f"Đang tải trang chỉ mục... {processed_pages}/{total_pages} trang ({pct*100:.1f}%)", 
                        text_color="#f1c40f"
                    )
                    # Refresh statistics and search list every 2 pages
                    if processed_pages % 2 == 0:
                        self.update_db_stats()
                        self.search_db()
                        
                elif action == "page_error":
                    self.error_box.insert("end", data["msg"] + "\n")
                    self.error_box.see("end")
                    
                elif action == "crawl_stopped":
                    self.is_running = False
                    self.status_desc_lbl.configure(text=data["msg"], text_color="#e74c3c")
                    self.download_btn.configure(state="normal")
                    self.stop_btn.configure(state="disabled")
                    self.update_db_stats()
                    self.search_db()
                    messagebox.showwarning("Đã dừng", "Quá trình tải dữ liệu đã dừng theo yêu cầu.")
                    
                elif action == "crawl_complete":
                    self.is_running = False
                    self.status_desc_lbl.configure(text=data["msg"], text_color="#2ecc71")
                    self.progress_bar.set(1.0)
                    self.download_btn.configure(state="normal")
                    self.stop_btn.configure(state="disabled")
                    self.update_db_stats()
                    self.search_db()
                    messagebox.showinfo("Hoàn thành", "Quá trình tải danh sách Clarivate Web of Science đã hoàn tất!")
                    
                elif action == "crawl_fail":
                    self.is_running = False
                    self.status_desc_lbl.configure(text=data["error"], text_color="#e74c3c")
                    self.progress_bar.set(0)
                    self.download_btn.configure(state="normal")
                    self.stop_btn.configure(state="disabled")
                    messagebox.showerror("Lỗi kết nối", data["error"])
                    
        except queue.Empty:
            pass

        self.after(100, self.process_queues)

    # --- Callback wrapper for backend thread ---
    def crawler_callback(self, action, data):
        self.msg_queue.put((action, data))

    # --- Action handlers ---
    def start_crawling(self):
        if self.is_running:
            return

        try:
            delay = float(self.delay_entry.get().strip())
        except ValueError:
            messagebox.showerror("Lỗi", "Khoảng nghỉ giữa request phải là số thực (VD: 1.5)")
            return
            
        try:
            threads = int(self.threads_entry.get().strip())
            if threads < 1 or threads > 20:
                raise ValueError()
        except ValueError:
            messagebox.showerror("Lỗi", "Số luồng chạy song song phải là số nguyên dương từ 1 đến 20")
            return

        self.stop_event.clear()
        self.error_box.delete("1.0", "end")
        
        # Run crawler in background thread (Scimago and bioxbio paths left to match signature)
        self.crawler_thread = threading.Thread(
            target=crawl_clarivate,
            args=(
                self.scimago_db_path, 
                self.bioxbio_db_path, 
                self.db_file_path, 
                delay, 
                threads, 
                self.crawler_callback, 
                self.stop_event
            ),
            daemon=True
        )
        self.crawler_thread.start()

    def stop_crawling(self):
        if not self.is_running:
            return
        self.status_desc_lbl.configure(text="Đang dừng các tiến trình con... Vui lòng đợi...", text_color="#e74c3c")
        self.stop_event.set()

    # --- UI Helpers ---
    def update_db_stats(self):
        """Query SQLite counts and update Sidebar labels."""
        if not os.path.exists(self.db_file_path):
            return
            
        try:
            conn = sqlite3.connect(self.db_file_path)
            cursor = conn.cursor()
            
            # Total journals saved
            cursor.execute("SELECT COUNT(*) FROM journals")
            total_j = cursor.fetchone()[0]
            
            # Completed pages
            cursor.execute("SELECT COUNT(*) FROM page_progress WHERE status = 'COMPLETED'")
            completed_p = cursor.fetchone()[0]
            
            # Count SCIE and SSCI
            cursor.execute("SELECT COUNT(*) FROM journals WHERE wos_core_collection LIKE '%Science Citation Index Expanded%'")
            scie = cursor.fetchone()[0]
            
            cursor.execute("SELECT COUNT(*) FROM journals WHERE wos_core_collection LIKE '%Social Sciences Citation Index%'")
            ssci = cursor.fetchone()[0]
            
            self.stat_total_lbl.configure(text=f"Tạp chí đã lưu: {total_j:,}")
            self.stat_pages_lbl.configure(text=f"Trang đã tải: {completed_p:,}")
            self.stat_scie_lbl.configure(text=f"Chỉ mục SCIE: {scie:,}")
            self.stat_ssci_lbl.configure(text=f"Chỉ mục SSCI: {ssci:,}")
            
            conn.close()
        except Exception as e:
            pass

    def search_db(self):
        """Search and filter Clarivate database and render into Treeview."""
        # Clear existing items
        for item in self.tree.get_children():
            self.tree.delete(item)
            
        if not os.path.exists(self.db_file_path):
            return
            
        query_text = self.search_entry.get().strip()
        cov_val = self.coverage_filter.get()
        
        try:
            conn = sqlite3.connect(self.db_file_path)
            cursor = conn.cursor()
            
            # Base query
            sql = "SELECT publication_id, clarivate_title, issn, eissn, wos_core_collection FROM journals WHERE 1=1"
            params = []
            
            # Search query parameter matching
            if query_text:
                sql += " AND (clarivate_title LIKE ? OR issn LIKE ? OR eissn LIKE ?)"
                like_p = f"%{query_text}%"
                params.extend([like_p, like_p, like_p])
                
            # Filter dropdown matching
            if cov_val == "Science Citation Index Expanded (SCIE)":
                sql += " AND wos_core_collection LIKE '%Science Citation Index Expanded%'"
            elif cov_val == "Social Sciences Citation Index (SSCI)":
                sql += " AND wos_core_collection LIKE '%Social Sciences Citation Index%'"
            elif cov_val == "Arts & Humanities Citation Index (AHCI)":
                sql += " AND wos_core_collection LIKE '%Arts & Humanities Citation Index%'"
            elif cov_val == "Emerging Sources Citation Index (ESCI)":
                sql += " AND wos_core_collection LIKE '%Emerging Sources Citation Index%'"
                
            # Sort order by publication_id
            sql += " ORDER BY publication_id ASC LIMIT 500"
            
            cursor.execute(sql, params)
            rows = cursor.fetchall()
            
            for r in rows:
                pub_id, title, issn, eissn, wos = r
                
                # Combine ISSNs for display
                issn_disp = issn or ""
                if eissn:
                    if issn_disp:
                        issn_disp += f" / {eissn}"
                    else:
                        issn_disp = eissn
                        
                wos_disp = wos or "-"
                title_disp = title or "-"
                
                self.tree.insert("", "end", values=(pub_id, title_disp, issn_disp, wos_disp))
                
            conn.close()
        except Exception as e:
            print("Error filtering database:", e)

    def on_journal_selected(self, event):
        """Displays full details of the selected journal in the right text panel."""
        selected = self.tree.selection()
        if not selected:
            return
            
        item_values = self.tree.item(selected[0], "values")
        pub_id = item_values[0]
        
        try:
            conn = sqlite3.connect(self.db_file_path)
            cursor = conn.cursor()
            cursor.execute("""
                SELECT clarivate_title, issn, eissn, publisher, country, 
                       wos_core_collection, additional_wos_indexes, last_updated 
                FROM journals WHERE publication_id = ?
            """, (pub_id,))
            row = cursor.fetchone()
            conn.close()
            
            if row:
                c_title, issn, eissn, publisher, country, wos_core, add_indexes, last_upd = row
                
                info = []
                info.append("=== CHI TIẾT TẠP CHÍ ===")
                info.append(f"Tên Tạp chí (Clarivate / WoS):\n{c_title}\n")
                info.append(f"ID Tạp chí: {pub_id}")
                info.append(f"ISSN: {issn or 'N/A'}")
                info.append(f"eISSN: {eissn or 'N/A'}\n")
                info.append(f"Nhà xuất bản (Publisher):\n{publisher or 'N/A'}\n")
                info.append(f"Quốc gia: {country or 'N/A'}\n")
                info.append(f"Cập nhật lúc: {last_upd}\n")
                
                info.append("--- CHỈ MỤC WEB OF SCIENCE (WOS) ---")
                info.append(f"Web of Science Core Collection:\n{wos_core or '(Không thuộc nhóm Core)'}\n")
                info.append(f"Các chỉ mục WoS bổ sung khác:\n{add_indexes or '(Không có)'}")
                
                text_content = "\n".join(info)
                
                self.info_text.configure(state="normal")
                self.info_text.delete("1.0", "end")
                self.info_text.insert("1.0", text_content)
                self.info_text.configure(state="disabled")
                
        except Exception as e:
            print("Error retrieving details:", e)

    def destroy(self):
        # Restore stdout
        sys.stdout = self.old_stdout
        super().destroy()

if __name__ == "__main__":
    app = ClarivateCrawlerApp()
    app.mainloop()
