import { apiPost } from "@/lib/api";
import type { TikTokPixelConfig } from "@/types";

declare global {
  interface Window {
    ttq?: TikTokQueue;
  }
}

type TikTokQueue = {
  push: (...args: unknown[]) => void;
  load?: (pixelCode: string) => void;
  page?: () => void;
  track?: (eventName: string, properties?: Record<string, unknown>, options?: Record<string, unknown>) => void;
  methods?: string[];
  setAndDefer?: (target: TikTokQueue, method: string) => void;
};

const CONFIG_STORAGE_KEY = "tiktok_pixel_config_v1";
const CONSENT_STORAGE_KEY = "tiktok_pixel_consent_v1";
const FIRED_PREFIX = "tiktok_pixel_fired_";
let loadedPixelCode: string | null = null;

export interface TikTokEventData {
  event_id?: string;
  value?: number;
  currency?: string;
  content_id?: string;
  content_ids?: string[];
  content_type?: string;
  contents?: {
    content_id: string;
    content_name?: string;
    content_category?: string;
    content_type?: string;
    brand?: string;
    sku?: string;
    quantity: number;
    price?: number;
  }[];
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
  ttclid?: string;
  ttp?: string;
  src?: string;
  sck?: string;
  utm_source?: string;
  utm_campaign?: string;
  utm_medium?: string;
  utm_content?: string;
  utm_term?: string;
}

function hasConsent(config: TikTokPixelConfig | null | undefined, consent?: boolean): boolean {
  if (typeof navigator !== "undefined" && navigator.doNotTrack === "1") return false;
  return !config?.require_consent || consent === true;
}

function createQueue(): TikTokQueue {
  const queue = ((window.ttq ?? []) as TikTokQueue);
  if (!queue.push) queue.push = (...args: unknown[]) => Array.prototype.push.call(queue, args);
  const methods = ["load", "page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie"];
  queue.methods = methods;
  queue.setAndDefer = (target, method) => {
    target[method as keyof TikTokQueue] = ((...args: unknown[]) => target.push([method, ...args])) as never;
  };
  methods.forEach((method) => queue.setAndDefer?.(queue, method));
  window.ttq = queue;
  return queue;
}

export function loadTikTokPixel(pixelCode: string): void {
  if (typeof window === "undefined" || !pixelCode || loadedPixelCode === pixelCode) return;
  const ttq = createQueue();
  ttq.load?.(pixelCode);
  ttq.page?.();
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=${encodeURIComponent(pixelCode)}&lib=ttq`;
  document.head.appendChild(script);
  loadedPixelCode = pixelCode;
}

export function createTikTokEventId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const found = document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return found ? decodeURIComponent(found.slice(name.length + 1)) : undefined;
}

export function getTikTokIdentifiers(): { ttclid?: string; ttp?: string } {
  if (typeof window === "undefined") return {};
  let ttclid = new URLSearchParams(window.location.search).get("ttclid") || undefined;
  try {
    if (ttclid) sessionStorage.setItem("tiktok_ttclid_v1", ttclid);
    else ttclid = sessionStorage.getItem("tiktok_ttclid_v1") || undefined;
  } catch {
    // Storage may be blocked; the URL value is still usable for this page.
  }
  return {
    ttclid,
    ttp: readCookie("_ttp"),
  };
}

export function getTikTokTrackingParameters(): Record<string, string | null> {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const ids = getTikTokIdentifiers();
  const values: Record<string, string | null> = {
    ttclid: ids.ttclid ?? null,
    ttp: ids.ttp ?? null,
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

export function trackTikTokBrowserEvent(
  config: TikTokPixelConfig | null | undefined,
  eventName: string,
  data: TikTokEventData = {},
  consent?: boolean,
): string | null {
  if (!config?.enabled || !config.browser_enabled || !config.pixel_code || !hasConsent(config, consent)) return null;
  loadTikTokPixel(config.pixel_code);
  const eventId = data.event_id ?? createTikTokEventId(eventName.toLowerCase());
  const { event_id: _eventId, ...properties } = data;
  window.ttq?.track?.(eventName, properties, { event_id: eventId });
  return eventId;
}

export function sendTikTokServerEvent(
  config: TikTokPixelConfig | null | undefined,
  storeId: number,
  eventName: string,
  data: TikTokEventData = {},
  consent?: boolean,
): string | null {
  if (!config?.enabled || !config.events_api_enabled || !hasConsent(config, consent)) return null;
  const eventId = data.event_id ?? createTikTokEventId(eventName.toLowerCase());
  const ids = getTikTokIdentifiers();
  const tracking = getTikTokTrackingParameters();
  void apiPost("/checkout/tiktok/event", {
    store_id: storeId,
    event: eventName,
    event_id: eventId,
    event_time: Math.floor(Date.now() / 1000),
    event_source_url: typeof window !== "undefined" ? window.location.href : undefined,
    page_referrer: typeof document !== "undefined" ? document.referrer || undefined : undefined,
    consent: consent ?? !config.require_consent,
    ttclid: ids.ttclid,
    ttp: ids.ttp,
    user_data: {
      email: data.email,
      phone: data.phone,
      external_id: data.external_id,
    },
      custom_data: {
      value: data.value,
      currency: data.currency ?? "BRL",
      content_id: data.content_id,
      content_ids: data.content_ids,
      contents: data.contents,
      content_type: data.content_type ?? "product",
      quantity: data.quantity,
      description: data.description,
      order_id: data.order_id,
      payment_method: data.payment_method,
      installments: data.installments,
      shipping_price: data.shipping_price,
      coupon: data.coupon,
      src: tracking.src,
      sck: tracking.sck,
      utm_source: tracking.utm_source,
      utm_campaign: tracking.utm_campaign,
      utm_medium: tracking.utm_medium,
      utm_content: tracking.utm_content,
      utm_term: tracking.utm_term,
    },
  }).catch(() => {
    // Tracking nunca deve interromper o checkout.
  });
  return eventId;
}

export function trackTikTokEvent(
  config: TikTokPixelConfig | null | undefined,
  storeId: number,
  eventName: string,
  data: TikTokEventData = {},
  consent?: boolean,
): string | null {
  if (!hasConsent(config, consent)) return null;
  const eventId = data.event_id ?? createTikTokEventId(eventName.toLowerCase());
  trackTikTokBrowserEvent(config, eventName, { ...data, event_id: eventId }, consent);
  if (eventName !== "Purchase") sendTikTokServerEvent(config, storeId, eventName, { ...data, event_id: eventId }, consent);
  return eventId;
}

export function shouldFireForTikTokProducts(config: TikTokPixelConfig | null | undefined, productIds: number[]): boolean {
  if (!config?.enabled) return false;
  if (!config.only_selected_products) return true;
  const selected = config.selected_product_ids ?? [];
  return selected.length > 0 && productIds.some((id) => selected.includes(id));
}

export function isTikTokPurchaseFired(orderId: string): boolean {
  if (typeof window === "undefined") return true;
  try { return sessionStorage.getItem(FIRED_PREFIX + orderId) === "1"; } catch { return true; }
}

export function markTikTokPurchaseFired(orderId: string): void {
  if (typeof window === "undefined") return;
  try { sessionStorage.setItem(FIRED_PREFIX + orderId, "1"); } catch { /* ignore */ }
}

export function persistTikTokPixelConfig(config: TikTokPixelConfig | null | undefined): void {
  if (typeof window === "undefined") return;
  try {
    if (config?.enabled) sessionStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
    else sessionStorage.removeItem(CONFIG_STORAGE_KEY);
  } catch { /* ignore */ }
}

export function readTikTokPixelConfig(): TikTokPixelConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) return null;
    const config = JSON.parse(raw) as TikTokPixelConfig;
    return config?.enabled ? config : null;
  } catch { return null; }
}

export function persistTikTokConsent(consent: boolean): void {
  if (typeof window === "undefined") return;
  try { sessionStorage.setItem(CONSENT_STORAGE_KEY, consent ? "1" : "0"); } catch { /* ignore */ }
}

export function readTikTokConsent(): boolean {
  if (typeof window === "undefined") return false;
  try { return sessionStorage.getItem(CONSENT_STORAGE_KEY) === "1"; } catch { return false; }
}
