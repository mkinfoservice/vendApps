import { resolveTenantFromHost } from "@/utils/tenant";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5082";

export interface LoyaltySessionResponse {
  sessionToken: string;
  expiresAtUtc: string;
  customer: {
    customerId: string;
    name: string;
    pointsBalance: number;
  };
}

export interface LoyaltyTransaction {
  id: string;
  points: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  createdAtUtc: string;
}

export interface LoyaltyReward {
  id: string;
  name: string;
  description: string | null;
  couponCode: string | null;
  pointsCost: number;
  imageUrl: string | null;
  product: {
    id: string;
    name: string;
    priceCents: number;
  } | null;
  discount: {
    type: "PercentDiscount" | "FixedAmount";
    value: number;
  };
  targetName: string | null;
  isRedeemed: boolean;
  isAvailable: boolean;
}

export interface LoyaltyDashboard {
  company: {
    companyId: string;
    companyName: string;
    companySlug: string;
  };
  customer: {
    customerId: string;
    name: string;
    pointsBalance: number;
  };
  loyaltyConfig: {
    isEnabled: boolean;
    minRedemptionPoints: number;
    pointsPerReal: number;
    pointsPerReais: number;
  };
  rewards: LoyaltyReward[];
  transactions: LoyaltyTransaction[];
}

export interface RedeemRewardResponse {
  promotionId: string;
  promotionName: string;
  couponCode: string | null;
  pointsSpent: number;
  pointsBalance: number;
  isReplay: boolean;
}

export function detectLoyaltySlug(querySlug?: string | null): string | null {
  return (querySlug?.trim().toLowerCase() || resolveTenantFromHost()) ?? null;
}

export async function createLoyaltySession(
  phone: string,
  cpf: string,
  slug?: string | null,
): Promise<LoyaltySessionResponse> {
  const r = await fetch(`${API_URL}/public/loyalty/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      phone,
      cpf,
      slug: slug ?? undefined,
    }),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(text || "Não foi possível iniciar sessão de fidelidade.");
  }
  return r.json();
}

export async function getLoyaltyDashboard(sessionToken: string): Promise<LoyaltyDashboard> {
  const r = await fetch(`${API_URL}/public/loyalty/dashboard`, {
    headers: {
      Accept: "application/json",
      "X-Loyalty-Session": sessionToken,
    },
  });
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(text || "Não foi possível carregar fidelidade.");
  }
  return r.json();
}

export async function redeemLoyaltyReward(
  sessionToken: string,
  promotionId: string,
  idempotencyKey: string,
): Promise<RedeemRewardResponse> {
  const r = await fetch(`${API_URL}/public/loyalty/redeem`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Loyalty-Session": sessionToken,
    },
    body: JSON.stringify({ promotionId, idempotencyKey }),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(text || "Não foi possível resgatar benefício.");
  }
  return r.json();
}
