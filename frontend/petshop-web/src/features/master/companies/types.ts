export type CompanyListItem = {
  id: string;
  name: string;
  slug: string;
  segment: string;
  plan: string;
  isActive: boolean;
  isDeleted: boolean;
  suspendedAtUtc: string | null;
  createdAtUtc: string;
  hasSettings: boolean;
  adminCount: number;
};

export type ListCompaniesResponse = {
  items: CompanyListItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type CompanyDetailDto = {
  id: string;
  name: string;
  slug: string;
  segment: string;
  plan: string;
  planExpiresAtUtc: string | null;
  isActive: boolean;
  isDeleted: boolean;
  suspendedAtUtc: string | null;
  suspendedReason: string | null;
  createdAtUtc: string;
  hasSettings: boolean;
  hasWhatsapp: boolean;
  adminCount: number;
};

export type CompanySettingsDto = {
  id: string;
  companyId: string;
  depotLatitude: number | null;
  depotLongitude: number | null;
  depotAddress: string | null;
  coverageRadiusKm: number | null;
  deliveryFixedCents: number | null;
  deliveryPerKmCents: number | null;
  minOrderCents: number | null;
  enablePix: boolean;
  enableCard: boolean;
  enableCash: boolean;
  pixKey: string | null;
  printEnabled: boolean;
  printLayout: string | null;
  supportWhatsappE164: string | null;
  updatedAtUtc: string;
};

export type AdminUserDto = {
  id: string;
  companyId: string | null;
  username: string;
  email: string | null;
  role: string;
  isActive: boolean;
  lastLoginAtUtc: string | null;
  createdAtUtc: string;
};

export type ListAdminUsersResponse = {
  items: AdminUserDto[];
  total: number;
};

export type WhatsappIntegrationDto = {
  id: string;
  companyId: string;
  mode: string;
  wabaId: string | null;
  phoneNumberId: string | null;
  hasAccessToken: boolean;
  webhookSecret: string | null;
  notifyOnStatuses: string | null;
  isActive: boolean;
  updatedAtUtc: string;
};

export type ProvisionResultDto = {
  companyId: string;
  adminUserId: string;
  adminUsername: string;
  settingsCreated: boolean;
  seededCategories: number;
  seededProducts: number;
  seededDeliverer: boolean;
};
