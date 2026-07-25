"use client";

import { useEffect, useRef } from "react";
import type { CheckoutProduct } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export type LiveCheckoutStep = "dados" | "entrega" | "pagamento";

export interface LiveCheckoutItem {
  name: string;
  qty: number;
  unit_price: number;
}

export interface LiveCheckoutData {
  domain: string;
  step: LiveCheckoutStep;
  customer_name: string;
  customer_email: string;
  cep: string;
  payment_method: "pix" | "credit_card" | "boleto" | "";
  total: number;
  items: LiveCheckoutItem[];
}

function generateSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function buildItems(products: CheckoutProduct[], ids: number[]): LiveCheckoutItem[] {
  const seen = new Map<number, LiveCheckoutItem>();
  for (const id of ids) {
    const product = products.find((p) => p.id === id);
    if (!product) continue;
    const existing = seen.get(id);
    if (existing) {
      existing.qty += 1;
    } else {
      seen.set(id, {
        name: product.name,
        qty: 1,
        unit_price: Number(product.price),
      });
    }
  }
  return Array.from(seen.values());
}

/**
 * Envia heartbeat periódico para o backend indicando que o cliente
 * ainda está ativo no checkout. A sessão expira sozinha se o heartbeat
 * parar (TTL de 60s), e também é removida no beforeunload da página.
 */
export function useLiveCheckout(
  enabled: boolean,
  domain: string,
  getData: () => LiveCheckoutData,
  products: CheckoutProduct[],
  productIds: number[]
) {
  const sessionIdRef = useRef<string>("");
  const getDataRef = useRef(getData);
  const itemsRef = useRef<LiveCheckoutItem[]>([]);

  useEffect(() => {
    getDataRef.current = getData;
  }, [getData]);

  useEffect(() => {
    itemsRef.current = buildItems(products, productIds);
  }, [products, productIds]);

  useEffect(() => {
    if (!enabled || !API_URL || typeof window === "undefined") return;

    sessionIdRef.current = generateSessionId();
    const sessionId = sessionIdRef.current;
    let interval: NodeJS.Timeout | null = null;
    let lastSent = "";

    const send = async () => {
      const data = getDataRef.current();
      const payload = {
        domain,
        session_id: sessionId,
        step: data.step,
        customer_name: data.customer_name || null,
        customer_email: data.customer_email || null,
        cep: data.cep || null,
        payment_method: data.payment_method || null,
        total: data.total,
        items: itemsRef.current,
      };

      // Evita reenviar exatamente o mesmo payload para economizar requests.
      const payloadHash = JSON.stringify(payload);
      if (payloadHash === lastSent) return;
      lastSent = payloadHash;

      try {
        await fetch(`${API_URL}/api/checkout/live/heartbeat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          keepalive: true,
        });
      } catch {
        // best-effort: falhas silenciosas não quebram o checkout
      }
    };

    send();
    interval = setInterval(send, 10000);

    const remove = () => {
      try {
        const payload = {
          domain,
          session_id: sessionId,
        };
        if (navigator.sendBeacon) {
          navigator.sendBeacon(
            `${API_URL}/api/checkout/live/remove`,
            JSON.stringify(payload)
          );
        } else {
          fetch(`${API_URL}/api/checkout/live/remove`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            keepalive: true,
          }).catch(() => {});
        }
      } catch {
        // ignore
      }
    };

    window.addEventListener("beforeunload", remove);
    window.addEventListener("pagehide", remove);

    return () => {
      if (interval) clearInterval(interval);
      window.removeEventListener("beforeunload", remove);
      window.removeEventListener("pagehide", remove);
      remove();
    };
  }, [enabled, domain, products, productIds]);
}
