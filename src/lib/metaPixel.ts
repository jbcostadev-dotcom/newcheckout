import { apiPost } from "@/lib/api";
import type { MetaPixelConfig } from "@/types";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: (...args: unknown[]) => void;
  }
}

const CONFIG_STORAGE_KEY = "meta_pixel_config_v1";
const CONSENT_STORAGE_KEY = "meta_pixel_consent_v1";
const FIRED_PREFIX = "meta_pixel_fired_";
let loadedPixelId: string | null = null;

export interface MetaEventData {
  event_id?: string;
  value?: number;
  currency?: string;
  content_ids?: string[];
  contents?: { id: string; quantity: number; item_price?: number }[];
  content_type?: string;
  num_items?: number;
  order_id?: string;
  payment_method?: string;
  installments?: number;
  email?: string;
  phone?: string;
  name?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

function hasConsent(config: MetaPixelConfig | null | undefined, consent?: boolean): boolean {
  if (typeof navigator !== "undefined" && navigator.doNotTrack === "1") return false;
  return !config?.require_consent || consent === true;
}

export function loadMetaPixel(pixelId: string): void {
  if (typeof window === "undefined" || !pixelId || loadedPixelId === pixelId) return;
  const f = window.fbq;
  if (!f) {
    const fbq = (...args: unknown[]) => {
      (fbq as unknown as { queue?: unknown[] }).queue = (fbq as unknown as { queue?: unknown[] }).queue || [];
      (fbq as unknown as { queue: unknown[] }).queue.push(args);
    };
    (fbq as unknown as { loaded?: boolean; version?: string; queue?: unknown[] }).loaded = true;
    (fbq as unknown as { version?: string }).version = "2.0";
    window.fbq = fbq;
    window._fbq = fbq;
  }
  window.fbq?.("init", pixelId);
  window.fbq?.("track", "PageView");
  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(script);
  loadedPixelId = pixelId;
}

export function createMetaEventId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function getMetaIdentifiers(): { fbp?: string; fbc?: string; fbclid?: string } {
  if (typeof window === "undefined") return {};
  const cookies = document.cookie.split(";").reduce<Record<string, string>>((acc, part) => {
    const [key, ...value] = part.trim().split("=");
    if (key) acc[key] = decodeURIComponent(value.join("="));
    return acc;
  }, {});
  const fbclid = new URLSearchParams(window.location.search).get("fbclid") || undefined;
  return {
    fbp: cookies._fbp,
    fbc: cookies._fbc || (fbclid ? `fb.1.${Date.now()}.${fbclid}` : undefined),
    fbclid,
  };
}

export function getMetaTrackingParameters(): Record<string, string | null> {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const ids = getMetaIdentifiers();
  const values: Record<string, string | null> = {
    fbp: ids.fbp ?? null,
    fbc: ids.fbc ?? null,
    fbclid: ids.fbclid ?? null,
    landing_page: window.location.href,
    referrer: document.referrer || null,
    client_user_agent: navigator.userAgent,
    client_ip_address: null,
  };
  for (const key of ["src", "sck", "utm_source", "utm_campaign", "utm_medium", "utm_content", "utm_term"]) {
    values[key] = params.get(key);
  }
  return values;
}

export function trackMetaBrowserEvent(
  config: MetaPixelConfig | null | undefined,
  eventName: string,
  data: MetaEventData = {},
  consent?: boolean,
): string | null {
  if (!config?.enabled || !config.browser_enabled || !config.pixel_id || !hasConsent(config, consent)) return null;
  loadMetaPixel(config.pixel_id);
  const eventId = data.event_id ?? createMetaEventId(eventName.toLowerCase());
  const { event_id: _eventId, ...params } = data;
  window.fbq?.("track", eventName, params, { eventID: eventId });
  return eventId;
}

export function sendMetaServerEvent(
  config: MetaPixelConfig | null | undefined,
  storeId: number,
  eventName: string,
  data: MetaEventData = {},
  consent?: boolean,
): string | null {
  if (!config?.enabled || !config.capi_enabled || !hasConsent(config, consent)) return null;
  const eventId = data.event_id ?? createMetaEventId(eventName.toLowerCase());
  const ids = getMetaIdentifiers();
  void apiPost("/checkout/meta/event", {
    store_id: storeId,
    event_name: eventName,
    event_id: eventId,
    event_time: Math.floor(Date.now() / 1000),
    event_source_url: typeof window !== "undefined" ? window.location.href : undefined,
    consent: consent ?? !config.require_consent,
    fbp: ids.fbp,
    fbc: ids.fbc,
    user_data: {
      email: data.email,
      phone: data.phone,
      name: data.name,
      city: data.city,
      state: data.state,
      zip: data.zip,
      country: data.country ?? "br",
    },
    custom_data: {
      value: data.value,
      currency: data.currency ?? "BRL",
      content_ids: data.content_ids,
      contents: data.contents,
      content_type: data.content_type ?? "product",
      num_items: data.num_items,
      order_id: data.order_id,
      payment_method: data.payment_method,
      installments: data.installments,
    },
  }).catch(() => {
    // Tracking nunca deve interromper o checkout.
  });
  return eventId;
}

export function trackMetaEvent(
  config: MetaPixelConfig | null | undefined,
  storeId: number,
  eventName: string,
  data: MetaEventData = {},
  consent?: boolean,
): string | null {
  if (!hasConsent(config, consent)) return null;
  const eventId = data.event_id ?? createMetaEventId(eventName.toLowerCase());
  trackMetaBrowserEvent(config, eventName, { ...data, event_id: eventId }, consent);
  if (eventName !== "Purchase") sendMetaServerEvent(config, storeId, eventName, { ...data, event_id: eventId }, consent);
  return eventId;
}

export function shouldFireForMetaProducts(config: MetaPixelConfig | null | undefined, productIds: number[]): boolean {
  if (!config?.enabled) return false;
  if (!config.only_selected_products) return true;
  const selected = config.selected_product_ids ?? [];
  return selected.length > 0 && productIds.some((id) => selected.includes(id));
}

export function isMetaPurchaseFired(orderId: string): boolean {
  if (typeof window === "undefined") return true;
  try { return sessionStorage.getItem(FIRED_PREFIX + orderId) === "1"; } catch { return true; }
}

export function markMetaPurchaseFired(orderId: string): void {
  if (typeof window === "undefined") return;
  try { sessionStorage.setItem(FIRED_PREFIX + orderId, "1"); } catch { /* ignore */ }
}

export function persistMetaPixelConfig(config: MetaPixelConfig | null | undefined): void {
  if (typeof window === "undefined") return;
  try {
    if (config?.enabled) sessionStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
    else sessionStorage.removeItem(CONFIG_STORAGE_KEY);
  } catch { /* ignore */ }
}

export function readMetaPixelConfig(): MetaPixelConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) return null;
    const config = JSON.parse(raw) as MetaPixelConfig;
    return config?.enabled ? config : null;
  } catch { return null; }
}

export function persistMetaConsent(consent: boolean): void {
  if (typeof window === "undefined") return;
  try { sessionStorage.setItem(CONSENT_STORAGE_KEY, consent ? "1" : "0"); } catch { /* ignore */ }
}

export function readMetaConsent(): boolean {
  if (typeof window === "undefined") return false;
  try { return sessionStorage.getItem(CONSENT_STORAGE_KEY) === "1"; } catch { return false; }
}
