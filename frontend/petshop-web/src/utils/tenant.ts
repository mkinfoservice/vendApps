const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5082";

const BASE_DOMAIN = (
  import.meta.env.VITE_TENANT_BASE_DOMAIN ?? "vendapps.com.br"
).toLowerCase();

const RESERVED_SLUGS = new Set([
  "www", "app", "admin", "api", "master", "suporte", "blog", "help", "status",
]);

/**
 * Extrai o slug do tenant do hostname atual.
 * Retorna null se não for um subdomínio direto válido do BASE_DOMAIN.
 * Ex: suaempresa.vendapps.com.br → "suaempresa"
 *     vendapps.com.br            → null
 *     localhost                  → null
 */
export function resolveTenantFromHost(): string | null {
  const hostname = window.location.hostname.toLowerCase();

  if (hostname === BASE_DOMAIN) return null;

  const suffix = "." + BASE_DOMAIN;
  if (!hostname.endsWith(suffix)) return null;

  const subdomain = hostname.slice(0, -suffix.length);
  if (subdomain.includes(".")) return null;
  if (!/^[a-z0-9-]{3,63}$/.test(subdomain)) return null;
  if (RESERVED_SLUGS.has(subdomain)) return null;

  return subdomain;
}

export type TenantInfo = {
  slug: string;
  name: string;
  companyId: string;
  isActive: boolean;
  suspendedAtUtc: string | null;
};

/**
 * Chama GET /public/tenant/resolve?slug={slug} para obter dados do tenant.
 * Passa o slug como query param pois o frontend (Vercel) e o backend (Render)
 * estão em domínios diferentes — o Host header na request chegaria como
 * "vendapps.onrender.com", não como o subdomínio do tenant.
 * Lança um erro com `.status` (403, 404) em caso de falha.
 */
export async function fetchTenantInfo(): Promise<TenantInfo> {
  const slug = resolveTenantFromHost();
  if (!slug) {
    const err = new Error("Sem subdomínio de tenant") as Error & { status: number };
    err.status = 400;
    throw err;
  }
  const r = await fetch(
    `${API_URL}/public/tenant/resolve?slug=${encodeURIComponent(slug)}`
  );
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    const err = new Error(
      (body as { error?: string }).error ?? "Tenant não encontrado"
    ) as Error & { status: number };
    err.status = r.status;
    throw err;
  }
  return r.json();
}
