"use client";

import React from "react";

interface FooterProps {
  footer_text?: string;
  footer_show_cnpj?: boolean;
  footer_cnpj?: string | null;
}

export default function Footer({
  footer_text = "Ambiente seguro · SSL criptografado",
  footer_show_cnpj = false,
  footer_cnpj,
}: FooterProps) {
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
        {footer_text}
      </span>
      {footer_show_cnpj && footer_cnpj && (
        <div style={{ marginTop: 4, fontSize: "0.7rem" }}>
          CNPJ: {footer_cnpj}
        </div>
      )}
    </footer>
  );
}
