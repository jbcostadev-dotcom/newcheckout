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
  subtotal?: number;
  shipping?: number;
  total: number;
  onQtyChange?: (productId: number, delta: number) => void;
  discount?: number;
  title?: string;
  showDiscount?: boolean;
  couponEnabled?: boolean;
}


export default function OrderSummary({
  items,
  subtotal,
  shipping = 0,
  total,
  onQtyChange,
  discount = 0,
  title = "Resumo do pedido",
  showDiscount = true,
  couponEnabled = true,
}: OrderSummaryProps) {
  const finalTotal = total - discount;
  const productTotal = subtotal !== undefined ? subtotal : total - shipping;

  return (
    <div>
      {/* Title */}
      <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 12 }}>{title}</h2>

      {/* Coupon link */}
      {couponEnabled && (
        <button type="button" className="coupon-link" style={{ marginBottom: 16 }}>
          <span>🎟️</span>
          Inserir cupom de desconto
        </button>
      )}

      {/* Price breakdown */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem" }}>
          <span>Produtos</span>
          <span>{formatCurrency(productTotal)}</span>
        </div>
        {shipping > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem" }}>
            <span>Frete</span>
            <span>{formatCurrency(shipping)}</span>
          </div>
        )}
        {showDiscount && discount > 0 && (
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
              <div style={{ fontSize: "0.85rem", fontWeight: 600, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
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


    </div>
  );
}