"use client";

import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiGet } from "@/lib/api";
import type { PixStatusResponse } from "@/types";
import PixPaymentView, { type PixPaymentSettings } from "@/components/PixPaymentView";
import Loading from "./loading";

const POLL_INTERVAL_MS = 10000;
const SETTINGS_STORAGE_KEY = "pix_page_settings";

export default function PixPage() {
  return (
    <Suspense fallback={<Loading />}>
      <PixPageContent />
    </Suspense>
  );
}

function PixPageContent() {
  const params = useParams();
  const router = useRouter();
  const storeSlug = params.store as string;
  const orderId = parseInt(params.orderId as string, 10);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PixStatusResponse | null>(null);
  const [settings, setSettings] = useState<PixPaymentSettings>({});

  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SETTINGS_STORAGE_KEY);
      if (raw) {
        setSettings(JSON.parse(raw));
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  const fetchPixStatus = useCallback(async () => {
    if (!orderId || isNaN(orderId)) {
      setError("Pedido inválido.");
      setLoading(false);
      return;
    }

    try {
      const res = await apiGet<PixStatusResponse>(`/checkout/order/${orderId}/pix`);
      setData(res);

      if (res.status === "paid" || res.status === "authorized") {
        router.push(`/${storeSlug}/confirmed/${orderId}`);
      } else if (res.status === "refused" || res.status === "canceled" || res.status === "failed") {
        setError("O pagamento foi recusado ou cancelado.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar pagamento.");
    } finally {
      setLoading(false);
    }
  }, [orderId, router, storeSlug]);

  useEffect(() => {
    fetchPixStatus();

    pollingRef.current = setInterval(() => {
      fetchPixStatus();
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [fetchPixStatus]);

  if (loading) {
    return <Loading />;
  }

  if (error || !data) {
    return (
      <div
        style={{
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--checkout-bg)",
          padding: 24,
          textAlign: "center",
        }}
      >
        <div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary)" }}>
            Pagamento indisponível
          </h2>
          <p style={{ marginTop: 8, fontSize: "0.9rem", color: "var(--text-muted)" }}>
            {error ?? "Não foi possível carregar os dados do pagamento."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <PixPaymentView
      storeName={data.store_name ?? "Nome da Loja"}
      total={data.total}
      copiaECola={data.pix_copia_cola ?? ""}
      createdAt={data.created_at}
      expiresAt={data.gateway_expires_at}
      initialSettings={settings}
    />
  );
}
