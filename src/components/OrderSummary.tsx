"use client";

import React, { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/utils";
import type { CheckoutProduct, ValidatedCoupon } from "@/types";

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
  onApplyCoupon?: (code: string) => Promise<void>;
  onRemoveCoupon?: () => void;
  appliedCoupon?: ValidatedCoupon | null;
  applyingCoupon?: boolean;
  couponError?: string | null;
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
  onApplyCoupon,
  onRemoveCoupon,
  appliedCoupon,
  applyingCoupon = false,
  couponError = null,
}: OrderSummaryProps) {
  const finalTotal = total - discount;
  const productTotal = subtotal !== undefined ? subtotal : total - shipping;

  const [isExpanded, setIsExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [showInput, setShowInput] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const showContent = !isMobile || isExpanded;

  const handleApply = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!couponInput.trim() || !onApplyCoupon) return;
    await onApplyCoupon(couponInput.trim().toUpperCase());
    setCouponInput("");
  };

  return (
    <div style={{ width: "100%" }}>
      {/* Title / Mobile Header */}
      {isMobile ? (
        <div
          onClick={() => setIsExpanded(!isExpanded)}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            width: "100%",
            cursor: "pointer",
            marginBottom: showContent ? 16 : 0,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: "1.1rem", fontWeight: 700 }}>Seu carrinho</span>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Informações da sua compra</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto", flexShrink: 0 }}>
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
      {/* Coupon */}
      {couponEnabled && (
        <div style={{ marginBottom: 16 }}>
          {appliedCoupon ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px dashed var(--green-primary)",
                background: "rgba(46, 125, 50, 0.06)",
              }}
            >
              <div>
                <p style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--green-primary)" }}>
                  Cupom {appliedCoupon.coupon.code} aplicado
                </p>
                <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  {appliedCoupon.coupon.name}
                </p>
              </div>
              <button
                type="button"
                onClick={onRemoveCoupon}
                style={{
                  fontSize: "0.75rem",
                  color: "#d32f2f",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Remover
              </button>
            </div>
          ) : showInput ? (
            <form
              onSubmit={handleApply}
              style={{
                display: "flex",
                gap: 8,
                maxWidth: 300,
                alignItems: "center",
              }}
            >
              <input
                type="text"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value)}
                placeholder="Digite um cupom"
                disabled={applyingCoupon}
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: couponError ? "1px solid #d32f2f" : "1px solid var(--border-color)",
                  background: "var(--input-bg)",
                  color: "var(--text-primary)",
                  fontSize: "0.82rem",
                  outline: "none",
                }}
              />
              <button
                type="submit"
                disabled={applyingCoupon || !couponInput.trim()}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "none",
                  background: "var(--green-primary)",
                  color: "#fff",
                  fontWeight: 600,
                  fontSize: "0.78rem",
                  lineHeight: 1,
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  cursor: applyingCoupon ? "not-allowed" : "pointer",
                  opacity: applyingCoupon || !couponInput.trim() ? 0.7 : 1,
                }}
              >
                {applyingCoupon ? "Aplicando..." : "Aplicar cupom"}
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setShowInput(true)}
              className="coupon-link"
            >
              <span>🎟️</span>
              Inserir cupom de desconto
            </button>
          )}
          {couponError && (
            <p style={{ marginTop: 6, fontSize: "0.75rem", color: "#d32f2f", textAlign: "center" }}>
              {couponError}
            </p>
          )}
        </div>
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
