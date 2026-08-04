import { apiPost } from "@/lib/api";
import type { KwaiPixelConfig } from "@/types";

declare global {
  interface Window {
    kwaiq?: KwaiQueue;
  }
}

type KwaiInstance = {
  track?: (eventName: string, properties?: Record<string, unknown>) => void;
};

type KwaiQueue = {
  push: (...args: unknown[]) => void;
  load?: (pixelCode: string) => void;
  page?: () => void;
  instance?: (pixelCode: string) => KwaiInstance;
  track?: (eventName: string, properties?: Record<string, unknown>) => void;
  [key: string]: unknown;
};

const CONFIG_STORAGE_KEY = "kwai_pixel_config_v1";
const CONSENT_STORAGE_KEY = "kwai_pixel_consent_v1";
const FIRED_PREFIX = "kwai_pixel_fired_";
let loadedPixelCode: string | null = null;

export interface KwaiEventData {
  event_id?: string;
  value?: number;
  currency?: string;
  content_id?: string;
  content_ids?: string[];
  content_type?: "product" | "product_group" | string;
  contents?: { content_id: string; content_name?: string; content_category?: string; content_type?: string; brand?: string; sku?: string; quantity: number; price?: number }[];
  quantity?: number;
  description?: string;
  order_id?: string;
  payment_method?: string;
  installments?: number;
  shipping_price?: number;
  coupon?: string;
  email?: string;
  phone?: string;
  external_id?: string;
  click_id?: string;
  utm_source?: string;
  utm_campaign?: string;
  utm_medium?: string;
  utm_content?: string;
  utm_term?: string;
}

function hasConsent(config: KwaiPixelConfig | null | undefined, consent?: boolean): boolean {
  if (typeof navigator !== "undefined" && navigator.doNotTrack === "1") return false;
  return !config?.require_consent || consent === true;
}

function createQueue(): KwaiQueue {
  const queue = (window.kwaiq ?? []) as KwaiQueue;
  if (!queue.push) queue.push = (...args: unknown[]) => Array.prototype.push.call(queue, args);
  if (!queue.load) queue.load = (pixelCode: string) => queue.push(["load", pixelCode]);
  if (!queue.page) queue.page = () => queue.push(["page"]);
  if (!queue.instance) queue.instance = (pixelCode: string) => ({
    track: (eventName: string, properties?: Record<string, unknown>) => queue.push(["track", pixelCode, eventName, properties ?? {}]),
  });
  window.kwaiq = queue;
  return queue;
}

export function loadKwaiPixel(pixelCode: string): void {
  if (typeof window === "undefined" || !pixelCode || loadedPixelCode === pixelCode) return;
  const kwaiq = createQueue();
  kwaiq.load?.(pixelCode);
  kwaiq.page?.();
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://s1.kwai.net/kos/s101/nlav11187/pixel/core/checkPixel.js?sdkid=${encodeURIComponent(pixelCode)}&lib=kwaiq`;
  document.head.appendChild(script);
  loadedPixelCode = pixelCode;
}

export function createKwaiEventId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const found = document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return found ? decodeURIComponent(found.slice(name.length + 1)) : undefined;
}

export function getKwaiIdentifiers(): { click_id?: string } {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  let clickId = params.get("kwai_click_id") || params.get("click_id") || params.get("kclid") || params.get("kwai_clickid") || undefined;
  try {
    if (clickId) sessionStorage.setItem("kwai_click_id_v1", clickId);
    else clickId = sessionStorage.getItem("kwai_click_id_v1") || undefined;
  } catch {
    // Storage may be blocked; URL value remains usable for the current page.
  }
  return { click_id: clickId || readCookie("_kwai_click_id") || readCookie("kwai_click_id") };
}

export function getKwaiTrackingParameters(): Record<string, string | null> {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const ids = getKwaiIdentifiers();
  const result: Record<string, string | null> = {
    kwai_click_id: ids.click_id ?? null,
    landing_page: window.location.href,
    referrer: document.referrer || null,
    client_user_agent: navigator.userAgent,
    client_ip_address: null,
  };
  for (const key of ["src", "sck", "utm_source", "utm_campaign", "utm_medium", "utm_content", "utm_term"]) result[key] = params.get(key);
  return result;
}

const EVENT_NAMES: Record<string, string> = {
  ViewContent: "contentView",
  AddToCart: "addToCart",
  InitiateCheckout: "initiateCheckout",
  AddPaymentInfo: "addPaymentInfo",
  Purchase: "purchase",
};

export function trackKwaiBrowserEvent(config: KwaiPixelConfig | null | undefined, eventName: string, data: KwaiEventData = {}, consent?: boolean): string | null {
  if (!config?.enabled || !config.browser_enabled || !config.pixel_code || !hasConsent(config, consent)) return null;
  loadKwaiPixel(config.pixel_code);
  const eventId = data.event_id ?? createKwaiEventId(eventName.toLowerCase());
  const { event_id: _eventId, ...properties } = data;
  if (eventName === "PageView") window.kwaiq?.page?.();
  else window.kwaiq?.instance?.(config.pixel_code).track?.(EVENT_NAMES[eventName] ?? eventName, { ...properties, event_id: eventId });
  return eventId;
}

export function sendKwaiServerEvent(config: KwaiPixelConfig | null | undefined, storeId: number, eventName: string, data: KwaiEventData = {}, consent?: boolean): string | null {
  if (!config?.enabled || !config.events_api_enabled || !hasConsent(config, consent)) return null;
  const eventId = data.event_id ?? createKwaiEventId(eventName.toLowerCase());
  const identifiers = getKwaiIdentifiers();
  const tracking = getKwaiTrackingParameters();
  void apiPost("/checkout/kwai/event", {
    store_id: storeId,
    event: eventName,
    event_id: eventId,
    event_time: Math.floor(Date.now() / 1000),
    event_source_url: typeof window !== "undefined" ? window.location.href : undefined,
    page_referrer: typeof document !== "undefined" ? document.referrer || undefined : undefined,
    consent: consent ?? !config.require_consent,
    click_id: identifiers.click_id,
    user_data: { email: data.email, phone: data.phone, external_id: data.external_id },
    custom_data: {
      value: data.value, currency: data.currency ?? "BRL", content_id: data.content_id, content_ids: data.content_ids,
      contents: data.contents, content_type: data.content_type ?? "product", quantity: data.quantity,
      description: data.description, order_id: data.order_id, payment_method: data.payment_method,
      installments: data.installments, shipping_price: data.shipping_price, coupon: data.coupon,
      utm_source: tracking.utm_source, utm_campaign: tracking.utm_campaign, utm_medium: tracking.utm_medium,
      utm_content: tracking.utm_content, utm_term: tracking.utm_term,
    },
  }).catch(() => {
    // Tracking nunca deve interromper o checkout.
  });
  return eventId;
}

export function trackKwaiEvent(config: KwaiPixelConfig | null | undefined, storeId: number, eventName: string, data: KwaiEventData = {}, consent?: boolean): string | null {
  if (!hasConsent(config, consent)) return null;
  const eventId = data.event_id ?? createKwaiEventId(eventName.toLowerCase());
  trackKwaiBrowserEvent(config, eventName, { ...data, event_id: eventId }, consent);
  if (eventName !== "Purchase") sendKwaiServerEvent(config, storeId, eventName, { ...data, event_id: eventId }, consent);
  return eventId;
}

export function shouldFireForKwaiProducts(config: KwaiPixelConfig | null | undefined, productIds: number[]): boolean {
  if (!config?.enabled) return false;
  if (!config.only_selected_products) return true;
  const selected = config.selected_product_ids ?? [];
  return selected.length > 0 && productIds.some((id) => selected.includes(id));
}

export function isKwaiPurchaseFired(orderId: string): boolean {
  if (typeof window === "undefined") return true;
  try { return sessionStorage.getItem(FIRED_PREFIX + orderId) === "1"; } catch { return true; }
}

export function markKwaiPurchaseFired(orderId: string): void {
  if (typeof window === "undefined") return;
  try { sessionStorage.setItem(FIRED_PREFIX + orderId, "1"); } catch { /* ignore */ }
}

export function persistKwaiPixelConfig(config: KwaiPixelConfig | null | undefined): void {
  if (typeof window === "undefined") return;
  try { if (config?.enabled) sessionStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config)); else sessionStorage.removeItem(CONFIG_STORAGE_KEY); } catch { /* ignore */ }
}

export function readKwaiPixelConfig(): KwaiPixelConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) return null;
    const config = JSON.parse(raw) as KwaiPixelConfig;
    return config?.enabled ? config : null;
  } catch { return null; }
}

export function persistKwaiConsent(consent: boolean): void {
  if (typeof window === "undefined") return;
  try { sessionStorage.setItem(CONSENT_STORAGE_KEY, consent ? "1" : "0"); } catch { /* ignore */ }
}

export function readKwaiConsent(): boolean {
  if (typeof window === "undefined") return false;
  try { return sessionStorage.getItem(CONSENT_STORAGE_KEY) === "1"; } catch { return false; }
}
