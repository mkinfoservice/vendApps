export type SourceListItem = {
  id: string;
  name: string;
  sourceType: "Db" | "Api" | "File";
  connectorType: string;
  isActive: boolean;
  syncMode: "Manual" | "Scheduled";
  scheduleCron: string | null;
  lastSyncAtUtc: string | null;
  createdAtUtc: string;
};

export type SyncJobResponse = {
  id: string;
  externalSourceId: string;
  sourceName: string;
  triggeredBy: string;
  syncType: string;
  status: "Queued" | "Running" | "Done" | "Failed";
  totalFetched: number;
  inserted: number;
  updated: number;
  unchanged: number;
  skipped: number;
  conflicts: number;
  startedAtUtc: string | null;
  finishedAtUtc: string | null;
  errorMessage: string | null;
};

export type ManualSyncRequest = {
  sourceId: string;
  syncType: "Full" | "Delta";
  batchSize?: number;
};

export type CreateSourceRequest = {
  name: string;
  sourceType: "Db" | "Api" | "File";
  connectorType: string;
  connectionConfigJson: string;
  isActive: boolean;
  syncMode: "Manual" | "Scheduled";
  scheduleCron: string | null;
};

export type TestConnectionResponse = {
  success: boolean;
  message: string;
  sampleCount: number;
};
