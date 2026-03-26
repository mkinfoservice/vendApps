import { useEffect } from "react";
import { useStoreFront } from "@/features/catalog/queries";

/**
 * Lê a cor primária da loja e a aplica como --brand no <html>.
 * Usar em páginas fora do App.tsx (Checkout, ProductDetail) para
 * garantir que a variável CSS esteja disponível mesmo na navegação direta.
 */
export function useBrandVar() {
  const { data: storeFront } = useStoreFront();
  const brandColor = storeFront?.primaryColor ?? "#7c5cf8";

  useEffect(() => {
    document.documentElement.style.setProperty("--brand", brandColor);
  }, [brandColor]);
}
