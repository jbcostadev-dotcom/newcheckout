"use client";

import { useState } from "react";
import type { OrderBumpOffer } from "@/types";
import { formatCurrency } from "@/lib/utils";

interface OrderBumpCardProps {
  bump: OrderBumpOffer;
  selected: boolean;
  onToggle: (selected: boolean) => void;
}

export default function OrderBumpCard({ bump, selected, onToggle }: OrderBumpCardProps) {
  const { product } = bump;

  const handleClick = () => onToggle(!selected);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
      style={{
        background: bump.bg_color,
        border: `1.5px solid ${selected ? bump.button_color : bump.border_color}`,
        borderRadius: 12,
        padding: 14,
        cursor: "pointer",
        position: "relative",
        opacity: selected ? 1 : 0.95,
        transition: "border-color 0.15s ease, transform 0.05s ease",
      }}
    >
      {/* Indicador de seleção no canto superior */}
      <div
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          width: 22,
          height: 22,
          borderRadius: "50%",
          border: `2px solid ${selected ? bump.button_color : bump.border_color}`,
          background: selected ? bump.button_color : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {selected && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={bump.button_text_color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
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
            style={{
              marginTop: 10,
              width: "100%",
              padding: "8px 12px",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              fontSize: "0.8rem",
              fontWeight: 700,
              background: bump.button_color,
              color: bump.button_text_color,
            }}
          >
            {selected ? "✓ " + (bump.button_label || "Quero essa oferta") : (bump.button_label || "Quero essa oferta")}
          </button>
        </div>
      </div>
    </div>
  );
}