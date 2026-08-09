"use client";

import type { OrderBumpOffer } from "@/types";
import { formatCurrency } from "@/lib/utils";

interface OrderBumpCardProps {
  bump: OrderBumpOffer;
  selected: boolean;
  timer?: { secondsLeft: number; expired: boolean };
  onToggle: (selected: boolean) => void;
}

export default function OrderBumpCard({ bump, selected, timer, onToggle }: OrderBumpCardProps) {
  const { product } = bump;

  const timerEnabled = Boolean(bump.scarcity_timer_enabled);
  const isExpired = Boolean(timer?.expired);
  const isSelected = selected && !isExpired;
  const handleClick = () => {
    if (!isExpired) onToggle(!isSelected);
  };

  return (
    <div
      role="button"
      tabIndex={isExpired ? -1 : 0}
      aria-disabled={isExpired}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
      style={{
        background: "var(--order-bump-bg-color)",
        border: `1.5px solid ${isSelected ? "var(--order-bump-button-color)" : "var(--order-bump-border-color)"}`,
        borderRadius: 12,
        padding: 14,
        cursor: isExpired ? "not-allowed" : "pointer",
        position: "relative",
        opacity: isExpired ? 0.65 : isSelected ? 1 : 0.95,
        transition: "border-color 0.15s ease, transform 0.05s ease",
        overflow: "hidden",
      }}
    >
      {/* Indicador de seleção no canto superior */}
      {timerEnabled && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            margin: "-14px -14px 14px",
            padding: "8px 10px",
            background: isExpired ? "#64748b" : "var(--order-bump-button-color)",
            color: "var(--order-bump-button-text-color)",
            fontSize: "0.62rem",
            fontWeight: 800,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m13 2-9 12h7l-1 8 9-12h-7l1-8Z" />
            </svg>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {isExpired ? "Oferta encerrada" : "Oferta especial para você"}
            </span>
          </span>
          <span
            style={{
              flexShrink: 0,
              borderRadius: 999,
              padding: "3px 8px",
              background: "rgba(0, 0, 0, 0.16)",
              fontFamily: "monospace",
              fontSize: "0.72rem",
              letterSpacing: "0.03em",
              textTransform: "none",
            }}
          >
            {isExpired ? "ENCERRADA" : formatCountdown(timer?.secondsLeft ?? 0)}
          </span>
        </div>
      )}

      <div
        style={{
          position: "absolute",
          top: timerEnabled ? 48 : 10,
          right: 10,
          width: 22,
          height: 22,
          borderRadius: "50%",
          border: `2px solid ${isSelected ? "var(--order-bump-button-color)" : "var(--order-bump-border-color)"}`,
          background: isSelected ? "var(--order-bump-button-color)" : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {isSelected && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--order-bump-button-text-color)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", paddingRight: 28 }}>
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image_url}
            alt=""
            style={{
              width: 56,
              height: 56,
              borderRadius: 8,
              objectFit: "cover",
              flexShrink: 0,
            }}
          />
        ) : (
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 8,
              background: "rgba(0,0,0,0.06)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              color: "var(--text-muted)",
              fontSize: 22,
            }}
          >
            +
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          {bump.offer_title && (
            <p
              style={{
                fontSize: "0.85rem",
                fontWeight: 700,
                color: "var(--text-primary)",
                marginBottom: 2,
                lineHeight: 1.2,
              }}
            >
              {bump.offer_title}
            </p>
          )}
          <p
            style={{
              fontSize: "0.8rem",
              fontWeight: 600,
              color: "var(--text-primary)",
              marginBottom: 4,
            }}
          >
            {product.name}
          </p>
          {bump.offer_message && (
            <p
              style={{
                fontSize: "0.75rem",
                color: "var(--text-secondary)",
                marginBottom: 6,
                lineHeight: 1.3,
              }}
            >
              {bump.offer_message}
            </p>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: "0.75rem",
                color: "var(--text-muted)",
                textDecoration: "line-through",
              }}
            >
              {formatCurrency(product.original_price)}
            </span>
            <span
              style={{
                fontSize: "0.95rem",
                fontWeight: 700,
                color: "var(--text-primary)",
              }}
            >
              {formatCurrency(product.bump_price)}
            </span>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleClick();
            }}
            disabled={isExpired}
            style={{
              marginTop: 10,
              width: "100%",
              padding: "8px 12px",
              borderRadius: 8,
              border: "none",
              cursor: isExpired ? "not-allowed" : "pointer",
              fontSize: "0.8rem",
              fontWeight: 700,
              background: isExpired ? "#64748b" : "var(--order-bump-button-color)",
              color: "var(--order-bump-button-text-color)",
            }}
          >
            {isExpired ? "Oferta encerrada" : isSelected ? "✓ " + (bump.button_label || "Quero essa oferta") : (bump.button_label || "Quero essa oferta")}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatCountdown(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
