"use client";

import { useEffect, useRef } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export type LiveCheckoutStep = "dados" | "entrega" | "pagamento";

export interface LiveCheckoutItem {
  name: string;
  qty: number;
  unit_price: number;
}

export interface LiveCheckoutData {
  storeId?: string;
  domain?: string;
  step: LiveCheckoutStep;
  customer_name: string;
  customer_email: string;
  cep: string;
  payment_method: "pix" | "credit_card" | "boleto" | "";
  total: number;
  items: LiveCheckoutItem[];
}

const SESSION_KEY = "live_checkout_session_id";

function getOrCreateSessionId(): string {
  if (typeof window === "undefined") {
    return "";
  }
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const id = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }
}

/**
 * Envia heartbeat periódico para o backend indicando que o cliente
 * ainda está ativo no checkout. Mantém uma única sessão por aba e
 * atualiza os dados (nome, etapa, CEP, pagamento, total, itens) no
 * mesmo registro.
 *
 * A sessão expira rapidamente se o heartbeat parar (TTL curto no
 * backend) e também é removida no beforeunload/pagehide da página.
 */
export function useLiveCheckout(
  enabled: boolean,
  storeId: string | undefined,
  domain: string | undefined,
  getData: () => LiveCheckoutData
) {
  const sessionIdRef = useRef<string>("");
  const getDataRef = useRef(getData);

  useEffect(() => {
    getDataRef.current = getData;
  }, [getData]);

  useEffect(() => {
    if (!enabled || !API_URL || typeof window === "undefined") return;

    sessionIdRef.current = getOrCreateSessionId();
    const sessionId = sessionIdRef.current;
    let interval: NodeJS.Timeout | null = null;

    const send = async () => {
      const data = getDataRef.current();
      const payload: Record<string, unknown> = {
        session_id: sessionId,
        step: data.step,
        customer_name: data.customer_name || null,
        customer_email: data.customer_email || null,
        cep: data.cep || null,
        payment_method: data.payment_method || null,
        total: data.total,
        items: data.items,
      };

      if (data.storeId) {
        payload.store_id = data.storeId;
      } else if (data.domain) {
        payload.domain = data.domain;
      }

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
    interval = setInterval(send, 3000);

    const remove = () => {
      try {
        const payload: Record<string, unknown> = { session_id: sessionId };
        if (storeId) {
          payload.store_id = storeId;
        } else if (domain) {
          payload.domain = domain;
        }
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
  }, [enabled, storeId, domain]);
}
