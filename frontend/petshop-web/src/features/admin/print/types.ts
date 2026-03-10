export type PrintItemPayload = {
  name: string;
  qty: number;
  unitCents: number;
};

export type PrintOrderPayload = {
  orderId: string;
  publicId: string;
  customerName: string;
  phone: string;
  address: string;
  complement: string | null;
  cep: string;
  paymentMethod: string;
  totalCents: number;
  subtotalCents: number;
  deliveryCents: number;
  cashGivenCents: number | null;
  changeCents: number | null;
  isPhoneOrder: boolean;
  createdAtUtc: string;
  items: PrintItemPayload[];
};

export type PrintJob = {
  jobId: string;
  payload: PrintOrderPayload;
};

export type PendingJobDto = {
  id: string;
  publicId: string;
  printPayloadJson: string;
  createdAtUtc: string;
};
