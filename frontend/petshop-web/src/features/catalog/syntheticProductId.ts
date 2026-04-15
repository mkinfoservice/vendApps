const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ParsedSyntheticProductId = {
  productId: string;
  variantId?: string;
  addonIds: string[];
};

export function encodeSyntheticProductId(
  productId: string,
  variantId?: string | null,
  addonIds?: string[],
): string {
  const parts = [productId];
  if (variantId) parts.push(`v:${variantId}`);

  const uniqueAddonIds = Array.from(new Set((addonIds ?? []).filter(Boolean))).sort();
  if (uniqueAddonIds.length > 0) parts.push(`a:${uniqueAddonIds.join("_")}`);

  return parts.join("__");
}

export function parseSyntheticProductId(rawId: string): ParsedSyntheticProductId {
  const parts = rawId.split("__");
  const productId = parts[0];
  let variantId: string | undefined;
  let addonIds: string[] = [];

  for (const segment of parts.slice(1)) {
    if (!segment) continue;

    if (segment.startsWith("v:")) {
      const parsed = segment.slice(2).trim();
      if (parsed) variantId = parsed;
      continue;
    }

    if (segment.startsWith("a:")) {
      addonIds = segment
        .slice(2)
        .split("_")
        .map((s) => s.trim())
        .filter(Boolean);
      continue;
    }

    // Backward compatibility: old ids used `productId__variantId` or `productId__addon1_addon2`.
    if (!variantId && GUID_RE.test(segment)) {
      variantId = segment;
      continue;
    }
    if (addonIds.length === 0 && segment.includes("_")) {
      addonIds = segment.split("_").map((s) => s.trim()).filter(Boolean);
    }
  }

  return { productId, variantId, addonIds };
}

