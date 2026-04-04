import { adminFetch } from "@/features/admin/auth/adminFetch";

export type PhoneOrderItem = {
  productId: string;
  qty: number;
  addonIds?: string[];
};

export type CreatePhoneOrderRequest = {
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  customerCpfConfirmation?: string;
  cep?: string;
  address?: string;
  complement?: string;
  items: PhoneOrderItem[];
  paymentMethod: string;
  deliveryCents?: number;
  cashGivenCents?: number;
};

export type PhoneOrderResponse = {
  id: string;
  orderNumber: string;
  davPublicId: string | null;
  status: string;
  subtotalCents: number;
  deliveryCents: number;
  totalCents: number;
  paymentMethodStr: string;
  cashGivenCents: number | null;
  changeCents: number | null;
};

export function createPhoneOrder(body: CreatePhoneOrderRequest) {
  return adminFetch<PhoneOrderResponse>("/admin/orders/phone", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
