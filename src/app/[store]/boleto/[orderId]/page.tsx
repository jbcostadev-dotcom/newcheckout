"use client";

import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiGet } from "@/lib/api";
import type { PixStatusResponse } from "@/types";
import Loading from "../../pix/[orderId]/loading";

const POLL_INTERVAL_MS = 15000;
const SETTINGS_STORAGE_KEY = "pix_page_settings";

export default function BoletoPage() {
  return (
    <Suspense fallback={<Loading />}>
      <BoletoPageContent />
    </Suspense>
  );
}

function BoletoPageContent() {
  const params = useParams();
  const router = useRouter();
  const storeSlug = params.store as string;
  const orderId = parseInt((params.orderId as string) ?? "", 10);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PixStatusResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!orderId || isNaN(orderId)) {
      setError("Pedido inválido.");
      setLoading(false);
      return;
    }
    try {
      const res = await apiGet<PixStatusResponse>(`/checkout/order/${orderId}/pix`);
      setData(res);
      if (res.status === "paid" || res.status === "authorized") {
        router.push(`/${storeSlug}/boleto/success`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar boleto.");
    } finally {
      setLoading(false);
    }
  }, [orderId, router, storeSlug]);

  useEffect(() => {
    fetchStatus();
    pollingRef.current = setInterval(fetchStatus, POLL_INTERVAL_MS);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [fetchStatus]);

  const handleCopy = async () => {
    if (!data?.boleto_digitable_line) return;
    try {
      await navigator.clipboard.writeText(data.boleto_digitable_line);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // ignore
    }
  };

  if (loading) return <Loading />;

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
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700 }}>Boleto indisponível</h2>
          <p style={{ marginTop: 8, fontSize: "0.9rem", color: "var(--text-muted)" }}>
            {error ?? "Não foi possível carregar o boleto."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--checkout-bg)",
        padding: 24,
      }}
    >
      <div
        style={{
          background: "var(--card-bg)",
          border: "1px solid var(--border-color)",
          borderRadius: 16,
          padding: 32,
          maxWidth: 520,
          width: "100%",
          color: "var(--text-primary)",
        }}
      >
        <h2 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: 4 }}>
          Pague seu boleto
        </h2>
        <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginBottom: 24 }}>
          Valor: <strong>{formatBRL(Number(data.total))}</strong>
        </p>

        {data.boleto_digitable_line && (
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: "0.8rem", color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
              Linha digitável
            </label>
            <div
              style={{
                fontFamily: "monospace",
                fontSize: "0.95rem",
                padding: "12px 14px",
                background: "var(--input-bg)",
                border: "1px solid var(--border-color)",
                borderRadius: 8,
                wordBreak: "break-all",
              }}
            >
              {data.boleto_digitable_line}
            </div>
            <button
              type="button"
              onClick={handleCopy}
              style={{
                marginTop: 10,
                padding: "10px 16px",
                borderRadius: 8,
                background: "var(--green-primary)",
                color: "#fff",
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
              }}
            >
              {copied ? "Copiado!" : "Copiar linha digitável"}
            </button>
          </div>
        )}

        {data.boleto_url && (
          <a
            href={data.boleto_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-block",
              padding: "12px 20px",
              borderRadius: 8,
              background: "var(--green-primary)",
              color: "#fff",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Abrir boleto (HTML)
          </a>
        )}

        <p style={{ marginTop: 16, fontSize: "0.8rem", color: "var(--text-muted)" }}>
          A compensação pode levar até 2 dias úteis. Esta página será
          atualizada automaticamente quando o pagamento for confirmado.
        </p>
      </div>
    </div>
  );
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
}