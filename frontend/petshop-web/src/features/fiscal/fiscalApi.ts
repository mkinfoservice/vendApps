import { adminFetch } from "@/features/admin/auth/adminFetch";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FiscalConfigDto {
  cnpj: string;
  inscricaoEstadual: string;
  uf: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  logradouro: string;
  numeroEndereco: string;
  complemento: string | null;
  bairro: string;
  codigoMunicipio: number;
  nomeMunicipio: string;
  cep: string;
  telefone: string | null;
  taxRegime: string;
  sefazEnvironment: string;
  certificateBase64: string | null;
  certificatePassword: string | null;
  certificatePath: string | null; // legado
  cscId: string | null;
  cscToken: string | null;
  nfceSerie: number;
  defaultCfop: string;
}

export interface SefazStatusDto {
  uf: string;
  online: boolean;
  checkedAtUtc: string;
}

export interface FiscalDocumentListItem {
  id: string;
  saleOrderId: string;
  number: number;
  serie: number;
  fiscalStatus: string;
  accessKey: string | null;
  authorizationCode: string | null;
  rejectCode: string | null;
  rejectMessage: string | null;
  createdAtUtc: string;
  authorizationDateTimeUtc: string | null;
}

// ── API ───────────────────────────────────────────────────────────────────────

export async function getFiscalConfig(): Promise<FiscalConfigDto> {
  return adminFetch<FiscalConfigDto>("/admin/fiscal/config");
}

export async function saveFiscalConfig(dto: FiscalConfigDto): Promise<FiscalConfigDto> {
  return adminFetch<FiscalConfigDto>("/admin/fiscal/config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dto),
  });
}

export async function getSefazStatus(): Promise<SefazStatusDto> {
  return adminFetch<SefazStatusDto>("/admin/fiscal/status");
}

export async function getFiscalDocuments(page = 1, pageSize = 20): Promise<FiscalDocumentListItem[]> {
  return adminFetch<FiscalDocumentListItem[]>(
    `/admin/fiscal/documents?page=${page}&pageSize=${pageSize}`
  );
}
