"use client";

import React from "react";
import { formatCurrency } from "@/lib/utils";
import type { CheckoutProduct } from "@/types";

export interface GroupedItem {
  product: CheckoutProduct;
  qty: number;
}

interface OrderSummaryProps {
  items: GroupedItem[];
  total: number;
  onQtyChange?: (productId: number, delta: number) => void;
  discount?: number;
}

const REVIEWS = [
  {
    name: "Cliente Satisfeita",
    stars: 5,
    text: "Atendimento excelente e compra rápida. Gostei muito do resultado!",
    avatar: "https://randomuser.me/api/portraits/women/44.jpg",
  },
  {
    name: "Cliente Verificada",
    stars: 4,
    text: "Produto chegou no prazo e a experiência foi incrível.",
    avatar: "https://randomuser.me/api/portraits/women/68.jpg",
  },
];

function StarRating({ count }: { count: number }) {
  return (
    <span className="review-stars">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i}>{i < count ? "★" : "☆"}</span>
      ))}
    </span>
  );
}

export default function OrderSummary({
  items,
  total,
  onQtyChange,
  discount = 0,
}: OrderSummaryProps) {
  const finalTotal = total - discount;

  return (
    <div>
      {/* Title */}
      <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 12 }}>Resumo do pedido</h2>

      {/* Coupon link */}
      <button type="button" className="coupon-link" style={{ marginBottom: 16 }}>
        <span>🎟️</span>
        Inserir cupom de desconto
      </button>

      {/* Price breakdown */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem" }}>
          <span>Produtos</span>
          <span>{formatCurrency(total)}</span>
        </div>
        {discount > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem" }}>
            <span>Descontos</span>
            <span style={{ color: "#2e7d32" }}>-{formatCurrency(discount)} <span style={{ fontSize: "0.7rem", cursor: "pointer" }}>▼</span></span>
          </div>
        )}
      </div>

      {/* Total */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: "1rem",
          fontWeight: 700,
          paddingTop: 8,
          marginBottom: 20,
        }}
      >
        <span>Total</span>
        <span>{formatCurrency(finalTotal)}</span>
      </div>

      {/* Product items */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {items.map((g) => (
          <div
            key={g.product.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: 12,
              background: "var(--checkout-bg)",
              borderRadius: 10,
            }}
          >
            {g.product.image_url ? (
              <img
                src={g.product.image_url}
                alt={g.product.name}
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 8,
                  objectFit: "cover",
                  flexShrink: 0,
                }}
              />
            ) : (
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 8,
                  background: "#e5e5e5",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
            )}

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "0.85rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {g.product.name}
              </div>
              {g.product.description && (
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  {g.product.description}
                </div>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                {formatCurrency(Number(g.product.price) * g.qty)}
              </span>
              {onQtyChange && (
                <div className="qty-controls">
                  <button
                    type="button"
                    className="qty-btn"
                    onClick={() => onQtyChange(g.product.id, -1)}
                  >
                    −
                  </button>
                  <span className="qty-value">{g.qty}</span>
                  <button
                    type="button"
                    className="qty-btn"
                    onClick={() => onQtyChange(g.product.id, 1)}
                  >
                    +
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Reviews */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 24 }}>
        {REVIEWS.map((review, idx) => (
          <div key={idx} className="review-card">
            <img
              src={review.avatar}
              alt={review.name}
              className="review-avatar"
            />
            <div>
              <StarRating count={review.stars} />
              <div className="review-name">{review.name}</div>
              <div className="review-text">{review.text}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}