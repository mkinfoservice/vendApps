export type DelivererResponse = {
    id: string;
    name: string;
    phone: string;
    vehicle?: string | null;
    isActive: boolean;
    createdAtUtc: string;
};

export type CreateDelivererRequest = {
    name: string;
    phone: string;
    vehicle?: string | null;
    pin: string; // backend espera pin no create
    isActive: boolean;
};

export type UpdateDelivererRequest = {
    name: string;
    phone: string;
    vehicle?: string | null;
    isActive: boolean;
};