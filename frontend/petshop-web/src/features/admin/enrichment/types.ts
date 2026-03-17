// ── Enums ──────────────────────────────────────────────────────────────────────

export type EnrichmentBatchStatus = "Queued" | "Running" | "Done" | "Failed";
export type EnrichmentTrigger = "Manual" | "PostSync" | "Scheduled";

/** Values match the backend switch: all | without-image | recently-imported | by-category */
export type EnrichmentScope = "all" | "without-image" | "recently-imported" | "by-category";

export type NameSuggestionStatus = "Pending" | "Approved" | "Rejected" | "AutoApplied";
export type ImageCandidateStatus = "Pending" | "Approved" | "Rejected" | "AutoApplied" | "Failed";

// ── Batch ──────────────────────────────────────────────────────────────────────

export type EnrichmentBatchResponse = {
  id: string;
  trigger: EnrichmentTrigger;
  status: EnrichmentBatchStatus;
  totalQueued: number;
  processed: number;
  namesNormalized: number;
  imagesApplied: number;
  pendingReview: number;
  failedItems: number;
  startedAtUtc: string | null;
  finishedAtUtc: string | null;
  errorMessage: string | null;
  createdAtUtc: string;
};

export type EnrichmentBatchListResponse = {
  page: number;
  pageSize: number;
  total: number;
  items: EnrichmentBatchResponse[];
};

export type CreateEnrichmentBatchRequest = {
  scope: EnrichmentScope;
  recentHours?: number;
  categoryId?: string;
  includeImages?: boolean;
};

// ── Name Suggestions ───────────────────────────────────────────────────────────

export type NameSuggestionResponse = {
  id: string;
  productId: string;
  productName: string;
  originalName: string;
  suggestedName: string;
  confidenceScore: number;
  source: string;
  status: NameSuggestionStatus;
  createdAtUtc: string;
};

export type NameSuggestionListResponse = {
  page: number;
  pageSize: number;
  total: number;
  items: NameSuggestionResponse[];
};

// ── Image Candidates ───────────────────────────────────────────────────────────

export type ImageCandidateResponse = {
  id: string;
  productId: string;
  productName: string;
  candidateUrl: string | null;
  candidateName: string | null;
  candidateBrand: string | null;
  candidateBarcode: string | null;
  source: string;
  confidenceScore: number;
  scoreBreakdownJson: string | null;
  status: ImageCandidateStatus;
  createdAtUtc: string;
};

export type ImageCandidateListResponse = {
  page: number;
  pageSize: number;
  total: number;
  items: ImageCandidateResponse[];
};

// ── Config ─────────────────────────────────────────────────────────────────────

export type EnrichmentConfigResponse = {
  autoApplyImageThreshold: number;
  reviewImageThreshold: number;
  autoApplyNameThreshold: number;
  batchSize: number;
  delayBetweenItemsMs: number;
  enableImageMatching: boolean;
  enableNameNormalization: boolean;
};

/** All fields required — backend does not accept partial updates. */
export type UpdateEnrichmentConfigRequest = EnrichmentConfigResponse;
