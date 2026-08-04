import { apiPost } from "@/lib/api";
import type { TaboolaPixelConfig } from "@/types";

declare global {
  interface Window { _tfa?: TaboolaQueue; }
}

type TaboolaQueue = { push: (...args: unknown[]) => void; [key: string]: unknown };
const CONFIG_STORAGE_KEY = "taboola_pixel_config_v1";
const CONSENT_STORAGE_KEY = "taboola_pixel_consent_v1";
const FIRED_PREFIX = "taboola_pixel_fired_";
let loadedAccountId: string | null = null;

export interface TaboolaEventData {
  event_id?: string;
  value?: number;
  currency?: string;
  quantity?: number;
  order_id?: string;
  email?: string;
  payment_method?: string;
  shipping_price?: number;
  coupon?: string;
  content_id?: string;
  content_ids?: string[];
  contents?: { content_id: string; content_name?: string; content_category?: string; brand?: string; sku?: string; quantity: number; price?: number }[];
  [key: string]: unknown;
}

function hasConsent(config: TaboolaPixelConfig | null | undefined, consent?: boolean): boolean {
  if (typeof navigator !== "undefined" && navigator.doNotTrack === "1") return false;
  return !config?.require_consent || consent === true;
}

function createQueue(): TaboolaQueue {
  const queue = (window._tfa ?? []) as TaboolaQueue;
  if (!queue.push) queue.push = (...args: unknown[]) => Array.prototype.push.call(queue, args);
  window._tfa = queue;
  return queue;
}

export function loadTaboolaPixel(accountId: string): void {
  if (typeof window === "undefined" || !accountId || loadedAccountId === accountId) return;
  const queue = createQueue();
  const scriptId = `taboola-pixel-${accountId}`;
  if (!document.getElementById(scriptId)) {
    const script = document.createElement("script");
    script.id = scriptId;
    script.async = true;
    script.src = `https://cdn.taboola.com/libtrc/unip/${encodeURIComponent(accountId)}/tfa.js`;
    document.head.appendChild(script);
  }
  queue.push({ notify: "event", name: "page_view", id: accountId });
  loadedAccountId = accountId;
}

export function createTaboolaEventId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function eventName(config: TaboolaPixelConfig, semantic: string): string {
  const map: Record<string, keyof TaboolaPixelConfig> = {
    PageView: "page_view_event_name", ViewContent: "view_content_event_name", AddToCart: "add_to_cart_event_name",
    InitiateCheckout: "initiate_checkout_event_name", AddPaymentInfo: "add_payment_info_event_name", Purchase: "purchase_event_name",
  };
  return String((map[semantic] && config[map[semantic]]) || (semantic === "PageView" ? "page_view" : semantic.toUpperCase()));
}

async function hashEmail(email?: string): Promise<string | undefined> {
  const normalized = email?.trim().toLowerCase();
  if (!normalized || typeof crypto === "undefined" || !crypto.subtle) return undefined;
  const bytes = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function getTaboolaIdentifiers(): { click_id?: string } {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  let clickId = params.get("tblci") || params.get("taboola_click_id") || undefined;
  try {
    if (clickId) sessionStorage.setItem("taboola_click_id_v1", clickId);
    else clickId = sessionStorage.getItem("taboola_click_id_v1") || undefined;
  } catch { /* storage may be unavailable */ }
  return { click_id: clickId };
}

export function getTaboolaTrackingParameters(): Record<string, string | null> {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const { click_id } = getTaboolaIdentifiers();
  const result: Record<string, string | null> = {
    tblci: click_id ?? null,
    taboola_click_id: click_id ?? null,
    landing_page: window.location.href,
    referrer: document.referrer || null,
    client_user_agent: navigator.userAgent,
  };
  for (const key of ["src", "sck", "utm_source", "utm_campaign", "utm_medium", "utm_content", "utm_term"]) result[key] = params.get(key);
  return result;
}

export function trackTaboolaBrowserEvent(config: TaboolaPixelConfig | null | undefined, semantic: string, data: TaboolaEventData = {}, consent?: boolean): string | null {
  if (!config?.enabled || !config.browser_enabled || !config.account_id || !hasConsent(config, consent)) return null;
  loadTaboolaPixel(config.account_id);
  const eventId = data.event_id ?? createTaboolaEventId(semantic.toLowerCase());
  const { event_id: _eventId, email, contents, content_ids, order_id, ...rest } = data;
  const payload: Record<string, unknown> = {
    notify: semantic === "PageView" ? "event" : "ecevent", name: eventName(config, semantic), id: config.account_id, ...rest,
    productIds: content_ids,
    orderId: order_id,
    cartDetails: contents?.map((item) => ({ productId: item.content_id, quantity: item.quantity, price: item.price })),
    additionalInfo: { event_id: eventId },
  };
  if (email) {
    void hashEmail(email).then((unifiedId) => window._tfa?.push({ ...payload, ...(unifiedId ? { unified_id: unifiedId } : {}) }));
  } else {
    window._tfa?.push(payload);
  }
  return eventId;
}

export function sendTaboolaServerEvent(config: TaboolaPixelConfig | null | undefined, storeId: number, semantic: string, data: TaboolaEventData = {}, consent?: boolean): string | null {
  if (!config?.enabled || !config.s2s_enabled || !hasConsent(config, consent)) return null;
  const eventId = data.event_id ?? createTaboolaEventId(semantic.toLowerCase());
  const tracking = getTaboolaTrackingParameters();
  void apiPost("/checkout/taboola/event", {
    store_id: storeId, event: semantic, event_id: eventId, event_time: Math.floor(Date.now() / 1000),
    consent: consent ?? !config.require_consent, click_id: tracking.tblci,
    custom_data: {
      value: data.value, currency: data.currency ?? "BRL", quantity: data.quantity, order_id: data.order_id,
      content_ids: data.content_ids, contents: data.contents,
    },
  }).catch(() => { /* tracking never interrupts checkout */ });
  return eventId;
}

export function trackTaboolaEvent(config: TaboolaPixelConfig | null | undefined, storeId: number, semantic: string, data: TaboolaEventData = {}, consent?: boolean): string | null {
  if (!hasConsent(config, consent)) return null;
  const eventId = data.event_id ?? createTaboolaEventId(semantic.toLowerCase());
  trackTaboolaBrowserEvent(config, semantic, { ...data, event_id: eventId }, consent);
  if (semantic !== "Purchase") sendTaboolaServerEvent(config, storeId, semantic, { ...data, event_id: eventId }, consent);
  return eventId;
}

export function shouldFireForTaboolaProducts(config: TaboolaPixelConfig | null | undefined, productIds: number[]): boolean {
  if (!config?.enabled) return false;
  if (!config.only_selected_products) return true;
  const selected = config.selected_product_ids ?? [];
  return selected.length > 0 && productIds.some((id) => selected.includes(id));
}

export function isTaboolaPurchaseFired(orderId: string): boolean {
  if (typeof window === "undefined") return true;
  try { return sessionStorage.getItem(FIRED_PREFIX + orderId) === "1"; } catch { return true; }
}

export function markTaboolaPurchaseFired(orderId: string): void {
  if (typeof window === "undefined") return;
  try { sessionStorage.setItem(FIRED_PREFIX + orderId, "1"); } catch { /* ignore */ }
}

export function persistTaboolaPixelConfig(config: TaboolaPixelConfig | null | undefined): void {
  if (typeof window === "undefined") return;
  try { if (config?.enabled) sessionStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config)); else sessionStorage.removeItem(CONFIG_STORAGE_KEY); } catch { /* ignore */ }
}

export function readTaboolaPixelConfig(): TaboolaPixelConfig | null {
  if (typeof window === "undefined") return null;
  try { const raw = sessionStorage.getItem(CONFIG_STORAGE_KEY); if (!raw) return null; const config = JSON.parse(raw) as TaboolaPixelConfig; return config?.enabled ? config : null; } catch { return null; }
}

export function persistTaboolaConsent(consent: boolean): void {
  if (typeof window === "undefined") return;
  try { sessionStorage.setItem(CONSENT_STORAGE_KEY, consent ? "1" : "0"); } catch { /* ignore */ }
}

export function readTaboolaConsent(): boolean {
  if (typeof window === "undefined") return false;
  try { return sessionStorage.getItem(CONSENT_STORAGE_KEY) === "1"; } catch { return false; }
}
