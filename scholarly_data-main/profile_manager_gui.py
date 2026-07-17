import sys
import os
import re
import json
import sqlite3
import webbrowser
import customtkinter as ctk
import tkinter as tk
from tkinter import ttk, messagebox
from profile_db import ProfileDatabase

# Set appearance mode and color theme
ctk.set_appearance_mode("Dark")
ctk.set_default_color_theme("blue")

class ProfileManagerApp(ctk.CTk):
    def __init__(self):
        super().__init__()
        
        self.title("Google Scholar Profile Manager - Tool 6")
        self.geometry("1300x800")
        self.minsize(1100, 700)
        
        self.db = ProfileDatabase()
        
        # Current active state
        self.active_author = None
        self.all_authors = []
        self.filtered_authors = []
        self.current_publications = []
        self.current_filtered_pubs = []
        self.current_selected_pub_idx = -1
        
        # Filter vars
        self.search_filter_var = tk.StringVar()
        self.keyword_filter_var = tk.StringVar()
        self.rank_filter_var = tk.StringVar(value="Tất cả hạng")
        
        self.setup_ui()
        self.load_authors_list()

    def setup_ui(self):
        # Grid Configuration (1 row, 2 main columns: Sidebar (left) and Details (right))
        self.grid_rowconfigure(0, weight=1)
        self.grid_columnconfigure(1, weight=1)
        
        # ----------------- LEFT SIDEBAR -----------------
        self.sidebar_frame = ctk.CTkFrame(self, width=320, corner_radius=0)
        self.sidebar_frame.grid(row=0, column=0, sticky="nsew")
        self.sidebar_frame.grid_rowconfigure(2, weight=1)
        
        # Title
        self.sidebar_title_lbl = ctk.CTkLabel(
            self.sidebar_frame, 
            text="🗂️ Quản lý Hồ sơ", 
            font=ctk.CTkFont(size=20, weight="bold"),
            text_color="#3498db"
        )
        self.sidebar_title_lbl.grid(row=0, column=0, padx=20, pady=(20, 10), sticky="w")
        
        # Search Box
        self.search_bar_frame = ctk.CTkFrame(self.sidebar_frame, fg_color="transparent")
        self.search_bar_frame.grid(row=1, column=0, padx=20, pady=5, sticky="ew")
        self.search_bar_frame.grid_columnconfigure(0, weight=1)
        
        self.search_entry = ctk.CTkEntry(
            self.search_bar_frame, 
            placeholder_text="🔍 Tìm tên tác giả...",
            textvariable=self.search_filter_var
        )
        self.search_entry.grid(row=0, column=0, sticky="ew")
        self.search_filter_var.trace_add("write", self.filter_authors_list)
        
        # Scrollable list for Authors
        self.authors_scroll_frame = ctk.CTkScrollableFrame(self.sidebar_frame, fg_color="transparent")
        self.authors_scroll_frame.grid(row=2, column=0, padx=10, pady=10, sticky="nsew")
        
        # Refresh button at bottom
        self.refresh_btn = ctk.CTkButton(
            self.sidebar_frame, 
            text="🔄 Làm mới danh sách",
            fg_color="#34495e",
            hover_color="#2c3e50",
            command=self.load_authors_list
        )
        self.refresh_btn.grid(row=3, column=0, padx=20, pady=(10, 20), sticky="ew")
        
        # ----------------- MAIN AREA -----------------
        self.main_container = ctk.CTkFrame(self, fg_color="transparent")
        self.main_container.grid(row=0, column=1, sticky="nsew", padx=10, pady=10)
        
        # Placeholder view when no author is selected
        self.placeholder_frame = ctk.CTkFrame(self.main_container, fg_color="transparent")
        self.placeholder_frame.pack(fill="both", expand=True)
        
        self.placeholder_lbl = ctk.CTkLabel(
            self.placeholder_frame, 
            text="👈 Vui lòng chọn một hồ sơ tác giả\ntừ danh sách bên trái để hiển thị thông tin.",
            font=ctk.CTkFont(size=16),
            text_color="gray"
        )
        self.placeholder_lbl.pack(expand=True)
        
        # Actual Author Detail View container (hidden by default)
        self.detail_container = ctk.CTkFrame(self.main_container, fg_color="transparent")
        
        # Full Article Overview View container (hidden by default)
        self.full_article_view_container = ctk.CTkFrame(self.main_container, fg_color="transparent")
        self.setup_full_article_view()
        
        # Inside Detail View: 3 main rows:
        # Row 0: Author Profile Metadata (cards)
        # Row 1: Filter bar
        # Row 2: Publications table and quick-view detail panel
        
        # --- Row 0: Metadata Card ---
        self.meta_card = ctk.CTkFrame(self.detail_container, height=85)
        self.meta_card.pack(fill="x", pady=(0, 10))
        self.meta_card.pack_propagate(False)
        
        # Metadata Layout: Grid inside card
        self.meta_card.grid_columnconfigure(0, weight=3) # Name, Affiliation, Interests
        self.meta_card.grid_columnconfigure((1, 2, 3, 4, 5, 6, 7), weight=1) # 7 small stats cards
        
        # Left meta column
        self.meta_left = ctk.CTkFrame(self.meta_card, fg_color="transparent")
        self.meta_left.grid(row=0, column=0, padx=15, pady=4, sticky="nsew")
        
        self.lbl_auth_name = ctk.CTkLabel(self.meta_left, text="Tên tác giả", font=ctk.CTkFont(size=16, weight="bold"), text_color="#3498db", anchor="w")
        self.lbl_auth_name.pack(anchor="w")
        
        self.lbl_auth_aff = ctk.CTkLabel(self.meta_left, text="Tổ chức / affiliation", font=ctk.CTkFont(size=11), text_color="#bdc3c7", anchor="w", justify="left", wraplength=350)
        self.lbl_auth_aff.pack(anchor="w", pady=1)
        
        self.interests_container = ctk.CTkFrame(self.meta_left, fg_color="transparent")
        self.interests_container.pack(anchor="w")
        
        # Citedby card
        self.card_cite = ctk.CTkFrame(self.meta_card, fg_color="#1abc9c", corner_radius=6)
        self.card_cite.grid(row=0, column=1, padx=4, pady=6, sticky="nsew")
        ctk.CTkLabel(self.card_cite, text="TRÍCH DẪN", font=ctk.CTkFont(size=9, weight="bold"), text_color="#e8f8f5").pack(pady=(6, 0))
        self.lbl_auth_cite = ctk.CTkLabel(self.card_cite, text="0", font=ctk.CTkFont(size=18, weight="bold"))
        self.lbl_auth_cite.pack()
        
        # h-index card
        self.card_h = ctk.CTkFrame(self.meta_card, fg_color="#9b59b6", corner_radius=6)
        self.card_h.grid(row=0, column=2, padx=4, pady=6, sticky="nsew")
        ctk.CTkLabel(self.card_h, text="H-INDEX", font=ctk.CTkFont(size=9, weight="bold"), text_color="#f5eef8").pack(pady=(6, 0))
        self.lbl_auth_h = ctk.CTkLabel(self.card_h, text="0", font=ctk.CTkFont(size=18, weight="bold"))
        self.lbl_auth_h.pack()
        
        # i10-index card
        self.card_i10 = ctk.CTkFrame(self.meta_card, fg_color="#e67e22", corner_radius=6)
        self.card_i10.grid(row=0, column=3, padx=4, pady=6, sticky="nsew")
        ctk.CTkLabel(self.card_i10, text="I10-INDEX", font=ctk.CTkFont(size=9, weight="bold"), text_color="#fdf2e9").pack(pady=(6, 0))
        self.lbl_auth_i10 = ctk.CTkLabel(self.card_i10, text="0", font=ctk.CTkFont(size=18, weight="bold"))
        self.lbl_auth_i10.pack()

        # both ranks card
        self.card_both_ranks = ctk.CTkFrame(self.meta_card, fg_color="#27ae60", corner_radius=6)
        self.card_both_ranks.grid(row=0, column=4, padx=4, pady=6, sticky="nsew")
        ctk.CTkLabel(self.card_both_ranks, text="ĐẦY ĐỦ RANK", font=ctk.CTkFont(size=9, weight="bold"), text_color="#e8f8f5").pack(pady=(6, 0))
        self.lbl_both_ranks = ctk.CTkLabel(self.card_both_ranks, text="0", font=ctk.CTkFont(size=18, weight="bold"))
        self.lbl_both_ranks.pack()

        # one rank card
        self.card_one_rank = ctk.CTkFrame(self.meta_card, fg_color="#2980b9", corner_radius=6)
        self.card_one_rank.grid(row=0, column=5, padx=4, pady=6, sticky="nsew")
        ctk.CTkLabel(self.card_one_rank, text="CÓ 1/2 RANK", font=ctk.CTkFont(size=9, weight="bold"), text_color="#e8f8f5").pack(pady=(6, 0))
        self.lbl_one_rank = ctk.CTkLabel(self.card_one_rank, text="0", font=ctk.CTkFont(size=18, weight="bold"))
        self.lbl_one_rank.pack()

        # no rank card
        self.card_no_rank = ctk.CTkFrame(self.meta_card, fg_color="#7f8c8d", corner_radius=6)
        self.card_no_rank.grid(row=0, column=6, padx=4, pady=6, sticky="nsew")
        ctk.CTkLabel(self.card_no_rank, text="CHƯA RANK", font=ctk.CTkFont(size=9, weight="bold"), text_color="#e8f8f5").pack(pady=(6, 0))
        self.lbl_no_rank = ctk.CTkLabel(self.card_no_rank, text="0", font=ctk.CTkFont(size=18, weight="bold"))
        self.lbl_no_rank.pack()

        # no WoS card
        self.card_no_wos = ctk.CTkFrame(self.meta_card, fg_color="#c0392b", corner_radius=6)
        self.card_no_wos.grid(row=0, column=7, padx=4, pady=6, sticky="nsew")
        ctk.CTkLabel(self.card_no_wos, text="CHƯA WOS", font=ctk.CTkFont(size=9, weight="bold"), text_color="#e8f8f5").pack(pady=(6, 0))
        self.lbl_no_wos = ctk.CTkLabel(self.card_no_wos, text="0", font=ctk.CTkFont(size=18, weight="bold"))
        self.lbl_no_wos.pack()
        
        # --- Row 1: Filter bar ---
        self.filter_bar = ctk.CTkFrame(self.detail_container, height=45)
        self.filter_bar.pack(fill="x", pady=5)
        
        # Title of filter
        ctk.CTkLabel(self.filter_bar, text="🔍 BỘ LỌC BÀI BÁO:", font=ctk.CTkFont(size=12, weight="bold")).pack(side="left", padx=10)
        
        # Keyword Search
        self.keyword_entry = ctk.CTkEntry(
            self.filter_bar, 
            placeholder_text="Từ khóa tên bài báo / tạp chí...",
            textvariable=self.keyword_filter_var,
            width=250
        )
        self.keyword_entry.pack(side="left", padx=5)
        self.keyword_filter_var.trace_add("write", self.apply_pub_filters)
        
        # Rank Option Dropdown
        self.rank_combo = ctk.CTkOptionMenu(
            self.filter_bar, 
            values=["Tất cả hạng", "SJR: Q1", "SJR: Q2", "SJR: Q3", "SJR: Q4", "SJR: N/A"],
            variable=self.rank_filter_var,
            width=130,
            command=lambda v: self.apply_pub_filters()
        )
        self.rank_combo.pack(side="left", padx=5)
        
        self.clear_filter_btn = ctk.CTkButton(
            self.filter_bar, 
            text="Xóa lọc", 
            fg_color="gray", 
            hover_color="#5a6268", 
            width=70,
            command=self.clear_pub_filters
        )
        self.clear_filter_btn.pack(side="left", padx=5)
        
        # Label to show items count
        self.lbl_pubs_count = ctk.CTkLabel(self.filter_bar, text="Đang hiển thị 0/0 bài báo", font=ctk.CTkFont(size=11, slant="italic"))
        self.lbl_pubs_count.pack(side="right", padx=15)
        
        # --- Row 2: Publications Table Layout (2 columns: Table and Quick-View Sidebar) ---
        self.table_main_layout = ctk.CTkFrame(self.detail_container, fg_color="transparent")
        self.table_main_layout.pack(fill="both", expand=True, pady=5)
        self.table_main_layout.grid_rowconfigure(0, weight=1)
        self.table_main_layout.grid_columnconfigure(0, weight=3) # Table
        self.table_main_layout.grid_columnconfigure(1, weight=1) # Details panel
        
        # Table Container
        self.table_container = ctk.CTkFrame(self.table_main_layout, corner_radius=10)
        self.table_container.grid(row=0, column=0, sticky="nsew", padx=(0, 5))
        
        # Style treeview to match Tool 1 style
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
        
        # Create Treeview Table
        columns = ("Title", "Authors", "Venue", "Year", "Cites", "SJR", "IF", "WoS")
        self.tree = ttk.Treeview(self.table_container, columns=columns, show="headings", style="Treeview")
        
        self.tree.heading("Title", text="Tên bài báo", anchor="w")
        self.tree.heading("Authors", text="Tác giả", anchor="w")
        self.tree.heading("Venue", text="Tạp chí/Hội nghị", anchor="w")
        self.tree.heading("Year", text="Năm", anchor="center")
        self.tree.heading("Cites", text="Trích dẫn", anchor="center")
        self.tree.heading("SJR", text="SJR Rank", anchor="center")
        self.tree.heading("IF", text="Impact Factor", anchor="center")
        self.tree.heading("WoS", text="Web of Science", anchor="center")
        
        self.tree.column("Title", width=250, minwidth=150, anchor="w")
        self.tree.column("Authors", width=130, minwidth=100, anchor="w")
        self.tree.column("Venue", width=140, minwidth=100, anchor="w")
        self.tree.column("Year", width=60, minwidth=50, anchor="center")
        self.tree.column("Cites", width=70, minwidth=60, anchor="center")
        self.tree.column("SJR", width=80, minwidth=70, anchor="center")
        self.tree.column("IF", width=95, minwidth=80, anchor="center")
        self.tree.column("WoS", width=130, minwidth=100, anchor="center")
        
        # Highlights tag colors
        self.tree.tag_configure("Q1", foreground="#2ecc71")
        self.tree.tag_configure("Q2", foreground="#f1c40f")
        self.tree.tag_configure("Q3", foreground="#e67e22")
        self.tree.tag_configure("Q4", foreground="#e74c3c")
        self.tree.tag_configure("unranked", foreground="#bdc3c7")
        
        # Add Scrollbars to Table
        vsb = ttk.Scrollbar(self.table_container, orient="vertical", command=self.tree.yview)
        hsb = ttk.Scrollbar(self.table_container, orient="horizontal", command=self.tree.xview)
        self.tree.configure(yscrollcommand=vsb.set, xscrollcommand=hsb.set)
        
        self.tree.grid(row=0, column=0, sticky="nsew")
        vsb.grid(row=0, column=1, sticky="ns")
        hsb.grid(row=1, column=0, sticky="ew")
        
        self.table_container.grid_rowconfigure(0, weight=1)
        self.table_container.grid_columnconfigure(0, weight=1)
        
        # Treeview selection event
        self.tree.bind("<<TreeviewSelect>>", self.on_tree_select)
        
        # ----------------- QUICK-VIEW DETAILS PANEL -----------------
        self.det_panel = ctk.CTkFrame(self.table_main_layout, width=280)
        self.det_panel.grid(row=0, column=1, sticky="nsew", padx=(5, 0))
        self.det_panel.grid_rowconfigure(0, weight=1)
        self.det_panel.grid_columnconfigure(0, weight=1)
        
        # Main scrollable frame inside details panel
        self.det_scroll = ctk.CTkScrollableFrame(self.det_panel, fg_color="transparent")
        self.det_scroll.grid(row=0, column=0, sticky="nsew", padx=10, pady=10)
        
        # Widgets inside Detail Scroll
        ctk.CTkLabel(
            self.det_scroll, 
            text="📋 Xem nhanh chi tiết", 
            font=ctk.CTkFont(size=14, weight="bold"),
            text_color="#3498db"
        ).pack(anchor="w", pady=(0, 10))
        
        # Title
        ctk.CTkLabel(self.det_scroll, text="📌 Tên bài báo:", font=ctk.CTkFont(size=11, weight="bold"), text_color="#95a5a6").pack(anchor="w")
        self.det_title_val = ctk.CTkLabel(
            self.det_scroll, 
            text="Chưa chọn bài báo", 
            font=ctk.CTkFont(size=12, weight="bold"),
            anchor="w", 
            justify="left",
            wraplength=230
        )
        self.det_title_val.pack(anchor="w", pady=(2, 8))
        
        # Authors
        ctk.CTkLabel(self.det_scroll, text="👥 Tác giả:", font=ctk.CTkFont(size=11, weight="bold"), text_color="#95a5a6").pack(anchor="w")
        
        self.authors_container = ctk.CTkFrame(self.det_scroll, fg_color="transparent")
        self.authors_container.pack(anchor="w", fill="x", pady=(2, 8))
        
        self.det_authors_val = ctk.CTkLabel(
            self.authors_container, 
            text="Chưa xác định", 
            font=ctk.CTkFont(size=12),
            anchor="w", 
            justify="left",
            wraplength=140
        )
        self.det_authors_val.pack(side="left", anchor="w")
        
        self.det_authors_btn = ctk.CTkButton(
            self.authors_container, 
            text="Xem thêm",
            width=70, 
            height=20,
            font=ctk.CTkFont(size=10, weight="bold"),
            fg_color="#34495e", 
            hover_color="#2c3e50",
            command=self.show_all_authors
        )
        # Hidden by default
        self.det_authors_btn.pack_forget()
        
        # Venue
        ctk.CTkLabel(self.det_scroll, text="🏢 Tạp chí / Hội nghị:", font=ctk.CTkFont(size=11, weight="bold"), text_color="#95a5a6").pack(anchor="w")
        self.det_venue_val = ctk.CTkLabel(
            self.det_scroll, 
            text="Chưa xác định", 
            font=ctk.CTkFont(size=12),
            anchor="w", 
            justify="left",
            wraplength=230
        )
        self.det_venue_val.pack(anchor="w", pady=(2, 8))
        
        # Year
        ctk.CTkLabel(self.det_scroll, text="📅 Năm xuất bản:", font=ctk.CTkFont(size=11, weight="bold"), text_color="#95a5a6").pack(anchor="w")
        self.det_year_val = ctk.CTkLabel(self.det_scroll, text="N/A", font=ctk.CTkFont(size=12))
        self.det_year_val.pack(anchor="w", pady=(2, 8))
        
        # Citations
        ctk.CTkLabel(self.det_scroll, text="💬 Số trích dẫn:", font=ctk.CTkFont(size=11, weight="bold"), text_color="#95a5a6").pack(anchor="w")
        
        self.citations_container = ctk.CTkFrame(self.det_scroll, fg_color="transparent")
        self.citations_container.pack(anchor="w", fill="x", pady=(2, 8))
        
        self.det_citations_val = ctk.CTkLabel(self.citations_container, text="0", font=ctk.CTkFont(size=12, weight="bold"))
        self.det_citations_val.pack(side="left", anchor="w")
        
        self.det_citations_chart_btn = ctk.CTkButton(
            self.citations_container, 
            text="Xem biểu đồ",
            width=80, 
            height=20,
            font=ctk.CTkFont(size=10, weight="bold"),
            fg_color="#8e44ad", 
            hover_color="#7d3c98",
            command=self.show_publication_citation_chart
        )
        self.det_citations_chart_btn.pack_forget()
        
        # Rank Q
        ctk.CTkLabel(self.det_scroll, text="🏆 Phân hạng (SJR Q):", font=ctk.CTkFont(size=11, weight="bold"), text_color="#95a5a6").pack(anchor="w")
        self.det_rank_val = ctk.CTkLabel(self.det_scroll, text="N/A", font=ctk.CTkFont(size=12, weight="bold"))
        self.det_rank_val.pack(anchor="w", pady=(2, 8))
        
        # IF
        ctk.CTkLabel(self.det_scroll, text="📈 Impact Factor (IF):", font=ctk.CTkFont(size=11, weight="bold"), text_color="#95a5a6").pack(anchor="w")
        self.det_if_val = ctk.CTkLabel(self.det_scroll, text="N/A", font=ctk.CTkFont(size=12, weight="bold"))
        self.det_if_val.pack(anchor="w", pady=(2, 8))
        
        # WoS
        ctk.CTkLabel(self.det_scroll, text="🔍 Web of Science (WoS):", font=ctk.CTkFont(size=11, weight="bold"), text_color="#95a5a6").pack(anchor="w")
        self.det_wos_val = ctk.CTkLabel(
            self.det_scroll, 
            text="N/A", 
            font=ctk.CTkFont(size=11, weight="bold"),
            justify="left",
            wraplength=230
        )
        self.det_wos_val.pack(anchor="w", pady=(2, 8))
        
        # Full View Button
        self.det_full_view_btn = ctk.CTkButton(
            self.det_scroll, 
            text="🖥️ XEM TỔNG QUAN BÀI BÁO",
            font=ctk.CTkFont(weight="bold"),
            fg_color="#1abc9c", 
            hover_color="#16a085",
            command=self.show_full_article_view
        )
        self.det_full_view_btn.pack_forget()

    # ----------------- AUTHORS LIST POPULATION -----------------
    def load_authors_list(self):
        # Clear existing author items in sidebar
        for widget in self.authors_scroll_frame.winfo_children():
            widget.destroy()
            
        self.all_authors = self.db.get_all_authors()
        self.filter_authors_list()

    def filter_authors_list(self, *args):
        search_query = self.search_filter_var.get().strip().lower()
        
        # Clear widgets in scroll frame
        for widget in self.authors_scroll_frame.winfo_children():
            widget.destroy()
            
        self.filtered_authors = []
        for author in self.all_authors:
            if not search_query or search_query in author["name"].lower():
                self.filtered_authors.append(author)
                
        if not self.filtered_authors:
            lbl = ctk.CTkLabel(self.authors_scroll_frame, text="Không tìm thấy hồ sơ nào", font=ctk.CTkFont(size=12, slant="italic"), text_color="gray")
            lbl.pack(pady=20)
            return
            
        # Draw author items
        for author in self.filtered_authors:
            self.draw_author_item(author)

    def draw_author_item(self, author):
        scholar_id = author["scholar_id"]
        is_active = (self.active_author and self.active_author["scholar_id"] == scholar_id)
        
        # Card container
        border_color = "#3498db" if is_active else None
        border_width = 1 if is_active else 0
        card = ctk.CTkFrame(
            self.authors_scroll_frame,
            fg_color="#2c3e50" if is_active else "#1e272e",
            border_color=border_color,
            border_width=border_width,
            corner_radius=8
        )
        card.pack(fill="x", pady=4, padx=5)
        
        # Clicking details
        def on_click(event=None):
            self.select_author(author)
            
        # Bind click to card and name
        card.bind("<Button-1>", on_click)
        
        name_lbl = ctk.CTkLabel(
            card,
            text=author["name"],
            font=ctk.CTkFont(size=13, weight="bold"),
            text_color="#3498db" if is_active else "white",
            anchor="w",
            cursor="hand2"
        )
        name_lbl.pack(anchor="w", padx=12, pady=(10, 2))
        name_lbl.bind("<Button-1>", on_click)
        
        aff_lbl = ctk.CTkLabel(
            card,
            text=author["affiliation"] or "Không có tổ chức",
            font=ctk.CTkFont(size=11),
            text_color="#95a5a6",
            anchor="w",
            justify="left",
            wraplength=270,
            cursor="hand2"
        )
        aff_lbl.pack(anchor="w", padx=12, pady=(0, 6))
        aff_lbl.bind("<Button-1>", on_click)
        
        # Small buttons row
        btn_frame = ctk.CTkFrame(card, fg_color="transparent")
        btn_frame.pack(fill="x", padx=12, pady=(0, 10))
        
        # Scholar Link Button
        if scholar_id and not scholar_id.startswith("local_"):
            link_url = f"https://scholar.google.com/citations?user={scholar_id}"
            def open_link(url=link_url):
                webbrowser.open(url)
            
            link_btn = ctk.CTkButton(
                btn_frame,
                text="🌐 Google Scholar",
                font=ctk.CTkFont(size=10),
                fg_color="#27ae60",
                hover_color="#218c53",
                width=100,
                height=18,
                command=open_link
            )
            link_btn.pack(side="left")
            
        # Delete Profile Button
        def delete_profile(sid=scholar_id, name=author["name"]):
            confirm = messagebox.askyesno("Xác nhận xóa", f"Bạn có chắc muốn xóa hồ sơ của tác giả '{name}' khỏi CSDL Tool 6?")
            if confirm:
                if self.db.delete_author(sid):
                    messagebox.showinfo("Thành công", f"Đã xóa hồ sơ tác giả '{name}'.")
                    if self.active_author and self.active_author["scholar_id"] == sid:
                        self.active_author = None
                        self.show_placeholder()
                    self.load_authors_list()
                else:
                    messagebox.showerror("Lỗi", "Không thể xóa hồ sơ tác giả.")
                    
        del_btn = ctk.CTkButton(
            btn_frame,
            text="🗑️ Xóa",
            font=ctk.CTkFont(size=10, weight="bold"),
            fg_color="#c0392b",
            hover_color="#a0281c",
            width=50,
            height=18,
            command=delete_profile
        )
        del_btn.pack(side="right")

    # ----------------- SELECTION & LOAD DETAIL -----------------
    def select_author(self, author):
        self.active_author = author
        
        # Hide placeholder & show detail
        self.placeholder_frame.pack_forget()
        self.detail_container.pack(fill="both", expand=True)
        
        # Highlight select author in sidebar by reloading list visually
        # (This is lightweight since we just change background of widgets)
        for widget in self.authors_scroll_frame.winfo_children():
            if isinstance(widget, ctk.CTkFrame):
                # Search for correct frame
                labels = [w for w in widget.winfo_children() if isinstance(w, ctk.CTkLabel)]
                if labels and labels[0].cget("text") == author["name"]:
                    widget.configure(fg_color="#2c3e50", border_color="#3498db", border_width=1)
                    labels[0].configure(text_color="#3498db")
                else:
                    widget.configure(fg_color="#1e272e", border_width=0)
                    if labels:
                        labels[0].configure(text_color="white")
                        
        # Load meta values
        self.lbl_auth_name.configure(text=author["name"])
        self.lbl_auth_aff.configure(text=author["affiliation"] or "Không có thông tin tổ chức")
        self.lbl_auth_cite.configure(text=str(author["citedby"]))
        self.lbl_auth_h.configure(text=str(author["hindex"]))
        self.lbl_auth_i10.configure(text=str(author["i10index"]))
        
        # Draw Interests tags
        for w in self.interests_container.winfo_children():
            w.destroy()
            
        interests = author["interests"]
        if interests:
            for idx, tag in enumerate(interests[:5]): # Show up to 5 interests
                tag_lbl = ctk.CTkLabel(
                    self.interests_container,
                    text=f" #{tag} ",
                    font=ctk.CTkFont(size=10, weight="bold"),
                    text_color="#3498db",
                    fg_color="#1b4f72",
                    corner_radius=4
                )
                tag_lbl.pack(side="left", padx=3)
                
        # Clear filter vars
        self.keyword_filter_var.set("")
        self.rank_filter_var.set("Tất cả hạng")
        
        # Fetch publications
        self.current_publications = self.db.get_author_publications(author["scholar_id"])
        self.calculate_extra_stats()
        self.apply_pub_filters()
        
        # Reset detail panel
        self.reset_detail_panel()

    def show_placeholder(self):
        self.detail_container.pack_forget()
        self.placeholder_frame.pack(fill="both", expand=True)

    def reset_detail_panel(self):
        self.current_selected_pub_idx = -1
        self.det_title_val.configure(text="Chưa chọn bài báo")
        self.det_authors_val.configure(text="Chưa xác định")
        self.det_authors_btn.pack_forget()
        self.det_venue_val.configure(text="Chưa xác định")
        self.det_year_val.configure(text="N/A")
        self.det_citations_val.configure(text="0")
        self.det_citations_chart_btn.pack_forget()
        self.det_rank_val.configure(text="N/A", text_color="white")
        self.det_if_val.configure(text="N/A")
        self.det_wos_val.configure(text="N/A")
        if hasattr(self, 'det_full_view_btn'):
            self.det_full_view_btn.pack_forget()

    # ----------------- PUBLICATIONS FILTER & TABLE -----------------
    def apply_pub_filters(self, *args):
        keyword = self.keyword_filter_var.get().strip().lower()
        selected_rank = self.rank_filter_var.get()
        
        self.current_filtered_pubs = []
        for pub in self.current_publications:
            # Keyword filter
            if keyword:
                title_match = keyword in pub["title"].lower()
                venue_match = keyword in pub["venue"].lower()
                author_match = keyword in pub["authors"].lower()
                if not (title_match or venue_match or author_match):
                    continue
                    
            # Rank filter
            if selected_rank != "Tất cả hạng":
                sjr_q = pub["sjr_q"]
                if selected_rank == "SJR: Q1" and sjr_q != "Q1":
                    continue
                elif selected_rank == "SJR: Q2" and sjr_q != "Q2":
                    continue
                elif selected_rank == "SJR: Q3" and sjr_q != "Q3":
                    continue
                elif selected_rank == "SJR: Q4" and sjr_q != "Q4":
                    continue
                elif selected_rank == "SJR: N/A" and sjr_q not in ("N/A", "", None):
                    continue
                    
            self.current_filtered_pubs.append(pub)
            
        # Draw table
        self.display_publications()

    def clear_pub_filters(self):
        self.keyword_filter_var.set("")
        self.rank_filter_var.set("Tất cả hạng")
        self.apply_pub_filters()

    def display_publications(self):
        # Clear existing rows
        for item in self.tree.get_children():
            self.tree.delete(item)
            
        total = len(self.current_publications)
        filtered = len(self.current_filtered_pubs)
        self.lbl_pubs_count.configure(text=f"Đang hiển thị {filtered}/{total} bài báo")
        
        for idx, pub in enumerate(self.current_filtered_pubs):
            # Abbreviate authors list for clean view in table
            authors_raw = pub["authors"]
            author_list = [a.strip() for a in re.split(r'\s+and\s+|,', authors_raw) if a.strip()]
            if author_list and author_list[-1] in ('...', '…'):
                author_list.pop()
            if len(author_list) > 3:
                authors_clean = ", ".join(author_list[:3]) + "..."
            else:
                authors_clean = ", ".join(author_list)
                
            # Assign Q tags for color highlights
            sjr_q = pub["sjr_q"]
            if sjr_q in ("Q1", "Q2", "Q3", "Q4"):
                tag = sjr_q
                sjr_display = sjr_q
            else:
                tag = "unranked"
                sjr_display = "N/A"
                
            self.tree.insert(
                "",
                "end",
                iid=str(idx),
                values=(
                    pub["title"],
                    authors_clean,
                    pub["venue"],
                    pub["year"],
                    pub["citations"],
                    sjr_display,
                    pub["if_val"],
                    pub["wos"]
                ),
                tags=(tag,)
            )

    # ----------------- TABLE EVENT & SIDEBAR UPDATE -----------------
    def on_tree_select(self, event=None):
        selection = self.tree.selection()
        if not selection:
            return
            
        idx = int(selection[0])
        self.current_selected_pub_idx = idx
        pub = self.current_filtered_pubs[idx]
        
        # Update details values
        self.det_title_val.configure(text=pub["title"])
        self.det_venue_val.configure(text=pub["venue"])
        self.det_year_val.configure(text=str(pub["year"]))
        self.det_citations_val.configure(text=str(pub["citations"]))
        
        # Display authors abbreviation and Show More button
        authors = pub["authors"]
        author_list = [a.strip() for a in re.split(r'\s+and\s+|,', authors) if a.strip()]
        if author_list and author_list[-1] in ('...', '…'):
            author_list.pop()
            
        if len(author_list) > 2:
            self.det_authors_val.configure(text=", ".join(author_list[:2]) + "...")
            self.det_authors_btn.pack(side="left", padx=5)
        else:
            self.det_authors_val.configure(text=", ".join(author_list))
            self.det_authors_btn.pack_forget()
            
        # Display citation chart button if citations > 0 and has cites data
        cites_data = pub.get("cites_per_year")
        if not isinstance(cites_data, dict):
            cites_data = {}
        if cites_data and sum(cites_data.values()) > 0:
            self.det_citations_chart_btn.pack(side="left", padx=8)
        else:
            self.det_citations_chart_btn.pack_forget()
            
        # Ranks
        sjr = pub["sjr_q"]
        if sjr == "Q1":
            self.det_rank_val.configure(text="SJR: Q1 (Xuất sắc)", text_color="#2ecc71")
        elif sjr == "Q2":
            self.det_rank_val.configure(text="SJR: Q2 (Tốt)", text_color="#f1c40f")
        elif sjr == "Q3":
            self.det_rank_val.configure(text="SJR: Q3 (Trung bình)", text_color="#e67e22")
        elif sjr == "Q4":
            self.det_rank_val.configure(text="SJR: Q4 (Khá)", text_color="#e74c3c")
        else:
            self.det_rank_val.configure(text="N/A", text_color="#bdc3c7")
            
        self.det_if_val.configure(text=pub["if_val"])
        self.det_wos_val.configure(text=pub["wos"])
        
        if hasattr(self, 'det_full_view_btn'):
            self.det_full_view_btn.pack(fill="x", pady=(15, 5))

    # ----------------- SHOW DIALOGS (AUTHORS & CITATION HISTORY) -----------------
    def show_all_authors(self):
        if self.current_selected_pub_idx < 0:
            return
        pub = self.current_filtered_pubs[self.current_selected_pub_idx]
        
        dialog = ctk.CTkToplevel(self)
        dialog.title("Danh sách Tác giả đầy đủ")
        dialog.geometry("500x360")
        dialog.grab_set()
        dialog.resizable(False, False)
        
        dialog.update_idletasks()
        x = self.winfo_x() + (self.winfo_width() - dialog.winfo_width()) // 2
        y = self.winfo_y() + (self.winfo_height() - dialog.winfo_height()) // 2
        dialog.geometry(f"+{x}+{y}")
        
        ctk.CTkLabel(
            dialog, 
            text="👥 Danh sách Tác giả đầy đủ", 
            font=ctk.CTkFont(size=14, weight="bold"),
            text_color="#3498db"
        ).pack(pady=(15, 5))
        
        textbox = ctk.CTkTextbox(dialog, width=460, height=220, font=ctk.CTkFont(size=12))
        textbox.pack(pady=10, padx=20, fill="both", expand=True)
        
        authors_raw = pub["authors"]
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
        if self.current_selected_pub_idx < 0:
            return
        pub = self.current_filtered_pubs[self.current_selected_pub_idx]
        cites_data = pub.get("cites_per_year")
        if not isinstance(cites_data, dict):
            cites_data = {}
        
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
            text=pub['title'], 
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
            title = f"Tổng số trích dẫn bài báo này: {pub['citations']} trích dẫn"
            self.draw_bar_chart(canvas, data, title, "#8e44ad")
            
        canvas.bind("<Configure>", on_configure)

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

    def calculate_extra_stats(self):
        both_ranks = 0
        one_rank = 0
        no_rank = 0
        no_wos = 0
        
        for pub in self.current_publications:
            sjr = pub.get("sjr_q", "N/A")
            if_val = pub.get("if_val", "N/A")
            wos = pub.get("wos", "N/A")
            
            has_sjr = sjr in ("Q1", "Q2", "Q3", "Q4")
            has_if = if_val != "N/A" and if_val != "" and if_val is not None
            has_wos = wos != "N/A" and wos != "" and wos is not None
            
            if has_sjr and has_if:
                both_ranks += 1
            elif has_sjr or has_if:
                one_rank += 1
            else:
                no_rank += 1
                
            if not has_wos:
                no_wos += 1
                
        self.lbl_both_ranks.configure(text=str(both_ranks))
        self.lbl_one_rank.configure(text=str(one_rank))
        self.lbl_no_rank.configure(text=str(no_rank))
        self.lbl_no_wos.configure(text=str(no_wos))

    def setup_full_article_view(self):
        # Back button
        self.full_back_btn = ctk.CTkButton(
            self.full_article_view_container,
            text="⬅️ Quay lại danh sách",
            font=ctk.CTkFont(weight="bold"),
            fg_color="#34495e",
            hover_color="#2c3e50",
            command=self.hide_full_article_view,
            width=170
        )
        self.full_back_btn.pack(anchor="w", pady=(5, 15))
        
        # Grid container (2 columns)
        self.full_grid = ctk.CTkFrame(self.full_article_view_container, fg_color="transparent")
        self.full_grid.pack(fill="both", expand=True)
        self.full_grid.grid_rowconfigure(0, weight=1)
        self.full_grid.grid_columnconfigure(0, weight=1) # Left meta
        self.full_grid.grid_columnconfigure(1, weight=1) # Right chart
        
        # Left Panel (Scrollable Details)
        self.full_left_scroll = ctk.CTkScrollableFrame(self.full_grid, fg_color="#1e272e", corner_radius=10)
        self.full_left_scroll.grid(row=0, column=0, sticky="nsew", padx=(0, 10))
        
        # Title of publication (Large)
        self.full_title_lbl = ctk.CTkLabel(
            self.full_left_scroll, 
            text="Tiêu đề bài báo", 
            font=ctk.CTkFont(size=16, weight="bold"),
            text_color="#3498db",
            anchor="w",
            justify="left",
            wraplength=450
        )
        self.full_title_lbl.pack(anchor="w", padx=15, pady=(15, 10))
        
        # 5 Stats Cards in a grid
        self.full_stats_grid = ctk.CTkFrame(self.full_left_scroll, fg_color="transparent")
        self.full_stats_grid.pack(fill="x", padx=15, pady=5)
        self.full_stats_grid.grid_columnconfigure((0, 1), weight=1)
        
        # Card 1: Citations
        self.full_card_cites = ctk.CTkFrame(self.full_stats_grid, fg_color="#16a085", height=60)
        self.full_card_cites.grid(row=0, column=0, padx=5, pady=5, sticky="ew")
        ctk.CTkLabel(self.full_card_cites, text="SỐ TRÍCH DẪN", font=ctk.CTkFont(size=9, weight="bold")).pack(pady=(8, 0))
        self.full_cite_val = ctk.CTkLabel(self.full_card_cites, text="0", font=ctk.CTkFont(size=16, weight="bold"))
        self.full_cite_val.pack()
        
        # Card 2: Year
        self.full_card_year = ctk.CTkFrame(self.full_stats_grid, fg_color="#e67e22", height=60)
        self.full_card_year.grid(row=0, column=1, padx=5, pady=5, sticky="ew")
        ctk.CTkLabel(self.full_card_year, text="NĂM XUẤT BẢN", font=ctk.CTkFont(size=9, weight="bold")).pack(pady=(8, 0))
        self.full_year_val = ctk.CTkLabel(self.full_card_year, text="N/A", font=ctk.CTkFont(size=16, weight="bold"))
        self.full_year_val.pack()
        
        # Card 3: SJR Rank
        self.full_card_sjr = ctk.CTkFrame(self.full_stats_grid, fg_color="#2980b9", height=60)
        self.full_card_sjr.grid(row=1, column=0, padx=5, pady=5, sticky="ew")
        ctk.CTkLabel(self.full_card_sjr, text="PHÂN HẠNG SJR", font=ctk.CTkFont(size=9, weight="bold")).pack(pady=(8, 0))
        self.full_sjr_val = ctk.CTkLabel(self.full_card_sjr, text="N/A", font=ctk.CTkFont(size=15, weight="bold"))
        self.full_sjr_val.pack()
        
        # Card 4: Impact Factor
        self.full_card_if = ctk.CTkFrame(self.full_stats_grid, fg_color="#8e44ad", height=60)
        self.full_card_if.grid(row=1, column=1, padx=5, pady=5, sticky="ew")
        ctk.CTkLabel(self.full_card_if, text="IMPACT FACTOR (IF)", font=ctk.CTkFont(size=9, weight="bold")).pack(pady=(8, 0))
        self.full_if_val = ctk.CTkLabel(self.full_card_if, text="N/A", font=ctk.CTkFont(size=15, weight="bold"))
        self.full_if_val.pack()
        
        # Card 5: Web of Science
        self.full_card_wos = ctk.CTkFrame(self.full_left_scroll, fg_color="#2c3e50", height=65)
        self.full_card_wos.pack(fill="x", padx=20, pady=10)
        self.full_card_wos.pack_propagate(False)
        ctk.CTkLabel(self.full_card_wos, text="WEB OF SCIENCE (WOS)", font=ctk.CTkFont(size=9, weight="bold"), text_color="#bdc3c7").pack(pady=(6, 0))
        self.full_wos_val = ctk.CTkLabel(self.full_card_wos, text="N/A", font=ctk.CTkFont(size=12, weight="bold"), wraplength=400)
        self.full_wos_val.pack()
        
        # Journal/Conference Name
        ctk.CTkLabel(self.full_left_scroll, text="🏢 Nơi công bố (Tạp chí / Hội nghị):", font=ctk.CTkFont(size=11, weight="bold"), text_color="#95a5a6").pack(anchor="w", padx=20, pady=(15, 2))
        self.full_venue_val = ctk.CTkLabel(self.full_left_scroll, text="N/A", font=ctk.CTkFont(size=13, weight="bold"), justify="left", wraplength=440)
        self.full_venue_val.pack(anchor="w", padx=20, pady=(0, 10))
        
        # All Authors Box
        ctk.CTkLabel(self.full_left_scroll, text="👥 Danh sách tác giả đầy đủ:", font=ctk.CTkFont(size=11, weight="bold"), text_color="#95a5a6").pack(anchor="w", padx=20, pady=(10, 2))
        self.full_authors_textbox = ctk.CTkTextbox(self.full_left_scroll, height=130, font=ctk.CTkFont(size=12))
        self.full_authors_textbox.pack(fill="x", padx=20, pady=5)
        
        # Right Panel (Large chart area)
        self.full_right_panel = ctk.CTkFrame(self.full_grid, fg_color="#1a1c1d", corner_radius=10)
        self.full_right_panel.grid(row=0, column=1, sticky="nsew", padx=(10, 0))
        self.full_right_panel.grid_rowconfigure(0, weight=1)
        self.full_right_panel.grid_columnconfigure(0, weight=1)
        
        self.full_chart_canvas = tk.Canvas(self.full_right_panel, bg="#1a1c1d", highlightthickness=0)
        self.full_chart_canvas.grid(row=0, column=0, sticky="nsew", padx=15, pady=15)

    def show_full_article_view(self):
        if self.current_selected_pub_idx < 0:
            return
        pub = self.current_filtered_pubs[self.current_selected_pub_idx]
        
        # Populate full view values
        self.full_title_lbl.configure(text=pub["title"])
        self.full_cite_val.configure(text=str(pub["citations"]))
        self.full_year_val.configure(text=str(pub["year"]))
        
        sjr = pub["sjr_q"]
        if sjr == "Q1":
            self.full_sjr_val.configure(text="Q1 (Xuất sắc)", text_color="#2ecc71")
        elif sjr == "Q2":
            self.full_sjr_val.configure(text="Q2 (Tốt)", text_color="#f1c40f")
        elif sjr == "Q3":
            self.full_sjr_val.configure(text="Q3 (Trung bình)", text_color="#e67e22")
        elif sjr == "Q4":
            self.full_sjr_val.configure(text="Q4 (Khá)", text_color="#e74c3c")
        else:
            self.full_sjr_val.configure(text="N/A", text_color="#bdc3c7")
            
        self.full_if_val.configure(text=pub["if_val"])
        self.full_wos_val.configure(text=pub["wos"])
        self.full_venue_val.configure(text=pub["venue"])
        
        # Format and insert authors list in textbox
        self.full_authors_textbox.configure(state="normal")
        self.full_authors_textbox.delete("1.0", tk.END)
        authors_raw = pub["authors"]
        author_list = [a.strip() for a in re.split(r'\s+and\s+|,', authors_raw) if a.strip()]
        if author_list and author_list[-1] in ('...', '…'):
            author_list.pop()
        formatted_authors = "\n".join([f"{idx+1}. {author}" for idx, author in enumerate(author_list)])
        self.full_authors_textbox.insert("1.0", formatted_authors)
        self.full_authors_textbox.configure(state="disabled")
        
        # Toggle screens
        self.detail_container.pack_forget()
        self.full_article_view_container.pack(fill="both", expand=True)
        
        # Redraw chart dynamically on Canvas after configure event
        cites_data = pub.get("cites_per_year")
        if not isinstance(cites_data, dict):
            cites_data = {}
            
        def on_full_configure(event):
            if not cites_data:
                self.full_chart_canvas.delete("all")
                w = self.full_chart_canvas.winfo_width()
                h = self.full_chart_canvas.winfo_height()
                self.full_chart_canvas.create_text(w/2, h/2, text="Không có dữ liệu trích dẫn chi tiết theo năm", fill="gray", font=("Arial", 11))
                return
            sorted_keys = sorted(cites_data.keys())
            data = {str(year): cites_data[year] for year in sorted_keys}
            title = f"Biểu đồ trích dẫn lịch sử theo năm (Tổng số: {pub['citations']} trích dẫn)"
            self.draw_bar_chart(self.full_chart_canvas, data, title, "#9b59b6")
            
        self.full_chart_canvas.bind("<Configure>", on_full_configure)
        # Manually trigger configure once
        self.full_article_view_container.update_idletasks()
        on_full_configure(None)

    def hide_full_article_view(self):
        self.full_article_view_container.pack_forget()
        self.detail_container.pack(fill="both", expand=True)

if __name__ == "__main__":
    app = ProfileManagerApp()
    app.mainloop()
