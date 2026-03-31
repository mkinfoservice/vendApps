import { adminFetch } from "@/features/admin/auth/adminFetch";

export type TableDto = {
  id: string;
  number: number;
  name: string | null;
  capacity: number;
  isActive: boolean;
  createdAtUtc: string;
  updatedAtUtc: string;
  qrUrl?: string;
};

export type TableOverviewItem = {
  id: string;
  number: number;
  name: string | null;
  capacity: number;
  isActive: boolean;
  openOrders: number;
  qrUrl: string;
};

export type TableMetrics = {
  tableId: string;
  tableNumber: number;
  tableName: string | null;
  totalOrders: number;
  completedOrders: number;
  avgTicketCents: number;
  totalRevenueCents: number;
  lastOrderUtc: string | null;
};

export type TableServiceOrder = {
  id: string;
  publicId: string;
  customerName: string;
  status: string;
  totalCents: number;
  createdAtUtc: string;
};

export type TableServiceResponse = {
  table: {
    id: string;
    number: number;
    name: string | null;
    capacity: number;
    isActive: boolean;
  };
  activeOrders: TableServiceOrder[];
  totals: {
    orders: number;
    amountCents: number;
  };
};

export type UpsertTableRequest = {
  number: number;
  name?: string;
  capacity?: number;
  isActive?: boolean;
};

export function fetchTablesOverview(): Promise<TableOverviewItem[]> {
  return adminFetch<TableOverviewItem[]>("/admin/tables/overview");
}

export function fetchTables(): Promise<TableDto[]> {
  return adminFetch<TableDto[]>("/admin/tables");
}

export function fetchTableMetrics(id: string): Promise<TableMetrics> {
  return adminFetch<TableMetrics>(`/admin/tables/${id}/metrics`);
}

export function fetchTableService(id: string): Promise<TableServiceResponse> {
  return adminFetch<TableServiceResponse>(`/admin/tables/${id}/service`);
}

export function createTable(body: UpsertTableRequest): Promise<TableDto> {
  return adminFetch<TableDto>("/admin/tables", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateTable(id: string, body: Partial<UpsertTableRequest>): Promise<TableDto> {
  return adminFetch<TableDto>(`/admin/tables/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function deleteTable(id: string): Promise<void> {
  return adminFetch<void>(`/admin/tables/${id}`, { method: "DELETE" });
}

export function finalizeTable(id: string): Promise<{ finalized: number; pending: number; message: string }> {
  return adminFetch<{ finalized: number; pending: number; message: string }>(`/admin/tables/${id}/finalize`, {
    method: "POST",
  });
}

export function cancelTableOpenOrders(id: string): Promise<{ cancelled: number; message: string }> {
  return adminFetch<{ cancelled: number; message: string }>(`/admin/tables/${id}/cancel-open`, {
    method: "POST",
  });
}
