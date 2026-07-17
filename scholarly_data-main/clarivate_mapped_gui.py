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

# Set styling
ctk.set_appearance_mode("Dark")
ctk.set_default_color_theme("blue")

class ClarivateMappedApp(ctk.CTk):
    def __init__(self):
        super().__init__()

        self.title("Web of Science (Clarivate) Master Journal List - Score Integrator & Manager")
        self.geometry("1300x820")
        
        # Configure paths
        self.script_dir = os.path.dirname(os.path.abspath(__file__))
        self.db_file_path = os.path.join(self.script_dir, "clarivate_mapped.db")
        self.clarivate_raw_db_path = os.path.join(self.script_dir, "clarivate_all.db")
        self.scimago_db_path = os.path.join(self.script_dir, "scimagojr_all.db")
        self.bioxbio_db_path = os.path.join(self.script_dir, "bioxbio_all.db")

        # Automatically copy/initialize database if clarivate_mapped.db doesn't exist
        if not os.path.exists(self.db_file_path) and os.path.exists(self.clarivate_raw_db_path):
            try:
                import shutil
                shutil.copy2(self.clarivate_raw_db_path, self.db_file_path)
            except Exception as e:
                print(f"Error copying raw DB to mapped DB on startup: {e}")

        # Threading/Sync queue
        self.msg_queue = queue.Queue()
        self.sync_thread = None
        self.is_syncing = False

        # GUI Layout Config
        self.grid_columnconfigure(1, weight=1)
        self.grid_rowconfigure(0, weight=1)

        # Create sidebar and main panel
        self.create_sidebar()
        self.create_main_panel()

        # Initial UI stats and data load
        self.update_db_stats()
        self.search_db()

        # Listen to queue
        self.after(100, self.process_queues)

    def create_sidebar(self):
        self.sidebar = ctk.CTkFrame(self, width=270, corner_radius=0)
        self.sidebar.grid(row=0, column=0, sticky="nsew", padx=0, pady=0)
        self.sidebar.grid_rowconfigure(6, weight=1)  # Spacer

        # Brand Title
        self.app_title = ctk.CTkLabel(
            self.sidebar, 
            text="WOS SCORE INTEGRATOR", 
            font=ctk.CTkFont(size=14, weight="bold"),
            text_color="#1f538d"
        )
        self.app_title.grid(row=0, column=0, padx=15, pady=(15, 5), sticky="w")
        
        # Divider
        self.divider = ctk.CTkFrame(self.sidebar, height=2, fg_color="#34495e")
        self.divider.grid(row=1, column=0, padx=15, pady=5, sticky="ew")

        # Sync Action Frame
        self.sync_frame = ctk.CTkFrame(self.sidebar, fg_color="#1e2122", corner_radius=8)
        self.sync_frame.grid(row=2, column=0, padx=15, pady=10, sticky="ew")

        self.sync_title = ctk.CTkLabel(
            self.sync_frame, 
            text="CẬP NHẬT CƠ SỞ DỮ LIỆU", 
            font=ctk.CTkFont(size=11, weight="bold"), 
            text_color="#1f538d"
        )
        self.sync_title.pack(anchor="w", padx=10, pady=(8, 2))

        self.sync_desc = ctk.CTkLabel(
            self.sync_frame, 
            text="Tạo/cập nhật DB riêng biệt tích hợp điểm IF (BioxBio) và SJR (SCImago) từ dữ liệu mới nhất.", 
            font=ctk.CTkFont(size=10),
            wraplength=220,
            justify="left",
            text_color="#95a5a6"
        )
        self.sync_desc.pack(anchor="w", padx=10, pady=(2, 6))

        self.sync_btn = ctk.CTkButton(
            self.sync_frame, 
            text="🔄 Cập nhật DB", 
            height=32,
            fg_color="#27ae60", 
            hover_color="#219a52",
            font=ctk.CTkFont(weight="bold"),
            command=self.start_sync
        )
        self.sync_btn.pack(fill="x", padx=10, pady=(4, 8))

        # Progress elements in sidebar
        self.sync_progress_bar = ctk.CTkProgressBar(self.sync_frame)
        self.sync_progress_bar.set(0)
        
        self.sync_status_lbl = ctk.CTkLabel(
            self.sync_frame, 
            text="Sẵn sàng (Ready)", 
            font=ctk.CTkFont(size=10, weight="bold"), 
            text_color="#2ecc71"
        )

        # Statistics Box
        self.stats_box = ctk.CTkFrame(self.sidebar, fg_color="#1e2122", corner_radius=8)
        self.stats_box.grid(row=3, column=0, padx=15, pady=10, sticky="ew")

        self.stats_title = ctk.CTkLabel(
            self.stats_box, 
            text="THỐNG KÊ ĐỒNG BỘ", 
            font=ctk.CTkFont(size=11, weight="bold"), 
            text_color="#f1c40f"
        )
        self.stats_title.pack(anchor="w", padx=10, pady=(8, 2))

        self.stat_total_lbl = ctk.CTkLabel(self.stats_box, text="Tổng tạp chí WOS: 0", font=ctk.CTkFont(size=11))
        self.stat_total_lbl.pack(anchor="w", padx=10, pady=2)

        self.stat_if_lbl = ctk.CTkLabel(self.stats_box, text="Khớp IF (BioxBio): 0", font=ctk.CTkFont(size=11))
        self.stat_if_lbl.pack(anchor="w", padx=10, pady=2)

        self.stat_sjr_lbl = ctk.CTkLabel(self.stats_box, text="Khớp SJR (SCImago): 0", font=ctk.CTkFont(size=11))
        self.stat_sjr_lbl.pack(anchor="w", padx=10, pady=2)

        self.stat_both_lbl = ctk.CTkLabel(self.stats_box, text="Khớp cả hai chỉ mục: 0", font=ctk.CTkFont(size=11))
        self.stat_both_lbl.pack(anchor="w", padx=10, pady=2)

        self.stat_none_lbl = ctk.CTkLabel(self.stats_box, text="Không tìm thấy điểm: 0", font=ctk.CTkFont(size=11))
        self.stat_none_lbl.pack(anchor="w", padx=10, pady=(2, 8))

    def create_main_panel(self):
        self.main_panel = ctk.CTkFrame(self, fg_color="transparent")
        self.main_panel.grid(row=0, column=1, sticky="nsew", padx=10, pady=10)
        self.main_panel.grid_rowconfigure(0, weight=1)
        self.main_panel.grid_columnconfigure(0, weight=1)

        self.tabview = ctk.CTkTabview(self.main_panel)
        self.tabview.grid(row=0, column=0, sticky="nsew")

        self.tab_browser = self.tabview.add("Bảng Tạp chí Tích hợp")
        self.setup_browser_tab()

    def setup_browser_tab(self):
        self.tab_browser.grid_rowconfigure(1, weight=1)
        self.tab_browser.grid_columnconfigure(0, weight=1)

        # 1. Filters layout
        self.filter_bar = ctk.CTkFrame(self.tab_browser)
        self.filter_bar.grid(row=0, column=0, sticky="ew", padx=5, pady=5)
        
        # Search text
        self.search_lbl = ctk.CTkLabel(self.filter_bar, text="Tìm kiếm:")
        self.search_lbl.grid(row=0, column=0, padx=(10, 2), pady=10, sticky="w")

        self.search_entry = ctk.CTkEntry(
            self.filter_bar, 
            width=220, 
            placeholder_text="Nhập tên Tạp chí, ISSN..."
        )
        self.search_entry.grid(row=0, column=1, padx=5, pady=10, sticky="w")
        self.search_entry.bind("<KeyRelease>", lambda e: self.search_db())

        # WoS Core Filter
        self.wos_lbl = ctk.CTkLabel(self.filter_bar, text="Chỉ mục WoS:")
        self.wos_lbl.grid(row=0, column=2, padx=(10, 2), pady=10, sticky="w")
        
        self.wos_filter = ctk.CTkOptionMenu(
            self.filter_bar, 
            width=150, 
            values=["Tất cả", "SCIE", "SSCI", "AHCI", "ESCI"],
            command=lambda val: self.search_db()
        )
        self.wos_filter.grid(row=0, column=3, padx=5, pady=10, sticky="w")

        # Score filter (IF/SJR matching filter)
        self.score_lbl = ctk.CTkLabel(self.filter_bar, text="Bộ lọc điểm:")
        self.score_lbl.grid(row=0, column=4, padx=(10, 2), pady=10, sticky="w")
        
        self.score_filter = ctk.CTkOptionMenu(
            self.filter_bar, 
            width=160, 
            values=["Tất cả", "Có điểm IF (BioxBio)", "Có điểm SJR (SCImago)", "Có cả hai điểm", "Không có điểm nào"],
            command=lambda val: self.search_db()
        )
        self.score_filter.grid(row=0, column=5, padx=5, pady=10, sticky="w")

        # Sort selector
        self.sort_lbl = ctk.CTkLabel(self.filter_bar, text="Sắp xếp theo:")
        self.sort_lbl.grid(row=0, column=6, padx=(10, 2), pady=10, sticky="w")
        
        self.sort_filter = ctk.CTkOptionMenu(
            self.filter_bar, 
            width=170, 
            values=["ID Clarivate", "Tên Tạp chí", "Điểm IF (Cao -> Thấp)", "Điểm SJR (Cao -> Thấp)", "H-Index (Cao -> Thấp)"],
            command=lambda val: self.search_db()
        )
        self.sort_filter.grid(row=0, column=7, padx=(5, 10), pady=10, sticky="w")

        # 2. Main data display split
        self.data_layout = ctk.CTkFrame(self.tab_browser, fg_color="transparent")
        self.data_layout.grid(row=1, column=0, sticky="nsew", padx=5, pady=5)
        self.data_layout.grid_rowconfigure(0, weight=1)
        self.data_layout.grid_columnconfigure(0, weight=3)  # Treeview gets 3/4
        self.data_layout.grid_columnconfigure(1, weight=1)  # Detail gets 1/4

        # 3. Treeview Table setup
        self.tree_container = ctk.CTkFrame(self.data_layout, corner_radius=8)
        self.tree_container.grid(row=0, column=0, sticky="nsew", padx=(0, 5))
        self.tree_container.grid_rowconfigure(0, weight=1)
        self.tree_container.grid_columnconfigure(0, weight=1)

        columns = ("ID", "Title", "ISSN", "WoSCore", "IF", "SJR", "HIndex")
        self.tree = ttk.Treeview(self.tree_container, columns=columns, show="headings", selectmode="browse")
        
        self.tree.heading("ID", text="Pub ID", anchor="center")
        self.tree.heading("Title", text="Tên Tạp chí (WoS)", anchor="w")
        self.tree.heading("ISSN", text="ISSN / eISSN", anchor="center")
        self.tree.heading("WoSCore", text="Chỉ mục WoS", anchor="w")
        self.tree.heading("IF", text="IF (BioxBio)", anchor="center")
        self.tree.heading("SJR", text="SJR (SCImago)", anchor="center")
        self.tree.heading("HIndex", text="H-Index", anchor="center")

        self.tree.column("ID", width=65, minwidth=50, anchor="center")
        self.tree.column("Title", width=340, minwidth=200, anchor="w")
        self.tree.column("ISSN", width=120, minwidth=100, anchor="center")
        self.tree.column("WoSCore", width=160, minwidth=100, anchor="w")
        self.tree.column("IF", width=80, minwidth=70, anchor="center")
        self.tree.column("SJR", width=95, minwidth=80, anchor="center")
        self.tree.column("HIndex", width=70, minwidth=60, anchor="center")

        self.scrollbar = ctk.CTkScrollbar(self.tree_container, command=self.tree.yview)
        self.tree.configure(yscrollcommand=self.scrollbar.set)
        
        self.tree.grid(row=0, column=0, sticky="nsew", padx=(5, 0), pady=5)
        self.scrollbar.grid(row=0, column=1, sticky="ns", padx=(0, 5), pady=5)

        self.tree.bind("<<TreeviewSelect>>", self.on_journal_selected)

        # 4. Right Side Detail Panel
        self.detail_container = ctk.CTkFrame(self.data_layout, corner_radius=8, fg_color="#1e2122")
        self.detail_container.grid(row=0, column=1, sticky="nsew", padx=(5, 0))
        self.detail_container.grid_rowconfigure(1, weight=1)
        self.detail_container.grid_columnconfigure(0, weight=1)

        self.detail_lbl = ctk.CTkLabel(
            self.detail_container, 
            text="THÔNG TIN TÍCH HỢP", 
            font=ctk.CTkFont(size=12, weight="bold"), 
            text_color="#1f538d"
        )
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
        self.info_text.insert("1.0", "Chọn một tạp chí từ danh sách bên trái để xem đầy đủ chỉ số điểm số IF và SJR đối khớp.")
        self.info_text.configure(state="disabled")

        # Add text tags for highlights
        self.info_text.tag_config("title", font=("Arial", 12, "bold"), foreground="#3498db")
        self.info_text.tag_config("heading", font=("Arial", 11, "bold"), foreground="#2ecc71")
        self.info_text.tag_config("bold", font=("Arial", 10, "bold"), foreground="#eaeaea")
        self.info_text.tag_config("normal", font=("Arial", 10), foreground="#eaeaea")
        self.info_text.tag_config("success", font=("Arial", 10, "bold"), foreground="#2ecc71")
        self.info_text.tag_config("warning", font=("Arial", 10, "bold"), foreground="#f1c40f")
        self.info_text.tag_config("danger", font=("Arial", 10, "bold"), foreground="#e74c3c")
        self.info_text.tag_config("value", font=("Arial", 10, "bold"), foreground="#9b59b6")
        self.info_text.tag_config("wos", font=("Arial", 10, "bold"), foreground="#e67e22")

    # --- Sync score logic thread ---
    def start_sync(self):
        if self.is_syncing:
            return

        if not os.path.exists(self.clarivate_raw_db_path):
            messagebox.showerror("Lỗi cơ sở dữ liệu", "Không tìm thấy dữ liệu Clarivate gốc (clarivate_all.db)!\nVui lòng cào dữ liệu Clarivate trước.")
            return

        if not os.path.exists(self.scimago_db_path) or not os.path.exists(self.bioxbio_db_path):
            messagebox.showerror(
                "Thiếu Cơ sở dữ liệu",
                "Yêu cầu phải có đầy đủ cơ sở dữ liệu gốc:\n"
                "- scimagojr_all.db (chứa điểm SJR)\n"
                "- bioxbio_all.db (chứa điểm IF)\n\n"
                "Hãy đảm bảo cả hai file cơ sở dữ liệu này có mặt ở thư mục dự án."
            )
            return

        # Copy clarivate_all.db to clarivate_mapped.db before starting update
        try:
            import shutil
            shutil.copy2(self.clarivate_raw_db_path, self.db_file_path)
        except Exception as e:
            messagebox.showerror("Lỗi khởi tạo", f"Không thể sao chép dữ liệu sang DB riêng: {e}")
            return

        self.is_syncing = True
        self.sync_btn.configure(state="disabled")
        self.sync_progress_bar.pack(fill="x", padx=10, pady=5)
        self.sync_status_lbl.pack(anchor="w", padx=10, pady=(2, 8))
        self.sync_status_lbl.configure(text="Đang cập nhật DB...", text_color="#f1c40f")

        self.sync_thread = threading.Thread(
            target=self.run_sync_worker,
            daemon=True
        )
        self.sync_thread.start()

    def run_sync_worker(self):
        try:
            # 1. Update columns
            self.msg_queue.put(("status", "Đang tạo cột chỉ mục..."))
            conn = sqlite3.connect(self.db_file_path, timeout=30.0)
            cursor = conn.cursor()
            cursor.execute("PRAGMA table_info('journals')")
            cols = {row[1] for row in cursor.fetchall()}
            
            new_cols = {
                'bioxbio_if': 'REAL',
                'bioxbio_year': 'INTEGER',
                'bioxbio_match': 'TEXT',
                'bioxbio_source_id': 'INTEGER',
                'scimago_sjr': 'REAL',
                'scimago_hindex': 'INTEGER',
                'scimago_year': 'INTEGER',
                'scimago_match': 'TEXT',
                'scimago_quartile': 'TEXT',
                'scimago_source_id': 'INTEGER'
            }
            for col_name, col_type in new_cols.items():
                if col_name not in cols:
                    cursor.execute(f"ALTER TABLE journals ADD COLUMN {col_name} {col_type}")
            conn.commit()
            conn.close()

            # 2. Fetch SCImago DB rankings
            self.msg_queue.put(("status", "Đang tải dữ liệu SCImago..."))
            conn_sjr = sqlite3.connect(self.scimago_db_path)
            c_sjr = conn_sjr.cursor()
            c_sjr.execute("""
                SELECT r.source_id, r.year, r.sjr_score, r.h_index, r.sjr_quartile
                FROM rankings r
                INNER JOIN (
                    SELECT source_id, MAX(year) as max_year
                    FROM rankings
                    GROUP BY source_id
                ) m ON r.source_id = m.source_id AND r.year = m.max_year
            """)
            sjr_rankings = {row[0]: {'year': row[1], 'sjr': row[2], 'h_index': row[3], 'quartile': row[4]} for row in c_sjr.fetchall()}
            
            c_sjr.execute("SELECT issn, source_id FROM issns")
            sjr_issns = {}
            for issn, sid in c_sjr.fetchall():
                if issn:
                    sjr_issns[issn.replace("-", "").upper().strip()] = sid
                    
            c_sjr.execute("SELECT title_normalized, source_id FROM journals")
            sjr_titles = {row[0]: row[1] for row in c_sjr.fetchall() if row[0]}
            conn_sjr.close()

            # 3. Fetch BioxBio DB rankings
            self.msg_queue.put(("status", "Đang tải dữ liệu BioxBio..."))
            conn_bb = sqlite3.connect(self.bioxbio_db_path)
            c_bb = conn_bb.cursor()
            c_bb.execute("""
                SELECT r.source_id, r.year, r.impact_factor
                FROM rankings r
                INNER JOIN (
                    SELECT source_id, MAX(year) as max_year
                    FROM rankings
                    GROUP BY source_id
                ) m ON r.source_id = m.source_id AND r.year = m.max_year
            """)
            bb_rankings = {row[0]: {'year': row[1], 'if': row[2]} for row in c_bb.fetchall()}
            
            c_bb.execute("SELECT issn, source_id FROM issns")
            bb_issns = {}
            for issn, sid in c_bb.fetchall():
                if issn:
                    bb_issns[issn.replace("-", "").upper().strip()] = sid
                    
            c_bb.execute("SELECT title_normalized, source_id FROM journals")
            bb_titles = {row[0]: row[1] for row in c_bb.fetchall() if row[0]}
            conn_bb.close()

            # 4. Fetch Clarivate Journals
            self.msg_queue.put(("status", "Đang khớp đối chiếu..."))
            conn_cl = sqlite3.connect(self.db_file_path, timeout=30.0)
            c_cl = conn_cl.cursor()
            c_cl.execute("SELECT publication_id, title_normalized, issn, eissn FROM journals")
            cl_journals = c_cl.fetchall()

            updates = []
            total = len(cl_journals)
            
            for idx, (pub_id, norm, issn, eissn) in enumerate(cl_journals):
                # Build ISSN list
                issns = []
                if issn: issns.append(issn.replace("-", "").upper().strip())
                if eissn: issns.append(eissn.replace("-", "").upper().strip())
                
                # Match SCImago
                sjr_info = None
                sjr_match_method = None
                sjr_sid = None
                for i in issns:
                    if i in sjr_issns:
                        sjr_sid = sjr_issns[i]
                        sjr_info = sjr_rankings.get(sjr_sid)
                        sjr_match_method = 'ISSN'
                        break
                if not sjr_info and norm in sjr_titles:
                    sjr_sid = sjr_titles[norm]
                    sjr_info = sjr_rankings.get(sjr_sid)
                    sjr_match_method = 'Title'
                    
                # Match BioxBio
                bb_info = None
                bb_match_method = None
                bb_sid = None
                for i in issns:
                    if i in bb_issns:
                        bb_sid = bb_issns[i]
                        bb_info = bb_rankings.get(bb_sid)
                        bb_match_method = 'ISSN'
                        break
                if not bb_info and norm in bb_titles:
                    bb_sid = bb_titles[norm]
                    bb_info = bb_rankings.get(bb_sid)
                    bb_match_method = 'Title'
                    
                # Format variables to save
                sjr_val = sjr_info['sjr'] if sjr_info else None
                hindex_val = sjr_info['h_index'] if sjr_info else None
                sjr_yr = sjr_info['year'] if sjr_info else None
                sjr_q = sjr_info['quartile'] if sjr_info else None
                if sjr_match_method is None:
                    sjr_match_method = 'NOT_FOUND'
                    
                bb_if = bb_info['if'] if bb_info else None
                bb_yr = bb_info['year'] if bb_info else None
                if bb_match_method is None:
                    bb_match_method = 'NOT_FOUND'
                    
                updates.append((
                    bb_if, bb_yr, bb_match_method, bb_sid,
                    sjr_val, hindex_val, sjr_yr, sjr_match_method, sjr_q, sjr_sid,
                    pub_id
                ))

                if idx % 500 == 0:
                    pct = float(idx) / total
                    self.msg_queue.put(("progress", (pct, f"Đang đồng bộ... {idx}/{total}")))

            # Write Updates to DB
            self.msg_queue.put(("status", "Đang ghi vào cơ sở dữ liệu..."))
            c_cl.executemany("""
                UPDATE journals SET
                    bioxbio_if = ?,
                    bioxbio_year = ?,
                    bioxbio_match = ?,
                    bioxbio_source_id = ?,
                    scimago_sjr = ?,
                    scimago_hindex = ?,
                    scimago_year = ?,
                    scimago_match = ?,
                    scimago_quartile = ?,
                    scimago_source_id = ?
                WHERE publication_id = ?
            """, updates)
            conn_cl.commit()
            conn_cl.close()

            self.msg_queue.put(("success", "Cập nhật thành công!"))
            
        except Exception as e:
            self.msg_queue.put(("error", str(e)))

    def process_queues(self):
        try:
            while True:
                action, data = self.msg_queue.get_nowait()
                if action == "status":
                    self.sync_status_lbl.configure(text=data, text_color="#f1c40f")
                elif action == "progress":
                    pct, txt = data
                    self.sync_progress_bar.set(pct)
                    self.sync_status_lbl.configure(text=txt, text_color="#f1c40f")
                elif action == "error":
                    self.is_syncing = False
                    self.sync_btn.configure(state="normal")
                    self.sync_progress_bar.pack_forget()
                    self.sync_status_lbl.pack_forget()
                    messagebox.showerror("Lỗi đồng bộ", f"Lỗi trong quá trình tích hợp: {data}")
                elif action == "success":
                    self.is_syncing = False
                    self.sync_btn.configure(state="normal")
                    self.sync_progress_bar.pack_forget()
                    self.sync_status_lbl.pack_forget()
                    
                    self.update_db_stats()
                    self.search_db()
                    messagebox.showinfo("Hoàn thành", "Quá trình cập nhật cơ sở dữ liệu tích hợp đã hoàn tất thành công!")
        except queue.Empty:
            pass

        self.after(100, self.process_queues)

    # --- UI Helpers ---
    def update_db_stats(self):
        """Query SQLite and render integrated database statistics in sidebar."""
        if not os.path.exists(self.db_file_path):
            return
            
        try:
            conn = sqlite3.connect(self.db_file_path, timeout=30.0)
            cursor = conn.cursor()
            
            # Check if columns exist, if not display 0s
            cursor.execute("PRAGMA table_info(journals)")
            cols = {row[1] for row in cursor.fetchall()}
            if "bioxbio_if" not in cols:
                conn.close()
                return

            # Total journals count
            cursor.execute("SELECT COUNT(*) FROM journals")
            total = cursor.fetchone()[0]
            
            # IF mapped count
            cursor.execute("SELECT COUNT(*) FROM journals WHERE bioxbio_if IS NOT NULL")
            if_count = cursor.fetchone()[0]
            
            # SJR mapped count
            cursor.execute("SELECT COUNT(*) FROM journals WHERE scimago_sjr IS NOT NULL")
            sjr_count = cursor.fetchone()[0]
            
            # Both mapped count
            cursor.execute("SELECT COUNT(*) FROM journals WHERE bioxbio_if IS NOT NULL AND scimago_sjr IS NOT NULL")
            both_count = cursor.fetchone()[0]
            
            # None mapped count
            cursor.execute("SELECT COUNT(*) FROM journals WHERE bioxbio_if IS NULL AND scimago_sjr IS NULL")
            none_count = cursor.fetchone()[0]
            
            self.stat_total_lbl.configure(text=f"Tổng tạp chí WOS: {total:,}")
            self.stat_if_lbl.configure(text=f"Khớp IF (BioxBio): {if_count:,}")
            self.stat_sjr_lbl.configure(text=f"Khớp SJR (SCImago): {sjr_count:,}")
            self.stat_both_lbl.configure(text=f"Khớp cả hai chỉ mục: {both_count:,}")
            self.stat_none_lbl.configure(text=f"Không tìm thấy điểm: {none_count:,}")
            
            conn.close()
        except Exception as e:
            print("Error rendering stats:", e)

    def search_db(self):
        """Query SQLite database based on filters and render rows into Treeview."""
        # Clear table
        for item in self.tree.get_children():
            self.tree.delete(item)
            
        if not os.path.exists(self.db_file_path):
            return
            
        search_txt = self.search_entry.get().strip()
        wos_val = self.wos_filter.get()
        score_val = self.score_filter.get()
        sort_val = self.sort_filter.get()
        
        try:
            conn = sqlite3.connect(self.db_file_path, timeout=30.0)
            cursor = conn.cursor()
            
            # Check if scores columns exist
            cursor.execute("PRAGMA table_info(journals)")
            cols = {row[1] for row in cursor.fetchall()}
            
            has_score_cols = "bioxbio_if" in cols
            
            # Base Query
            if has_score_cols:
                sql = "SELECT publication_id, clarivate_title, issn, eissn, wos_core_collection, bioxbio_if, scimago_sjr, scimago_hindex FROM journals WHERE 1=1"
            else:
                sql = "SELECT publication_id, clarivate_title, issn, eissn, wos_core_collection, NULL, NULL, NULL FROM journals WHERE 1=1"
                
            params = []
            
            # Title / ISSN search matching
            if search_txt:
                sql += " AND (clarivate_title LIKE ? OR issn LIKE ? OR eissn LIKE ?)"
                like_p = f"%{search_txt}%"
                params.extend([like_p, like_p, like_p])
                
            # WoS index category matching
            if wos_val != "Tất cả":
                if wos_val == "SCIE":
                    sql += " AND wos_core_collection LIKE '%Science Citation Index Expanded%'"
                elif wos_val == "SSCI":
                    sql += " AND wos_core_collection LIKE '%Social Sciences Citation Index%'"
                elif wos_val == "AHCI":
                    sql += " AND wos_core_collection LIKE '%Arts & Humanities Citation Index%'"
                elif wos_val == "ESCI":
                    sql += " AND wos_core_collection LIKE '%Emerging Sources Citation Index%'"
                    
            # Score filter matching
            if has_score_cols:
                if score_val == "Có điểm IF (BioxBio)":
                    sql += " AND bioxbio_if IS NOT NULL"
                elif score_val == "Có điểm SJR (SCImago)":
                    sql += " AND scimago_sjr IS NOT NULL"
                elif score_val == "Có cả hai điểm":
                    sql += " AND bioxbio_if IS NOT NULL AND scimago_sjr IS NOT NULL"
                elif score_val == "Không có điểm nào":
                    sql += " AND bioxbio_if IS NULL AND scimago_sjr IS NULL"
                    
            # Sort order matching
            if sort_val == "Tên Tạp chí":
                sql += " ORDER BY clarivate_title ASC"
            elif has_score_cols and sort_val == "Điểm IF (Cao -> Thấp)":
                sql += " ORDER BY bioxbio_if DESC"
            elif has_score_cols and sort_val == "Điểm SJR (Cao -> Thấp)":
                sql += " ORDER BY scimago_sjr DESC"
            elif has_score_cols and sort_val == "H-Index (Cao -> Thấp)":
                sql += " ORDER BY scimago_hindex DESC"
            else:
                sql += " ORDER BY publication_id ASC"
                
            sql += " LIMIT 500"
            
            cursor.execute(sql, params)
            rows = cursor.fetchall()
            
            for r in rows:
                pub_id, title, issn, eissn, wos, bb_if, sjr, hindex = r
                
                # Combine ISSNs
                issn_disp = issn or ""
                if eissn:
                    if issn_disp:
                        issn_disp += f" / {eissn}"
                    else:
                        issn_disp = eissn
                        
                wos_disp = wos or "-"
                
                # Format scores clearly
                if bb_if is not None:
                    if_disp = f"{bb_if:.3f}"
                else:
                    if_disp = "-"
                    
                if sjr is not None:
                    sjr_disp = f"{sjr:.3f}"
                else:
                    sjr_disp = "-"
                    
                if hindex is not None:
                    hindex_disp = f"{hindex}"
                else:
                    hindex_disp = "-"
                    
                self.tree.insert("", "end", values=(
                    pub_id, title, issn_disp, wos_disp, if_disp, sjr_disp, hindex_disp
                ))
                
            conn.close()
        except Exception as e:
            print("Error querying database:", e)

    def on_journal_selected(self, event):
        """Fetch and show full details and match details of selected journal in right side panel."""
        selected = self.tree.selection()
        if not selected:
            return
            
        item_values = self.tree.item(selected[0], "values")
        pub_id = item_values[0]
        
        try:
            conn = sqlite3.connect(self.db_file_path, timeout=30.0)
            cursor = conn.cursor()
            
            # Check if columns exist
            cursor.execute("PRAGMA table_info(journals)")
            cols = {row[1] for row in cursor.fetchall()}
            
            has_scores = "bioxbio_if" in cols and "scimago_quartile" in cols and "scimago_source_id" in cols
            
            if has_scores:
                cursor.execute("""
                    SELECT clarivate_title, issn, eissn, publisher, country, wos_core_collection, 
                           additional_wos_indexes, bioxbio_if, bioxbio_year, bioxbio_match, bioxbio_source_id,
                           scimago_sjr, scimago_hindex, scimago_year, scimago_match, scimago_quartile, scimago_source_id
                    FROM journals WHERE publication_id = ?
                """, (pub_id,))
                row = cursor.fetchone()
                
                if row:
                    (c_title, issn, eissn, publisher, country, wos_core, add_wos, 
                     bb_if, bb_yr, bb_match, bb_sid, sjr, hindex, sjr_yr, sjr_match, sjr_q, sjr_sid) = row
                else:
                    conn.close()
                    return
            else:
                cursor.execute("""
                    SELECT clarivate_title, issn, eissn, publisher, country, wos_core_collection, 
                           additional_wos_indexes
                    FROM journals WHERE publication_id = ?
                """, (pub_id,))
                row = cursor.fetchone()
                if row:
                    (c_title, issn, eissn, publisher, country, wos_core, add_wos) = row
                    bb_if = bb_yr = bb_match = bb_sid = sjr = hindex = sjr_yr = sjr_match = sjr_q = sjr_sid = None
                else:
                    conn.close()
                    return
            conn.close()

            # Query historical ranks from original SCImago DB if source_id matched
            sjr_history = []
            if sjr_sid is not None and os.path.exists(self.scimago_db_path):
                try:
                    conn_s = sqlite3.connect(self.scimago_db_path)
                    cursor_s = conn_s.cursor()
                    cursor_s.execute("""
                        SELECT year, sjr_score, sjr_quartile, h_index 
                        FROM rankings 
                        WHERE source_id = ? 
                        ORDER BY year DESC
                    """, (sjr_sid,))
                    sjr_history = cursor_s.fetchall()
                    conn_s.close()
                except Exception as ex:
                    print("Error reading SCImago history:", ex)

            # Query historical ranks from original BioxBio DB if source_id matched
            bb_history = []
            if bb_sid is not None and os.path.exists(self.bioxbio_db_path):
                try:
                    conn_b = sqlite3.connect(self.bioxbio_db_path)
                    cursor_b = conn_b.cursor()
                    cursor_b.execute("""
                        SELECT year, impact_factor, total_articles, total_cites 
                        FROM rankings 
                        WHERE source_id = ? 
                        ORDER BY year DESC
                    """, (bb_sid,))
                    bb_history = cursor_b.fetchall()
                    conn_b.close()
                except Exception as ex:
                    print("Error reading BioxBio history:", ex)

            self.info_text.configure(state="normal")
            self.info_text.delete("1.0", "end")
            
            # Title Header
            self.info_text.insert("end", "=== CHI TIẾT TẠP CHÍ ===\n", "title")
            self.info_text.insert("end", "Tên Tạp chí (Clarivate / WoS):\n", "bold")
            self.info_text.insert("end", f"{c_title}\n\n", "normal")
            
            self.info_text.insert("end", "ID Tạp chí: ", "bold")
            self.info_text.insert("end", f"{pub_id}\n", "normal")
            self.info_text.insert("end", "ISSN: ", "bold")
            self.info_text.insert("end", f"{issn or 'N/A'}\n", "normal")
            self.info_text.insert("end", "eISSN: ", "bold")
            self.info_text.insert("end", f"{eissn or 'N/A'}\n\n", "normal")
            
            self.info_text.insert("end", "Nhà xuất bản (Publisher):\n", "bold")
            self.info_text.insert("end", f"{publisher or 'N/A'}\n\n", "normal")
            self.info_text.insert("end", "Quốc gia: ", "bold")
            self.info_text.insert("end", f"{country or 'N/A'}\n\n", "normal")
            
            # WoS index section
            self.info_text.insert("end", "--- CHỈ MỤC WEB OF SCIENCE (WOS) ---\n", "wos")
            self.info_text.insert("end", "Web of Science Core Collection:\n", "bold")
            self.info_text.insert("end", f"{wos_core or '(Không thuộc nhóm Core)'}\n\n", "normal")
            self.info_text.insert("end", "Các chỉ mục WoS bổ sung khác:\n", "bold")
            self.info_text.insert("end", f"{add_wos or '(Không có)'}\n\n", "normal")
            
            # BioxBio section
            self.info_text.insert("end", "--- ĐỐI KHỚP ĐIỂM IF (BIOXBIO) ---\n", "heading")
            if bb_match == "NOT_FOUND" or bb_match is None:
                self.info_text.insert("end", "Impact Factor (IF): ", "bold")
                self.info_text.insert("end", "N/A\n", "danger")
                self.info_text.insert("end", "(Không tìm thấy trong BioxBio)\n\n", "danger")
            else:
                self.info_text.insert("end", "Impact Factor (IF): ", "bold")
                self.info_text.insert("end", f"{bb_if:.3f}\n", "success")
                self.info_text.insert("end", "Năm ghi nhận IF: ", "bold")
                self.info_text.insert("end", f"{bb_yr}\n", "normal")
                method_name = "Khớp theo mã ISSN" if bb_match == "ISSN" else "Khớp theo Tên chuẩn hóa"
                self.info_text.insert("end", "Phương pháp khớp: ", "bold")
                self.info_text.insert("end", f"{method_name}\n\n", "normal")
                
                # History Table for BioxBio
                if bb_history:
                    self.info_text.insert("end", "Lịch sử chỉ số Impact Factor:\n", "bold")
                    self.info_text.insert("end", f"{'Năm':<6}{'IF':<8}{'Bài báo':<9}{'Trích dẫn':<9}\n", "bold")
                    for yr, iff, art, cit in bb_history:
                        iff_str = f"{iff:.3f}" if iff is not None else "-"
                        art_str = str(art) if art is not None else "-"
                        cit_str = str(cit) if cit is not None else "-"
                        self.info_text.insert("end", f"{yr:<6}{iff_str:<8}{art_str:<9}{cit_str:<9}\n", "normal")
                    self.info_text.insert("end", "\n")
                
            # SCImago section
            self.info_text.insert("end", "--- ĐỐI KHỚP ĐIỂM SJR (SCIMAGO) ---\n", "heading")
            if sjr_match == "NOT_FOUND" or sjr_match is None:
                self.info_text.insert("end", "SCImago Rank (SJR): ", "bold")
                self.info_text.insert("end", "N/A\n", "danger")
                self.info_text.insert("end", "H-Index: ", "bold")
                self.info_text.insert("end", "N/A\n", "danger")
                self.info_text.insert("end", "(Không tìm thấy trong SCImago)\n\n", "danger")
            else:
                self.info_text.insert("end", "SJR Score: ", "bold")
                self.info_text.insert("end", f"{sjr:.3f}", "success")
                if sjr_q:
                    self.info_text.insert("end", f" ({sjr_q})\n", "value")
                else:
                    self.info_text.insert("end", "\n")
                    
                self.info_text.insert("end", "H-Index: ", "bold")
                self.info_text.insert("end", f"{hindex}\n", "success")
                self.info_text.insert("end", "Năm ghi nhận SJR: ", "bold")
                self.info_text.insert("end", f"{sjr_yr}\n", "normal")
                method_name = "Khớp theo mã ISSN" if sjr_match == "ISSN" else "Khớp theo Tên chuẩn hóa"
                self.info_text.insert("end", "Phương pháp khớp: ", "bold")
                self.info_text.insert("end", f"{method_name}\n\n", "normal")
                
                # History Table for SCImago
                if sjr_history:
                    self.info_text.insert("end", "Lịch sử chỉ số SJR & Quartiles:\n", "bold")
                    self.info_text.insert("end", f"{'Năm':<6}{'SJR':<8}{'Hạng (Q)':<11}{'H-Index':<8}\n", "bold")
                    for yr, sjr_val, q_val, h_val in sjr_history:
                        sjr_str = f"{sjr_val:.3f}" if sjr_val is not None else "-"
                        q_str = str(q_val) if q_val is not None else "-"
                        h_str = str(h_val) if h_val is not None else "-"
                        self.info_text.insert("end", f"{yr:<6}{sjr_str:<8}{q_str:<11}{h_str:<8}\n", "normal")
                    self.info_text.insert("end", "\n")
            
            self.info_text.configure(state="disabled")

        except Exception as e:
            print("Error loading journal selected:", e)

if __name__ == "__main__":
    app = ClarivateMappedApp()
    app.mainloop()
