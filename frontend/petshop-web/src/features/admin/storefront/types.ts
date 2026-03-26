export interface BannerSlideResponse {
  id: string;
  imageUrl: string | null;
  title: string | null;
  subtitle: string | null;
  ctaText: string | null;
  ctaType: "none" | "category" | "product" | "external";
  ctaTarget: string | null;
  ctaNewTab: boolean;
  sortOrder: number;
  isActive: boolean;
}

export interface StoreFrontConfigResponse {
  id: string;
  primaryColor: string;
  bannerIntervalSecs: number;
  slides: BannerSlideResponse[];
}

export interface UpdateStoreFrontConfigRequest {
  primaryColor?: string;
  bannerIntervalSecs?: number;
}

export interface UpsertBannerSlideRequest {
  imageUrl?: string | null;
  title?: string | null;
  subtitle?: string | null;
  ctaText?: string | null;
  ctaType?: string;
  ctaTarget?: string | null;
  ctaNewTab?: boolean;
  sortOrder?: number;
  isActive?: boolean;
}
