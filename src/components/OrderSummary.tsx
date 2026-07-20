"use client";

import React, { useState, useEffect } from "react";
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

  const [isExpanded, setIsExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    handleResize(); // Check initially
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const showContent = !isMobile || isExpanded;

  return (
    <div>
      {/* Title / Mobile Header */}
      {isMobile ? (
        <div
          onClick={() => setIsExpanded(!isExpanded)}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            cursor: "pointer",
            marginBottom: showContent ? 16 : 0,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: "1.1rem", fontWeight: 700 }}>Seu carrinho</span>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Informações da sua compra</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "1.1rem", fontWeight: 700 }}>{formatCurrency(finalTotal)}</span>
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{
                transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.2s",
                color: "#9c27b0",
              }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>
      ) : (
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 12 }}>{title}</h2>
      )}

      {/* Content wrapper */}
      <div style={{ display: showContent ? "block" : "none" }}>
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
                {g.product.parent_title || g.product.name}
              </div>
              {g.product.attributes && g.product.attributes.length > 0 && (
                <div style={{ marginTop: 2, display: "flex", flexDirection: "column", gap: 1 }}>
                  {g.product.attributes.slice(0, 3).map((attr, idx) => (
                    <div
                      key={idx}
                      style={{ fontSize: "0.7rem", color: "var(--text-muted)", lineHeight: 1.2 }}
                    >
                      {attr.name}: {attr.value}
                    </div>
                  ))}
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

    </div>
  );
}