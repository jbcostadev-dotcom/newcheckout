"use client";

import React from "react";

export default function Footer({ settings, storeName }: { settings: any; storeName?: string }) {
  const {
    footer_show_store_name = true,
    footer_show_payment_methods = true,
    footer_show_cnpj = false,
    footer_cnpj,
    footer_show_terms = false,
    footer_terms_url,
    footer_show_privacy_policy = false,
    footer_privacy_policy_url,
    footer_show_return_policy = false,
    footer_return_policy_url,
    footer_text_color,
    footer_background_color,
    footer_show_security_icons = true,
    footer_icon_color,
  } = settings || {};

  const textColor = footer_text_color || "var(--text-muted)";
  const bgColor = footer_background_color || "var(--checkout-bg)";
  const iconColor = footer_icon_color || "#000000";

  const PaymentIcons = () => (
    <div style={{ display: "flex", gap: "8px", justifyContent: "center", flexWrap: "wrap", marginBottom: "16px" }}>
      {["Amex", "Elo", "Hipercard", "Mastercard", "Visa", "Pix"].map(brand => (
        <div key={brand} style={{ 
          border: "1px solid #ddd", 
          borderRadius: "4px", 
          padding: "4px 8px", 
          fontSize: "10px", 
          fontWeight: "bold",
          color: iconColor,
          background: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minWidth: "40px"
        }}>
          {brand}
        </div>
      ))}
    </div>
  );

  return (
    <footer
      style={{
        padding: "32px 24px",
        textAlign: "center",
        fontSize: "0.75rem",
        color: textColor,
        background: bgColor,
      }}
    >
      {footer_show_payment_methods && (
        <div style={{ marginBottom: "24px" }}>
          <h4 style={{ fontSize: "0.9rem", marginBottom: "12px", color: textColor, fontWeight: 600 }}>
            Formas de pagamento
          </h4>
          <PaymentIcons />
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "6px", alignItems: "center" }}>
        {footer_show_store_name && storeName && (
          <div style={{ fontWeight: 500, fontSize: "0.85rem" }}>
            {storeName}
          </div>
        )}
        
        {footer_show_cnpj && footer_cnpj && (
          <div>
            CNPJ: {footer_cnpj}
          </div>
        )}

        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", justifyContent: "center", marginTop: "4px" }}>
          {footer_show_terms && footer_terms_url && (
            <>
              <a href={footer_terms_url} target="_blank" rel="noopener noreferrer" style={{ color: textColor, textDecoration: "none" }}>
                Termos de uso
              </a>
              {(footer_show_return_policy || footer_show_privacy_policy) && <span>|</span>}
            </>
          )}
          {footer_show_return_policy && footer_return_policy_url && (
            <>
              <a href={footer_return_policy_url} target="_blank" rel="noopener noreferrer" style={{ color: textColor, textDecoration: "none" }}>
                Trocas e devoluções
              </a>
              {footer_show_privacy_policy && <span>|</span>}
            </>
          )}
          {footer_show_privacy_policy && footer_privacy_policy_url && (
            <a href={footer_privacy_policy_url} target="_blank" rel="noopener noreferrer" style={{ color: textColor, textDecoration: "none" }}>
              Política de Privacidade
            </a>
          )}
        </div>
      </div>

      {footer_show_security_icons && (
        <div style={{ display: "flex", gap: "24px", justifyContent: "center", marginTop: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: iconColor }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            <div style={{ textAlign: "left", lineHeight: 1.2 }}>
              <strong style={{ display: "block", fontSize: "0.8rem" }}>SEGURO</strong>
              <span style={{ fontSize: "0.65rem" }}>CERTIFICADO SSL</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: iconColor }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              <path d="M9 12l2 2 4-4"></path>
            </svg>
            <div style={{ textAlign: "left", lineHeight: 1.2 }}>
              <strong style={{ display: "block", fontSize: "0.8rem" }}>PAGAMENTOS</strong>
              <span style={{ fontSize: "0.65rem" }}>SEGUROS</span>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
}
