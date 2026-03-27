#!/usr/bin/env python3
"""
VendApps — Enriquecimento de imagens via Python
================================================
Busca imagens no DuckDuckGo/Bing e aplica via API do vendApps.

INSTALAR DEPENDÊNCIAS:
    pip install requests duckduckgo-search

MODOS DE USO:

  1. Exportar produtos sem imagem para CSV:
       python enrich_images.py export --token SEU_JWT [--output produtos.csv]

  2. Processar CSV em lote:
       python enrich_images.py batch --token SEU_JWT --csv produtos.csv
       python enrich_images.py batch --token SEU_JWT --csv produtos.csv --delay 2 --start 150

  3. Processar um único produto:
       python enrich_images.py single --token SEU_JWT --id PRODUCT_UUID --name "Ração Golden"
       python enrich_images.py single --token SEU_JWT --id PRODUCT_UUID --name "Ração Golden" --barcode 7891234567890

EXEMPLOS:
  # Exportar, depois processar
  python enrich_images.py export --token eyJ... --output sem_imagem.csv
  python enrich_images.py batch  --token eyJ... --csv sem_imagem.csv

  # Retomar do produto 200 (caso tenha parado)
  python enrich_images.py batch --token eyJ... --csv sem_imagem.csv --start 200

  # Produto avulso
  python enrich_images.py single --token eyJ... --id abc-123 --name "Frontline Plus Cão"
"""

import argparse
import csv
import time
import sys
import re
import requests

API_BASE = "https://vendapps.onrender.com"
DEFAULT_DELAY   = 1.5   # segundos entre produtos (evita rate limit)
DEFAULT_PAGE_SIZE = 200  # máximo permitido pela API

# ── Fontes de imagem ──────────────────────────────────────────────────────────

def _simplify(name: str) -> str:
    clean = re.sub(r'\b\d+\s*(mg|ml|g|kg|mcg|ui|un|unid|comp|cpr|caps|tab)\b', '', name, flags=re.I)
    clean = re.sub(r'[^\w\s]', ' ', clean)
    words = [w for w in clean.split() if len(w) >= 3][:5]
    return " ".join(words).strip() or name


def search_ml(query: str, barcode: str | None = None, n: int = 5) -> list[str]:
    """Mercado Livre — funciona de IP doméstico/comercial (sem bloqueio)."""
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


def search_bing(query: str, max_results: int = 8) -> list[str]:
    try:
        headers = {
            "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                           "AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36"),
            "Accept-Language": "pt-BR,pt;q=0.9",
            "Referer": "https://www.bing.com/",
        }
        r = requests.get("https://www.bing.com/images/search",
                         params={"q": query, "form": "HDRSC2", "first": 1},
                         headers=headers, timeout=12)
        urls = re.findall(r'"murl":"(https?://[^"]+)"', r.text)
        return [u for u in urls if not u.endswith(".gif")][:max_results]
    except Exception as e:
        print(f"    [Bing] erro: {e}")
        return []


def search_ddg(query: str, max_results: int = 8) -> list[str]:
    try:
        try:
            from ddgs import DDGS
        except ImportError:
            from duckduckgo_search import DDGS
        with DDGS() as ddgs:
            results = list(ddgs.images(query, max_results=max_results))
        return [r["image"] for r in results if r.get("image")]
    except ImportError:
        print("    [DDG] pip install ddgs")
        return []
    except Exception as e:
        print(f"    [DDG] erro: {e}")
        return []


def find_image(name: str, barcode: str | None = None) -> str | None:
    """Busca em ML → Bing → DDG e retorna a primeira URL válida."""
    simple = _simplify(name)
    print(f"    query: '{simple}'")

    for urls in [search_ml(simple, barcode), search_bing(simple), search_ddg(simple)]:
        for u in urls:
            if u and u.startswith("http") and not u.endswith(".gif"):
                return u

    if simple != name:
        print(f"    retentando com nome completo: '{name}'")
        for urls in [search_bing(name), search_ddg(name)]:
            for u in urls:
                if u and u.startswith("http"):
                    return u
    return None


# ── API vendApps ──────────────────────────────────────────────────────────────

def api_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def get_products_page(token: str, page: int, page_size: int) -> dict:
    r = requests.get(
        f"{API_BASE}/admin/products",
        params={"page": page, "pageSize": page_size, "active": "true"},
        headers=api_headers(token),
        timeout=20,
    )
    r.raise_for_status()
    return r.json()


def apply_image(product_id: str, image_url: str, token: str) -> bool:
    r = requests.put(
        f"{API_BASE}/admin/enrichment/products/{product_id}/image",
        json={"url": image_url},
        headers=api_headers(token),
        timeout=15,
    )
    return r.status_code == 200


# ── Modos ─────────────────────────────────────────────────────────────────────

def cmd_export(token: str, output: str):
    """Busca todos os produtos sem imagem e salva em CSV."""
    print(f"Exportando produtos sem imagem → {output}")
    all_items = []
    page = 1

    while True:
        print(f"  Página {page}...", end=" ", flush=True)
        try:
            data = get_products_page(token, page, DEFAULT_PAGE_SIZE)
        except requests.HTTPError as e:
            print(f"\nErro na API: {e}")
            break

        items = data.get("items", [])
        total = data.get("total", 0)
        print(f"{len(items)} produtos (total: {total})")

        # Filtra os que não têm imageUrl
        sem_imagem = [p for p in items if not p.get("imageUrl")]
        all_items.extend(sem_imagem)

        fetched = (page - 1) * DEFAULT_PAGE_SIZE + len(items)
        if fetched >= total or len(items) < DEFAULT_PAGE_SIZE:
            break
        page += 1

    if not all_items:
        print("Nenhum produto sem imagem encontrado.")
        return

    with open(output, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["id", "name", "barcode", "category"])
        writer.writeheader()
        for p in all_items:
            writer.writerow({
                "id":       p.get("id", ""),
                "name":     p.get("name", ""),
                "barcode":  p.get("barcode") or "",
                "category": p.get("categoryName", ""),
            })

    print(f"\n✓ {len(all_items)} produtos exportados para '{output}'")


def process_one(product_id: str, name: str, barcode: str | None, token: str) -> bool:
    """Busca e aplica imagem para um produto. Retorna True se bem-sucedido."""
    image_url = find_image(name, barcode)

    if not image_url:
        print("    ✗ Nenhuma imagem encontrada")
        return False

    print(f"    → {image_url[:90]}")
    if apply_image(product_id, image_url, token):
        print("    ✓ Aplicado")
        return True
    else:
        print("    ✗ Erro ao aplicar via API")
        return False


def cmd_batch(token: str, csv_path: str, delay: float, start_line: int):
    """Processa produtos de um CSV em lote."""
    with open(csv_path, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    total   = len(rows)
    success = 0
    failed  = []

    print(f"CSV: {total} produtos | inicio: linha {start_line} | delay: {delay}s\n")

    for i, row in enumerate(rows, start=1):
        if i < start_line:
            continue

        product_id = row.get("id", "").strip()
        name       = row.get("name", "").strip()
        barcode    = row.get("barcode", "").strip() or None

        if not product_id or not name:
            print(f"[{i}/{total}] Pulando — id ou name ausente")
            continue

        print(f"[{i}/{total}] {name[:60]}")
        ok = process_one(product_id, name, barcode, token)

        if ok:
            success += 1
        else:
            failed.append({"linha": i, "id": product_id, "name": name})

        if i < total:
            time.sleep(delay)

    # Resumo
    print(f"\n{'='*50}")
    print(f"✓ Aplicados : {success}")
    print(f"✗ Falhos    : {len(failed)}")

    if failed:
        fail_path = csv_path.replace(".csv", "_falhos.csv")
        with open(fail_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=["linha", "id", "name"])
            writer.writeheader()
            writer.writerows(failed)
        print(f"Falhos salvos em: {fail_path}")
        print(f"Para reprocessar: python enrich_images.py batch --token TOKEN --csv {fail_path}")


def cmd_single(token: str, product_id: str, name: str, barcode: str | None):
    """Processa um único produto."""
    print(f"Produto : {name}")
    print(f"ID      : {product_id}")
    print(f"Barcode : {barcode or 'N/A'}\n")
    ok = process_one(product_id, name, barcode, token)
    sys.exit(0 if ok else 1)


# ── CLI ───────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="VendApps — enriquecimento de imagens",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--token", required=True, help="JWT token do admin")

    sub = parser.add_subparsers(dest="mode", required=True)

    # export
    p_export = sub.add_parser("export", help="Exportar produtos sem imagem para CSV")
    p_export.add_argument("--output", default="produtos_sem_imagem.csv", help="Arquivo de saída (default: produtos_sem_imagem.csv)")

    # batch
    p_batch = sub.add_parser("batch", help="Processar CSV em lote")
    p_batch.add_argument("--csv",   required=True,                    help="Caminho do CSV")
    p_batch.add_argument("--delay", type=float, default=DEFAULT_DELAY, help=f"Delay entre produtos em segundos (default: {DEFAULT_DELAY})")
    p_batch.add_argument("--start", type=int,   default=1,            help="Linha do CSV para iniciar (útil para retomar; default: 1)")

    # single
    p_single = sub.add_parser("single", help="Processar um único produto")
    p_single.add_argument("--id",      required=True,  help="UUID do produto")
    p_single.add_argument("--name",    required=True,  help="Nome do produto")
    p_single.add_argument("--barcode", default=None,   help="Código de barras (opcional)")

    args = parser.parse_args()

    if args.mode == "export":
        cmd_export(args.token, args.output)
    elif args.mode == "batch":
        cmd_batch(args.token, args.csv, args.delay, args.start)
    elif args.mode == "single":
        cmd_single(args.token, args.id, args.name, args.barcode)


if __name__ == "__main__":
    main()
