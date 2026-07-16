"use client";

import React from "react";
import { maskCardExpiry, maskCardNumber, maskCvv, maskCpf } from "@/lib/masks";
import { formatCurrency } from "@/lib/utils";
import type { CardData } from "@/types";

interface StepPagamentoProps {
  paymentMethod: "pix" | "credit_card";
  setPaymentMethod: (v: "pix" | "credit_card") => void;
  card: CardData;
  setCard: React.Dispatch<React.SetStateAction<CardData>>;
  onFinalize: () => void;
  processing: boolean;
  awaitingPix: boolean;
  pixQrCode: string | null;
  pixCopiaCola: string | null;
  buttonText: string;
  isActive: boolean;
  total: number;
  pixDiscount?: number;
  cardDiscount?: number;
  titleFontSize?: string;
}

export default function StepPagamento({
  paymentMethod,
  setPaymentMethod,
  card,
  setCard,
  onFinalize,
  processing,
  awaitingPix,
  pixQrCode,
  pixCopiaCola,
  buttonText,
  isActive,
  total,
  pixDiscount = 1,
  cardDiscount = 5,
  titleFontSize = "1.25rem",
}: StepPagamentoProps) {
  const cardValid =
    card.number.replace(/\D+/g, "").length >= 13 &&
    /^\d{2}\/\d{2}$/.test(card.expiry) &&
    card.cvv.length >= 3 &&
    card.holder.trim().length >= 3;

  const canFinalize =
    !processing && !awaitingPix && (paymentMethod === "pix" || cardValid);

  const discountPct = paymentMethod === "pix" ? pixDiscount : cardDiscount;
  const discountedTotal = total * (1 - discountPct / 100);

  // Inactive state
  if (!isActive) {
    return (
      <div className="step-card inactive" style={{ opacity: 0.6 }}>
        <div className="step-card-header">
          <h2 className="step-card-title" style={{ fontSize: titleFontSize }}>Pagamento</h2>
          <span className="step-card-counter">3 de 3</span>
        </div>
        <p className="step-card-subtitle">Preencha os dados de entrega para continuar</p>
      </div>
    );
  }

  // Active state
  return (
    <div className="step-card active">
      <div className="step-card-header">
        <h2 className="step-card-title" style={{ fontSize: titleFontSize }}>Pagamento</h2>
        <span className="step-card-counter">3 de 3</span>
      </div>
      <p className="step-card-subtitle">Todas as transações são seguras e criptografadas.</p>

      {/* Payment Method Selection */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {/* Credit Card Option */}
        <div
          className={`payment-method-card ${paymentMethod === "credit_card" ? "selected" : ""}`}
          onClick={() => setPaymentMethod("credit_card")}
        >
          {cardDiscount > 0 && (
            <span className="payment-method-badge">{cardDiscount}% DE DESCONTO</span>
          )}
          <input
            type="radio"
            className="radio-custom"
            checked={paymentMethod === "credit_card"}
            onChange={() => setPaymentMethod("credit_card")}
          />
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--text-secondary)" }}>
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
            <line x1="1" y1="10" x2="23" y2="10" />
          </svg>
          <span style={{ fontSize: "0.95rem", fontWeight: 500 }}>Cartão de crédito</span>
        </div>

        {/* Credit Card Form (inline, shown when credit_card selected) */}
        {paymentMethod === "credit_card" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "4px 0 8px 0" }}>
            <div>
              <label className="checkout-label">Número do cartão</label>
              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  inputMode="numeric"
                  className="checkout-input"
                  placeholder="0000 0000 0000 0000"
                  value={card.number}
                  onChange={(e) =>
                    setCard((prev) => ({ ...prev, number: maskCardNumber(e.target.value) }))
                  }
                  style={{ paddingRight: 40 }}
                />
                <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                    <line x1="1" y1="10" x2="23" y2="10" />
                  </svg>
                </span>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label className="checkout-label">Validade <span className="optional">(mês ano)</span></label>
                <input
                  type="text"
                  inputMode="numeric"
                  className="checkout-input"
                  placeholder="MM/AA"
                  value={card.expiry}
                  onChange={(e) =>
                    setCard((prev) => ({ ...prev, expiry: maskCardExpiry(e.target.value) }))
                  }
                />
              </div>
              <div>
                <label className="checkout-label">Cód. de segurança</label>
                <input
                  type="text"
                  inputMode="numeric"
                  className="checkout-input"
                  placeholder="CVV"
                  value={card.cvv}
                  onChange={(e) =>
                    setCard((prev) => ({ ...prev, cvv: maskCvv(e.target.value) }))
                  }
                />
              </div>
            </div>

            <div>
              <label className="checkout-label">Nome impresso no cartão</label>
              <input
                type="text"
                className="checkout-input"
                placeholder="Como está no cartão"
                value={card.holder}
                onChange={(e) =>
                  setCard((prev) => ({ ...prev, holder: e.target.value.toUpperCase() }))
                }
              />
            </div>

            <div>
              <label className="checkout-label">CPF do titular do cartão</label>
              <input
                type="text"
                className="checkout-input"
                placeholder="000.000.000-00"
                value={card.holder_document}
                onChange={(e) =>
                  setCard((prev) => ({ ...prev, holder_document: maskCpf(e.target.value) }))
                }
              />
            </div>

            <div>
              <label className="checkout-label">Parcelas</label>
              <select
                className="checkout-select"
                value={card.installments}
                onChange={(e) =>
                  setCard((prev) => ({ ...prev, installments: parseInt(e.target.value) }))
                }
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                  <option key={n} value={n}>
                    {n}x de {formatCurrency(discountedTotal / n)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* PIX Option */}
        <div
          className={`payment-method-card ${paymentMethod === "pix" ? "selected" : ""}`}
          onClick={() => setPaymentMethod("pix")}
        >
          {pixDiscount > 0 && (
            <span className="payment-method-badge">{pixDiscount}% DE DESCONTO</span>
          )}
          <input
            type="radio"
            className="radio-custom"
            checked={paymentMethod === "pix"}
            onChange={() => setPaymentMethod("pix")}
          />
          <svg width="20" height="20" viewBox="0 0 256 256" fill="none" style={{ color: "#2e7d32" }}>
            <path d="M195.41 195.41a8 8 0 0 1-5.66 2.34H66.25a8 8 0 0 1-5.66-2.34l-36.68-36.69a24 24 0 0 1 0-33.94l36.68-36.69a8 8 0 0 1 5.66-2.34h123.5a8 8 0 0 1 5.66 2.34l36.68 36.69a24 24 0 0 1 0 33.94Z" stroke="currentColor" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{ fontSize: "0.95rem", fontWeight: 500 }}>PIX</span>
        </div>

        {/* PIX info (shown when pix selected) */}
        {paymentMethod === "pix" && !pixQrCode && (
          <div style={{ padding: "8px 0", fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
            <p>O código Pix expira em 30 minutos após finalizar a compra.</p>
            <p style={{ marginTop: 8 }}>
              Valor no Pix: <strong>{formatCurrency(discountedTotal)}</strong>
            </p>
          </div>
        )}

        {/* PIX QR Code display */}
        {pixQrCode && paymentMethod === "pix" && (
          <div style={{ background: "var(--checkout-bg)", borderRadius: 8, padding: 16, marginTop: 8 }}>
            <p style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: 12 }}>QR Code PIX</p>
            <img
              src={pixQrCode}
              alt="QR Code PIX"
              style={{ display: "block", margin: "0 auto", width: 192, height: 192, borderRadius: 8 }}
            />
            {pixCopiaCola && (
              <div
                style={{
                  marginTop: 12,
                  padding: 8,
                  background: "rgba(0,0,0,0.05)",
                  borderRadius: 6,
                  fontSize: "0.75rem",
                  fontFamily: "monospace",
                  wordBreak: "break-all",
                }}
              >
                {pixCopiaCola}
              </div>
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        className="btn-finalize"
        onClick={onFinalize}
        disabled={!canFinalize}
      >
        {processing
          ? "Processando..."
          : awaitingPix
            ? "Aguardando pagamento..."
            : buttonText}
      </button>
    </div>
  );
}