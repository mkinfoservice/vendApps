#!/usr/bin/env python3
"""
VendApps — Enriquecimento de Imagens (GUI)
==========================================
Interface gráfica para buscar e aplicar imagens em produtos sem foto.

DEPENDÊNCIAS:
    pip install requests duckduckgo-search pillow

GERAR EXE:
    pip install pyinstaller
    pyinstaller --onefile --windowed --name "VendApps Imagens" enrich_images_gui.py
"""

import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import threading
import csv
import io
import re
import requests

try:
    from PIL import Image, ImageTk
    PIL_OK = True
except ImportError:
    PIL_OK = False

# ── Configurações ─────────────────────────────────────────────────────────────
API_BASE   = "https://vendapps.onrender.com"
IMG_SIZE   = 150   # pixels do thumbnail
IMG_COLS   = 4     # colunas no grid de imagens
PAGE_SIZE  = 200

# ── Busca de imagens ──────────────────────────────────────────────────────────

def _simplify(name: str) -> str:
    """Remove doses/pesos e mantém os 5 tokens mais relevantes para busca."""
    clean = re.sub(r'\b\d+\s*(mg|ml|g|kg|mcg|ui|un|unid|comp|cpr|caps|tab)\b', '', name, flags=re.I)
    clean = re.sub(r'[^\w\s]', ' ', clean)
    words = [w for w in clean.split() if len(w) >= 3][:5]
    return " ".join(words).strip() or name


def search_ml(query: str, barcode: str | None = None, n: int = 5) -> list[str]:
    """Mercado Livre — funciona perfeitamente de IP doméstico/comercial."""
    headers = {"User-Agent": "Mozilla/5.0 (compatible; vendApps-local/1.0)"}
    urls = []

    for q in ([barcode] if barcode else []) + [query]:
        try:
            sr = requests.get("https://api.mercadolibre.com/sites/MLB/search",
                              params={"q": q, "limit": n}, headers=headers, timeout=10)
            if not sr.ok:
                continue
            results = sr.json().get("results", [])
            if not results:
                continue

            # Batch: busca fotos em alta resolução
            ids = ",".join(r["id"] for r in results)
            br = requests.get(f"https://api.mercadolibre.com/items?ids={ids}",
                              headers=headers, timeout=10)
            if br.ok:
                for entry in br.json():
                    if entry.get("code") == 200 and entry.get("body"):
                        for pic in entry["body"].get("pictures", []):
                            u = pic.get("secure_url") or pic.get("url", "")
                            if u:
                                urls.append(u)

            # Fallback para thumbnails upscalados
            if not urls:
                for r in results:
                    t = r.get("thumbnail", "")
                    if t:
                        urls.append(t.replace("-I.", "-F.").replace("-O.", "-F."))

            if urls:
                break
        except Exception:
            continue

    return urls[:10]


def search_bing(query: str, n: int = 8) -> list[str]:
    """Bing Images — scraping com headers realistas."""
    try:
        headers = {
            "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                           "AppleWebKit/537.36 (KHTML, like Gecko) "
                           "Chrome/124.0.0.0 Safari/537.36"),
            "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
            "Referer": "https://www.bing.com/",
        }
        r = requests.get("https://www.bing.com/images/search",
                         params={"q": query, "form": "HDRSC2", "first": 1},
                         headers=headers, timeout=12)
        urls = re.findall(r'"murl":"(https?://[^"]+)"', r.text)
        # Filtra GIFs e thumbs muito pequenos
        return [u for u in urls if not u.endswith(".gif")][:n]
    except Exception:
        return []


def search_ddg(query: str, n: int = 8) -> list[str]:
    """DuckDuckGo Images."""
    try:
        try:
            from ddgs import DDGS
        except ImportError:
            from duckduckgo_search import DDGS
        with DDGS() as ddgs:
            results = list(ddgs.images(query, max_results=n))
        return [r["image"] for r in results if r.get("image")]
    except Exception:
        return []


def find_images(name: str, barcode: str | None = None) -> list[str]:
    """
    Busca em múltiplas fontes em cascata:
      1. Mercado Livre (melhor cobertura para produtos BR)
      2. Bing Images
      3. DuckDuckGo
    Usa nome simplificado para evitar queries muito específicas.
    """
    simple = _simplify(name)
    seen, result = set(), []

    def add(urls):
        for u in (urls or []):
            if u and u not in seen and u.startswith("http"):
                seen.add(u)
                result.append(u)

    # 1. Mercado Livre
    add(search_ml(simple, barcode))
    if len(result) >= 8:
        return result[:12]

    # 2. Bing
    add(search_bing(simple))
    if len(result) >= 8:
        return result[:12]

    # 3. DuckDuckGo
    add(search_ddg(simple))

    # 4. Tenta com nome completo se ainda poucos resultados
    if len(result) < 4 and simple != name:
        add(search_bing(name))
        add(search_ddg(name))

    return result[:12]

# ── API vendApps ──────────────────────────────────────────────────────────────

def api_get_products(token: str) -> list[dict]:
    all_items, page = [], 1
    while True:
        r = requests.get(f"{API_BASE}/admin/products",
                         params={"page": page, "pageSize": PAGE_SIZE},
                         headers={"Authorization": f"Bearer {token}"}, timeout=20)
        r.raise_for_status()
        data  = r.json()
        items = data.get("items", [])
        all_items.extend(p for p in items if not p.get("imageUrl"))
        if (page - 1) * PAGE_SIZE + len(items) >= data.get("total", 0) or len(items) < PAGE_SIZE:
            break
        page += 1
    return all_items

def api_apply_image(product_id: str, url: str, token: str) -> bool:
    r = requests.put(
        f"{API_BASE}/admin/enrichment/products/{product_id}/image",
        json={"url": url},
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        timeout=15)
    return r.status_code == 200

def fetch_photo(url: str) -> "ImageTk.PhotoImage | None":
    if not PIL_OK:
        return None
    try:
        r = requests.get(url, timeout=8)
        r.raise_for_status()
        img = Image.open(io.BytesIO(r.content)).convert("RGBA")
        img.thumbnail((IMG_SIZE, IMG_SIZE), Image.Resampling.LANCZOS)
        bg = Image.new("RGBA", (IMG_SIZE, IMG_SIZE), (248, 248, 250, 255))
        bg.paste(img, ((IMG_SIZE - img.width) // 2, (IMG_SIZE - img.height) // 2))
        return ImageTk.PhotoImage(bg)
    except Exception:
        return None

# ── App ───────────────────────────────────────────────────────────────────────

class App(tk.Tk):
    BG      = "#f5f5f7"
    SIDEBAR = "#1c1c2e"
    ACCENT  = "#7c5cf8"
    GREEN   = "#22c55e"
    GRAY    = "#94a3b8"

    def __init__(self):
        super().__init__()
        self.title("VendApps · Enriquecimento de Imagens")
        self.geometry("1150x720")
        self.minsize(900, 600)
        self.configure(bg=self.BG)

        self.token   = tk.StringVar()
        self.products: list[dict] = []
        self.current  = -1
        self.n_applied = 0
        self.n_skipped = 0
        self._photos: list = []   # mantém referências p/ evitar GC

        self._build()

    # ── Layout ────────────────────────────────────────────────────────────────

    def _build(self):
        # ── Top bar ──
        top = tk.Frame(self, bg=self.SIDEBAR, pady=10)
        top.pack(fill="x")

        tk.Label(top, text="VendApps · Imagens",
                 font=("Segoe UI", 11, "bold"), bg=self.SIDEBAR, fg="white"
                 ).pack(side="left", padx=16)

        tk.Label(top, text="Token JWT:", bg=self.SIDEBAR, fg=self.GRAY,
                 font=("Segoe UI", 9)).pack(side="left", padx=(24, 4))
        tk.Entry(top, textvariable=self.token, width=60, show="•",
                 font=("Consolas", 9), relief="flat", bg="#2d2d44", fg="white",
                 insertbackground="white").pack(side="left", ipady=4, padx=(0, 8))

        self._status_lbl = tk.Label(top, text="", bg=self.SIDEBAR,
                                    fg=self.GREEN, font=("Segoe UI", 9))
        self._status_lbl.pack(side="right", padx=16)

        # ── Source bar ──
        src = tk.Frame(self, bg="#2d2d44", pady=7)
        src.pack(fill="x")

        self._btn(src, "📡  Carregar da API",   "#89b4fa", self._load_api).pack(side="left", padx=8)
        self._btn(src, "📂  Abrir CSV",          "#a6e3a1", self._load_csv).pack(side="left", padx=4)
        self._btn(src, "💾  Exportar CSV",        "#fab387", self._export_csv).pack(side="left", padx=4)

        self._src_info = tk.Label(src, text="", bg="#2d2d44", fg=self.GRAY,
                                  font=("Segoe UI", 9))
        self._src_info.pack(side="right", padx=14)

        # ── Main area ──
        pane = tk.PanedWindow(self, orient="horizontal", bg=self.BG,
                              sashwidth=6, sashrelief="flat")
        pane.pack(fill="both", expand=True, padx=10, pady=8)

        # Left: list
        left = tk.Frame(pane, bg=self.BG, width=280)
        pane.add(left, minsize=220)

        tk.Label(left, text="PRODUTOS SEM IMAGEM",
                 font=("Segoe UI", 8, "bold"), bg=self.BG, fg=self.GRAY
                 ).pack(anchor="w", padx=6, pady=(2, 4))

        self._listbox = tk.Listbox(left, font=("Segoe UI", 9), selectmode="single",
                                   activestyle="none", relief="flat", bg="white",
                                   bd=1, highlightthickness=1, highlightcolor=self.ACCENT,
                                   selectbackground=self.ACCENT, selectforeground="white")
        sb = tk.Scrollbar(left, command=self._listbox.yview)
        self._listbox.config(yscrollcommand=sb.set)
        sb.pack(side="right", fill="y")
        self._listbox.pack(fill="both", expand=True, padx=(4, 0))
        self._listbox.bind("<<ListboxSelect>>", self._on_select)

        # Right: picker
        right = tk.Frame(pane, bg="white", relief="flat", bd=1)
        pane.add(right, minsize=620)

        # Product info strip
        info = tk.Frame(right, bg="#f8f8fc", pady=10, padx=14)
        info.pack(fill="x")

        self._name_var = tk.StringVar(value="← Selecione ou carregue os produtos")
        self._info_var = tk.StringVar(value="")
        tk.Label(info, textvariable=self._name_var,
                 font=("Segoe UI", 12, "bold"), bg="#f8f8fc", anchor="w").pack(fill="x")
        tk.Label(info, textvariable=self._info_var,
                 font=("Segoe UI", 9), fg=self.GRAY, bg="#f8f8fc", anchor="w").pack(fill="x")

        # Actions
        act = tk.Frame(right, bg="white", pady=8, padx=14)
        act.pack(fill="x")

        self._btn(act, "⏭  Pular", "#e2e8f0", self._skip, fg="#333").pack(side="left", padx=(0, 8))

        # Query field
        tk.Label(act, text="Buscar:", bg="white", fg=self.GRAY,
                 font=("Segoe UI", 9)).pack(side="left", padx=(0, 4))
        self._query_var = tk.StringVar()
        self._query_entry = tk.Entry(act, textvariable=self._query_var, width=38,
                                     font=("Segoe UI", 10), relief="flat",
                                     bg="#f4f4f8", fg="#1e1e2e",
                                     highlightthickness=1,
                                     highlightbackground="#ddd",
                                     highlightcolor=self.ACCENT)
        self._query_entry.pack(side="left", ipady=4, padx=(0, 6))
        self._query_entry.bind("<Return>", lambda _: self._do_search())

        self._btn(act, "🔍  Buscar", self.ACCENT, self._do_search, fg="white").pack(side="left")

        self._search_lbl = tk.Label(act, text="", bg="white", fg=self.GRAY,
                                    font=("Segoe UI", 9))
        self._search_lbl.pack(side="left", padx=10)

        # Separator
        tk.Frame(right, bg="#eeeeee", height=1).pack(fill="x")

        # Image canvas
        cv_frame = tk.Frame(right, bg="white")
        cv_frame.pack(fill="both", expand=True)

        self._canvas = tk.Canvas(cv_frame, bg="white", highlightthickness=0)
        vsb = tk.Scrollbar(cv_frame, orient="vertical", command=self._canvas.yview)
        self._canvas.configure(yscrollcommand=vsb.set)
        vsb.pack(side="right", fill="y")
        self._canvas.pack(side="left", fill="both", expand=True)

        self._grid = tk.Frame(self._canvas, bg="white")
        self._cw = self._canvas.create_window((0, 0), window=self._grid, anchor="nw")
        self._grid.bind("<Configure>",  lambda e: self._canvas.configure(
            scrollregion=self._canvas.bbox("all")))
        self._canvas.bind("<Configure>", lambda e: self._canvas.itemconfig(
            self._cw, width=e.width))

        # Bottom progress
        bot = tk.Frame(self, bg=self.SIDEBAR, pady=6)
        bot.pack(fill="x", side="bottom")

        style = ttk.Style()
        style.theme_use("default")
        style.configure("App.Horizontal.TProgressbar",
                        troughcolor="#2d2d44", background=self.ACCENT, thickness=8)

        self._prog = ttk.Progressbar(bot, style="App.Horizontal.TProgressbar",
                                     mode="determinate", length=350)
        self._prog.pack(side="left", padx=14)

        self._prog_lbl = tk.Label(bot, text="", bg=self.SIDEBAR, fg=self.GRAY,
                                  font=("Segoe UI", 9))
        self._prog_lbl.pack(side="left", padx=6)

        self._result_lbl = tk.Label(bot, text="", bg=self.SIDEBAR, fg=self.GREEN,
                                    font=("Segoe UI", 9, "bold"))
        self._result_lbl.pack(side="right", padx=14)

    def _btn(self, parent, text, color, cmd, fg="#1e1e2e"):
        return tk.Button(parent, text=text, command=cmd, bg=color, fg=fg,
                         font=("Segoe UI", 9, "bold"), relief="flat",
                         padx=12, pady=4, cursor="hand2",
                         activebackground=color, activeforeground=fg)

    # ── Load ──────────────────────────────────────────────────────────────────

    def _load_api(self):
        if not self._check_token():
            return
        self._set_status("Carregando...")
        self._src_info.config(text="Buscando na API...")

        def work():
            try:
                products = api_get_products(self.token.get().strip())
                self.after(0, lambda: self._set_products(products, "API"))
            except Exception as e:
                self.after(0, lambda: self._err(f"Erro na API:\n{e}"))

        threading.Thread(target=work, daemon=True).start()

    def _load_csv(self):
        path = filedialog.askopenfilename(
            title="Abrir CSV",
            filetypes=[("CSV", "*.csv"), ("Todos", "*.*")])
        if not path:
            return
        try:
            with open(path, newline="", encoding="utf-8") as f:
                rows = list(csv.DictReader(f))
            products = [
                {"id": r.get("id","").strip(),
                 "name": r.get("name","").strip(),
                 "barcode": r.get("barcode","").strip() or None,
                 "categoryName": r.get("category","").strip()}
                for r in rows if r.get("id") and r.get("name")]
            self._set_products(products, f"CSV · {len(products)} produtos")
        except Exception as e:
            self._err(f"Erro ao abrir CSV:\n{e}")

    def _export_csv(self):
        if not self._check_token():
            return
        path = filedialog.asksaveasfilename(
            title="Salvar CSV",
            defaultextension=".csv",
            initialfile="produtos_sem_imagem.csv",
            filetypes=[("CSV", "*.csv")])
        if not path:
            return
        self._src_info.config(text="Exportando...")

        def work():
            try:
                products = api_get_products(self.token.get().strip())
                with open(path, "w", newline="", encoding="utf-8") as f:
                    w = csv.DictWriter(f, fieldnames=["id","name","barcode","category"])
                    w.writeheader()
                    for p in products:
                        w.writerow({"id": p.get("id",""), "name": p.get("name",""),
                                    "barcode": p.get("barcode") or "",
                                    "category": p.get("categoryName","")})
                self.after(0, lambda: messagebox.showinfo(
                    "Exportado", f"{len(products)} produtos salvos em:\n{path}"))
                self.after(0, lambda: self._src_info.config(text=""))
            except Exception as e:
                self.after(0, lambda: self._err(f"Erro:\n{e}"))

        threading.Thread(target=work, daemon=True).start()

    # ── Products ──────────────────────────────────────────────────────────────

    def _set_products(self, products: list[dict], source: str):
        self.products  = products
        self.current   = -1
        self.n_applied = 0
        self.n_skipped = 0
        self._set_status(f"✓ {len(products)} produtos ({source})")
        self._src_info.config(text=f"{len(products)} sem imagem")

        self._listbox.delete(0, "end")
        for p in products:
            self._listbox.insert("end", f"  {p['name'][:40]}")

        self._update_progress()
        if products:
            self._select(0)

    def _on_select(self, _=None):
        sel = self._listbox.curselection()
        if sel:
            self._select(sel[0])

    def _select(self, idx: int):
        if idx < 0 or idx >= len(self.products):
            return
        self.current = idx
        self._listbox.selection_clear(0, "end")
        self._listbox.selection_set(idx)
        self._listbox.see(idx)

        p = self.products[idx]
        self._name_var.set(p.get("name", ""))
        self._info_var.set(
            f"Barcode: {p.get('barcode') or '—'}  |  "
            f"Categoria: {p.get('categoryName') or p.get('category') or '—'}  |  "
            f"#{idx + 1} de {len(self.products)}")

        # Popula campo de busca com nome simplificado (editável, não afeta o banco)
        self._query_var.set(_simplify(p.get("name", "")))

        self._clear_grid()
        self._do_search()

    def _skip(self):
        if self.current < 0:
            return
        self.n_skipped += 1
        self._mark_item(self.current, "⏭")
        self._advance()

    def _advance(self):
        nxt = self.current + 1
        if nxt >= len(self.products):
            messagebox.showinfo("Concluído",
                f"Todos os produtos foram processados!\n\n"
                f"✓ Aplicados : {self.n_applied}\n"
                f"⏭ Pulados   : {self.n_skipped}")
        else:
            self._select(nxt)

    # ── Image search ──────────────────────────────────────────────────────────

    def _do_search(self):
        if self.current < 0:
            return
        p       = self.products[self.current]
        query   = self._query_var.get().strip() or _simplify(p.get("name", ""))
        barcode = p.get("barcode")

        self._clear_grid()
        self._search_lbl.config(text="🔍 Buscando...")

        def work():
            urls = find_images(query, barcode)
            self.after(0, lambda: self._show_images(urls))

        threading.Thread(target=work, daemon=True).start()

    def _show_images(self, urls: list[str]):
        if not urls:
            self._search_lbl.config(text="Nenhuma imagem encontrada — tente refinar o nome")
            return
        self._search_lbl.config(text=f"{len(urls)} imagens — clique para aplicar")

        for i, url in enumerate(urls):
            row, col = divmod(i, IMG_COLS)
            cell = tk.Frame(self._grid, bg="white", padx=6, pady=6)
            cell.grid(row=row, column=col, padx=4, pady=4)

            placeholder = tk.Label(cell, text="⏳", width=14, height=7,
                                   bg="#f0f2f5", font=("Segoe UI", 12))
            placeholder.pack()

            def load(ph=placeholder, u=url, c=cell):
                photo = fetch_photo(u)
                if photo:
                    self._photos.append(photo)
                    btn = tk.Button(c, image=photo, relief="flat", cursor="hand2",
                                   bg="#f8f8f8", bd=2, padx=2, pady=2,
                                   activebackground="#ede9fe",
                                   command=lambda x=u: self._apply(x))
                    ph.destroy()
                    btn.pack()
                else:
                    ph.config(text="✗", fg="#ccc")

            threading.Thread(target=load, daemon=True).start()

    def _apply(self, url: str):
        if not self._check_token():
            return
        p = self.products[self.current]
        self._search_lbl.config(text="Aplicando...")

        def work():
            ok = api_apply_image(p["id"], url, self.token.get().strip())
            if ok:
                self.n_applied += 1
                self.after(0, lambda: self._mark_item(self.current, "✓"))
                self.after(0, self._advance)
            else:
                self.after(0, lambda: messagebox.showerror("Erro", "Falha ao aplicar imagem."))
                self.after(0, lambda: self._search_lbl.config(text="Erro ao aplicar"))

        threading.Thread(target=work, daemon=True).start()

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _clear_grid(self):
        for w in self._grid.winfo_children():
            w.destroy()
        self._photos.clear()

    def _mark_item(self, idx: int, icon: str):
        if 0 <= idx < self._listbox.size():
            old = self._listbox.get(idx).strip().lstrip("✓⏭ ")
            self._listbox.delete(idx)
            self._listbox.insert(idx, f"{icon} {old}")
            fg = self.GREEN if icon == "✓" else self.GRAY
            self._listbox.itemconfig(idx, fg=fg)
        self._update_progress()

    def _update_progress(self):
        total = len(self.products)
        done  = self.n_applied + self.n_skipped
        pct   = int(done / total * 100) if total else 0
        self._prog.config(maximum=max(total, 1), value=done)
        self._prog_lbl.config(text=f"{done}/{total}  ({pct}%)")
        self._result_lbl.config(
            text=f"✓ {self.n_applied} aplicados   ⏭ {self.n_skipped} pulados")

    def _set_status(self, msg: str):
        self._status_lbl.config(text=msg)

    def _check_token(self) -> bool:
        if not self.token.get().strip():
            messagebox.showwarning("Token", "Informe o JWT token no campo acima.")
            return False
        return True

    def _err(self, msg: str):
        self._src_info.config(text="Erro")
        messagebox.showerror("Erro", msg)


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    if not PIL_OK:
        import tkinter.messagebox as mb
        mb.showwarning("Pillow não instalado",
                       "Instale o Pillow para visualizar imagens:\n\npip install pillow")
    app = App()
    app.mainloop()
