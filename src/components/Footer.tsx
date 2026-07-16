"use client";

import React from "react";

export default function Footer() {
  return (
    <footer
      style={{
        padding: "12px 24px",
        textAlign: "center",
        fontSize: "0.75rem",
        color: "var(--text-muted)",
        background: "var(--checkout-bg)",
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        🔒 Ambiente seguro · SSL criptografado
      </span>
    </footer>
  );
}