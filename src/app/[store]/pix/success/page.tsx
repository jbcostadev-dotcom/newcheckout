"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import Loading from "../[orderId]/loading";

export default function PixSuccessPage() {
  return (
    <Suspense fallback={<Loading />}>
      <PixSuccessContent />
    </Suspense>
  );
}

function PixSuccessContent() {
  const params = useParams();
  const storeSlug = params.store as string;

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
          padding: 48,
          textAlign: "center",
          maxWidth: 480,
          width: "100%",
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "var(--green-primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px",
          }}
        >
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#ffffff"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2
          style={{
            fontSize: "1.5rem",
            fontWeight: 700,
            color: "var(--text-primary)",
            marginBottom: 12,
          }}
        >
          Pagamento confirmado!
        </h2>
        <p style={{ fontSize: "0.95rem", color: "var(--text-secondary)", marginBottom: 24 }}>
          Obrigado pela sua compra. Você receberá um e-mail com os detalhes do pedido em breve.
        </p>
        <a
          href={`/${storeSlug}/checkout`}
          style={{
            display: "inline-block",
            padding: "12px 24px",
            borderRadius: 8,
            background: "var(--green-primary)",
            color: "#ffffff",
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          Voltar à loja
        </a>
      </div>
    </div>
  );
}
