import { adminFetch } from "@/features/admin/auth/adminFetch";

export type AccountingDispatchFrequency = "Monthly" | "Weekly" | "Daily" | "Manual";
export type AccountingSendWhenNoMovement = "Skip" | "SendZeroed";

export interface AccountingDispatchConfigDto {
  isEnabled: boolean;
  accountantName: string | null;
  primaryEmail: string | null;
  ccEmails: string;
  frequency: AccountingDispatchFrequency;
  dayOfMonth: number;
  dayOfWeek: number;
  sendTimeLocal: string;
  timezoneId: string;
  includeXmlIssued: boolean;
  includeXmlCanceled: boolean;
  includeSalesCsv: boolean;
  includeSummaryPdf: boolean;
  maxRetryCount: number;
  retryDelayMinutes: number;
  fixedEmailNote: string | null;
  protectAttachments: boolean;
  attachmentPassword: string | null;
  maxAttachmentSizeMb: number;
  sendWhenNoMovement: AccountingSendWhenNoMovement;
  lastSentAtUtc: string | null;
  lastSuccessAtUtc: string | null;
  updatedAtUtc: string;
}

export interface AccountingHistoryItem {
  id: string;
  periodReference: string;
  periodStartUtc: string;
  periodEndUtc: string;
  triggerType: string;
  status: string;
  primaryRecipient: string | null;
  xmlCountIssued: number;
  xmlCountCanceled: number;
  salesCount: number;
  grossAmount: number;
  netAmount: number;
  errorMessage: string | null;
  createdAtUtc: string;
  finishedAtUtc: string | null;
}

export interface AccountingHistoryPage {
  total: number;
  page: number;
  pageSize: number;
  items: AccountingHistoryItem[];
}

export interface AccountingRunAttachment {
  id: string;
  attachmentType: string;
  fileName: string;
  sizeBytes: number;
  checksumSha256: string;
  createdAtUtc: string;
}

export interface AccountingRunDetail {
  id: string;
  periodReference: string;
  periodStartUtc: string;
  periodEndUtc: string;
  triggerType: string;
  status: string;
  correlationId: string;
  primaryRecipient: string | null;
  ccRecipients: string | null;
  xmlCountIssued: number;
  xmlCountCanceled: number;
  salesCount: number;
  grossAmount: number;
  discountAmount: number;
  canceledAmount: number;
  netAmount: number;
  averageTicket: number;
  paymentBreakdownJson: string;
  errorCode: string | null;
  errorMessage: string | null;
  startedAtUtc: string;
  finishedAtUtc: string | null;
  createdBy: string | null;
  attachments: AccountingRunAttachment[];
}

export interface SendNowPayload {
  periodReference?: string | null;
  periodStartUtc?: string | null;
  periodEndUtc?: string | null;
  forceResend?: boolean;
}

export async function getAccountingDispatchConfig(): Promise<AccountingDispatchConfigDto> {
  return adminFetch<AccountingDispatchConfigDto>("/admin/accounting-dispatch/config");
}

export async function saveAccountingDispatchConfig(
  body: AccountingDispatchConfigDto,
): Promise<AccountingDispatchConfigDto> {
  return adminFetch<AccountingDispatchConfigDto>("/admin/accounting-dispatch/config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function testAccountingDispatchEmail(): Promise<{ message: string }> {
  return adminFetch<{ message: string }>("/admin/accounting-dispatch/test-email", {
    method: "POST",
  });
}

export async function sendAccountingDispatchNow(payload: SendNowPayload): Promise<AccountingRunDetail> {
  return adminFetch<AccountingRunDetail>("/admin/accounting-dispatch/send-now", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function listAccountingDispatchHistory(
  page = 1,
  pageSize = 20,
  status?: string,
): Promise<AccountingHistoryPage> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  if (status) params.set("status", status);

  return adminFetch<AccountingHistoryPage>(`/admin/accounting-dispatch/history?${params.toString()}`);
}

export async function getAccountingDispatchRun(runId: string): Promise<AccountingRunDetail> {
  return adminFetch<AccountingRunDetail>(`/admin/accounting-dispatch/history/${runId}`);
}

export async function retryAccountingDispatchRun(runId: string): Promise<AccountingRunDetail> {
  return adminFetch<AccountingRunDetail>(`/admin/accounting-dispatch/history/${runId}/retry`, {
    method: "POST",
  });
}
