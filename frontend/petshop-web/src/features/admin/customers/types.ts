export type CustomerListItem = {
  id: string;
  name: string;
  phone: string;
  cpf: string | null;
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  updatedAtUtc: string;
};

export type CustomerOrderSummary = {
  id: string;
  publicId: string;
  status: string;
  totalCents: number;
  createdAtUtc: string;
};

export type CustomerDetailDto = {
  id: string;
  name: string;
  phone: string;
  cpf: string | null;
  cep: string | null;
  address: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  addressReference: string | null;
  notes: string | null;
  latitude: number | null;
  longitude: number | null;
  createdAtUtc: string;
  updatedAtUtc: string;
  orders: CustomerOrderSummary[] | null;
};

export type CustomerListResponse = {
  page: number;
  pageSize: number;
  total: number;
  items: CustomerListItem[];
};

export type UpsertCustomerRequest = {
  name: string;
  phone?: string;
  cpf?: string;
  cep?: string;
  address?: string;
  complement?: string;
  addressReference?: string;
  notes?: string;
  latitude?: number;
  longitude?: number;
};
