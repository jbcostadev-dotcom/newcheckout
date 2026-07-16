"use client";

import { Suspense } from "react";

export default function BoletoPreviewPage() {
  return (
    <Suspense fallback={null}>
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
            padding: 40,
            textAlign: "center",
            maxWidth: 480,
            color: "var(--text-primary)",
          }}
        >
          <h2 style={{ fontSize: "1.4rem", fontWeight: 700 }}>Pré-visualização do Boleto</h2>
          <p style={{ marginTop: 8, fontSize: "0.9rem", color: "var(--text-muted)" }}>
            No modo de visualização do editor, o boleto não é gerado.
          </p>
        </div>
      </div>
    </Suspense>
  );
}