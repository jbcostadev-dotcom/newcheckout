import type { GoogleAdsConfig } from "@/types";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

let loadedPixelId: string | null = null;

const CONFIG_STORAGE_KEY = "google_ads_config_v1";
const FIRED_FLAG_PREFIX = "google_ads_fired_";

export function loadGoogleAds(pixelId: string): void {
  if (typeof window === "undefined") return;
  if (!pixelId || loadedPixelId === pixelId) return;

  window.dataLayer = window.dataLayer || [];
  // Stub mínimo do gtag (mesma assinatura do snippet oficial do Google).
  window.gtag = function (...args: unknown[]) {
    window.dataLayer!.push(args);
  };
  window.gtag("js", new Date());
  window.gtag("config", pixelId);

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(pixelId)}`;
  document.head.appendChild(script);

  loadedPixelId = pixelId;
}

export interface GtagItem {
  id: string;
  name?: string;
  quantity?: number;
  price?: number;
}

export interface PurchaseEventData {
  transaction_id: string;
  value: number;
  currency?: string;
  items?: GtagItem[];
}

function safeGtag(): ((...args: unknown[]) => void) | null {
  if (typeof window === "undefined" || typeof window.gtag !== "function") {
    return null;
  }
  return window.gtag;
}

export function trackPageView(pixelId: string): void {
  const gtag = safeGtag();
  if (!gtag || !pixelId) return;
  gtag("event", "page_view", { send_to: pixelId });
}

export function trackBeginCheckout(data: PurchaseEventData): void {
  const gtag = safeGtag();
  if (!gtag) return;
  gtag("event", "begin_checkout", {
    transaction_id: data.transaction_id,
    value: data.value,
    currency: data.currency ?? "BRL",
    items: data.items ?? [],
  });
}

export function trackAddPaymentInfo(data: PurchaseEventData & { payment_method?: string }): void {
  const gtag = safeGtag();
  if (!gtag) return;
  gtag("event", "add_payment_info", {
    transaction_id: data.transaction_id,
    value: data.value,
    currency: data.currency ?? "BRL",
    items: data.items ?? [],
    payment_method: data.payment_method,
  });
}

/**
 * Dispara a conversão do Google Ads (purchase + conversion).
 * Usa o `transaction_id` para desduplicar disparos dentro da mesma sessão.
 */
export function trackConversion(
  config: Pick<GoogleAdsConfig, "pixel_id" | "conversion_label">,
  data: PurchaseEventData
): void {
  const gtag = safeGtag();
  if (!gtag || !config.pixel_id) return;

  const currency = data.currency ?? "BRL";
  const sendTo = config.conversion_label
    ? `${config.pixel_id}/${config.conversion_label}`
    : config.pixel_id;

  // Event 'purchase' (GA4/Ads-friendly)
  gtag("event", "purchase", {
    transaction_id: data.transaction_id,
    value: data.value,
    currency,
    items: data.items ?? [],
  });

  // Event 'conversion' (Google Ads conversion tracking)
  gtag("event", "conversion", {
    send_to: sendTo,
    transaction_id: data.transaction_id,
    value: data.value,
    currency,
  });
}

/**
 * Verifica se o pixel deve disparar para os produtos informados, respeitando
 * a flag `only_selected_products` e a lista `selected_product_ids`.
 */
export function shouldFireForProducts(
  config: GoogleAdsConfig | null | undefined,
  productIds: number[]
): boolean {
  if (!config?.enabled || !config.pixel_id) return false;
  if (!config.only_selected_products) return true;
  const selected = config.selected_product_ids ?? [];
  if (selected.length === 0) return false;
  const selectedSet = new Set(selected);
  return productIds.some((id) => selectedSet.has(id));
}

/**
 * Marca a conversão de um pedido como já disparada nesta sessão,
 * evitando dupla contagem entre as páginas (checkout -> pix -> confirmed).
 */
export function markFired(transactionId: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(FIRED_FLAG_PREFIX + transactionId, "1");
  } catch {
    /* ignore */
  }
}

export function isFired(transactionId: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    return sessionStorage.getItem(FIRED_FLAG_PREFIX + transactionId) === "1";
  } catch {
    return true;
  }
}

/**
 * Persiste a configuração do Google Ads para reuso pelas páginas de status
 * (pix, confirmed, boleto), que não a recebem da API.
 */
export function persistGoogleAdsConfig(config: GoogleAdsConfig | null | undefined): void {
  if (typeof window === "undefined") return;
  try {
    if (config && config.enabled) {
      sessionStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
    } else {
      sessionStorage.removeItem(CONFIG_STORAGE_KEY);
    }
  } catch {
    /* ignore */
  }
}

export function readGoogleAdsConfig(): GoogleAdsConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GoogleAdsConfig;
    return parsed?.enabled ? parsed : null;
  } catch {
    return null;
  }
}