"use client";

import React, { useMemo, useState } from "react";
import {
  cvvLengthForBrand,
  getCardBrand,
  isCardExpired,
  isValidLuhn,
  maskCardExpiry,
  maskCardNumber,
  maskCpf,
  maskCvv,
} from "@/lib/masks";
import { formatCurrency } from "@/lib/utils";
import type { CardData, InstallmentConfig, OrderBumpOffer } from "@/types";
import OrderBumpCard from "@/components/OrderBumpCard";

interface StepPagamentoProps {
  paymentMethod: "pix" | "credit_card" | "boleto";
  setPaymentMethod: (v: "pix" | "credit_card" | "boleto") => void;
  card: CardData;
  setCard: React.Dispatch<React.SetStateAction<CardData>>;
  onFinalize: (method?: "pix" | "credit_card" | "boleto") => void;
  processing: boolean;
  awaitingPix: boolean;
  pixQrCode: string | null;
  pixCopiaCola: string | null;
  buttonText: string;
  isActive: boolean;
  total: number;
  pixDiscount?: number;
  cardDiscount?: number;
  boletoDiscount?: number;
  titleFontSize?: string;
  sdkReady?: boolean;
  sdkError?: string | null;
  enabledMethods?: { pix: boolean; card: boolean; boleto: boolean };
  installmentConfig?: InstallmentConfig;
  orderBumps?: OrderBumpOffer[];
  selectedOrderBumpId?: number | null;
  onToggleOrderBump?: (id: number, selected: boolean) => void;
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
  boletoDiscount = 0,
  titleFontSize = "1.25rem",
  sdkReady = true,
  sdkError = null,
  enabledMethods = { pix: true, card: true, boleto: true },
  installmentConfig,
  orderBumps = [],
  selectedOrderBumpId,
  onToggleOrderBump,
}: StepPagamentoProps) {
  const [cardNumberBlurred, setCardNumberBlurred] = useState(false);

  const cardNumberDigits = card.number.replace(/\D+/g, "");
  const cardBrand = getCardBrand(cardNumberDigits);
  const cvvMaxLength = cvvLengthForBrand(cardBrand);
  const luhnValid = isValidLuhn(cardNumberDigits);
  const expiryValid = /^\d{2}\/\d{2}$/.test(card.expiry) && !isCardExpired(card.expiry);
  const cvvValid = card.cvv.length === cvvMaxLength;
  const holderValid = card.holder.trim().length >= 3;

  const numberError =
    cardNumberBlurred && cardNumberDigits.length >= 13 && !luhnValid
      ? "Cartão inválido."
      : null;
  const expiryError =
    card.expiry.length === 5 && !expiryValid
      ? "A validade deve ser a partir do próximo mês."
      : null;
  const cvvError =
    card.cvv.length > 0 && card.cvv.length !== cvvMaxLength
      ? `CVV deve ter ${cvvMaxLength} dígitos.`
      : null;

  const cardValid =
    cardNumberDigits.length >= 13 &&
    luhnValid &&
    expiryValid &&
    cvvValid &&
    holderValid;

  const sdkBlocked = paymentMethod === "credit_card" && !sdkReady;

  const discountPct =
    paymentMethod === "pix"
      ? pixDiscount
      : paymentMethod === "credit_card"
        ? cardDiscount
        : boletoDiscount;
  const discountedTotal = total * (1 - discountPct / 100);

  const installmentOptions = useMemo(() => {
    const config = installmentConfig;
    const limit = config?.limit ?? 12;
    const interestFree = config?.interest_free ?? 1;
    const options: { value: number; label: string }[] = [];

    for (let i = 1; i <= limit; i++) {
      let rate = 0;
      if (config && i > interestFree) {
        if (config.type === "custom") {
          rate = config.rates?.[i - 1] ?? 0;
        } else {
          rate = config.default_rate ?? 0;
        }
      }
      const totalWithInterest = discountedTotal * Math.pow(1 + rate / 100, i);
      const installmentValue = totalWithInterest / i;
      const rateLabel = rate > 0 ? ` (${rate.toString().replace(".", ",")}% a.m.)` : " (sem juros)";
      options.push({
        value: i,
        label: `${i}x de ${formatCurrency(installmentValue)}${rateLabel}`,
      });
    }

    return options;
  }, [discountedTotal, installmentConfig]);

  const handleFinalize = (method: "pix" | "credit_card" | "boleto") => {
    setPaymentMethod(method);
    // Permite que o React aplique o estado e chama onFinalize no próximo tick.
    // Passamos o método explicitamente para evitar problemas de batching.
    setTimeout(() => onFinalize(method), 0);
  };

  const canFinalize = (method: "pix" | "credit_card" | "boleto") => {
    if (processing || awaitingPix) return false;
    if (method === "credit_card" && (!sdkReady || !cardValid)) return false;
    return true;
  };

  const renderBumps = (method: "pix" | "credit_card" | "boleto") => {
    const visible = orderBumps.filter((b) => {
      if (method === "credit_card" && !b.show_credit_card) return false;
      if (method === "pix" && !b.show_pix) return false;
      if (method === "boleto" && !b.show_boleto) return false;
      return true;
    });
    if (visible.length === 0) return null;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12, margin: "16px 0" }}>
        {visible.map((bump) => (
          <OrderBumpCard
            key={bump.id}
            bump={bump}
            selected={selectedOrderBumpId === bump.id}
            onToggle={(sel) => onToggleOrderBump?.(bump.id, sel)}
          />
        ))}
      </div>
    );
  };

  const renderFinalizeButton = (method: "pix" | "credit_card" | "boleto") => {
    const isCard = method === "credit_card";
    const label = isCard
      ? buttonText
      : method === "pix"
        ? "Pagar com PIX"
        : "Gerar boleto";

    return (
      <button
        type="button"
        className="btn-finalize"
        onClick={() => handleFinalize(method)}
        disabled={!canFinalize(method)}
        style={{ marginTop: 4 }}
      >
        {processing ? "Processando..." : label}
      </button>
    );
  };

  // Inactive state
  if (!isActive) {
    return (
      <div className="step-card inactive" style={{ opacity: 0.6 }}>
        <div className="step-card-header">
          <h2 className="step-card-title" style={{ fontSize: titleFontSize }}>
            <span className="step-number">3</span> Pagamento
          </h2>
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
        <h2 className="step-card-title" style={{ fontSize: titleFontSize }}>
          <span className="step-number">3</span> Pagamento
        </h2>
        <span className="step-card-counter">3 de 3</span>
      </div>
      <p className="step-card-subtitle">Todas as transações são seguras e criptografadas.</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {/* Credit Card Option */}
        {enabledMethods.card && (
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
        )}

        {paymentMethod === "credit_card" && enabledMethods.card && (
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
                  onFocus={() => setCardNumberBlurred(false)}
                  onBlur={() => setCardNumberBlurred(true)}
                  style={{ paddingRight: 40, borderColor: numberError ? "#b91c1c" : undefined }}
                />
                <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: numberError ? "#b91c1c" : "var(--text-muted)" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                    <line x1="1" y1="10" x2="23" y2="10" />
                  </svg>
                </span>
              </div>
              {numberError && (
                <p style={{ marginTop: 6, fontSize: "0.8rem", color: "#b91c1c" }}>{numberError}</p>
              )}
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
                  style={{ borderColor: expiryError ? "#b91c1c" : undefined }}
                />
                {expiryError && (
                  <p style={{ marginTop: 6, fontSize: "0.8rem", color: "#b91c1c" }}>{expiryError}</p>
                )}
              </div>
              <div>
                <label className="checkout-label">Cód. de segurança</label>
                <input
                  type="text"
                  inputMode="numeric"
                  className="checkout-input"
                  placeholder={cvvMaxLength === 4 ? "0000" : "000"}
                  value={card.cvv}
                  onChange={(e) =>
                    setCard((prev) => ({ ...prev, cvv: maskCvv(e.target.value, cvvMaxLength) }))
                  }
                  style={{ borderColor: cvvError ? "#b91c1c" : undefined }}
                />
                {cvvError && (
                  <p style={{ marginTop: 6, fontSize: "0.8rem", color: "#b91c1c" }}>{cvvError}</p>
                )}
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
                {installmentOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {sdkError && (
              <div style={{ padding: "8px 12px", fontSize: "0.82rem", color: "#b91c1c", background: "rgba(185,28,28,0.08)", borderRadius: 6 }}>
                {sdkError}
              </div>
            )}
            {!sdkReady && !sdkError && (
              <div style={{ padding: "8px 12px", fontSize: "0.82rem", color: "var(--text-secondary)", background: "var(--card-bg)", borderRadius: 6 }}>
                Carregando módulo seguro de cartão…
              </div>
            )}

            {renderBumps("credit_card")}
            {renderFinalizeButton("credit_card")}
          </div>
        )}

        {/* PIX Option */}
        {enabledMethods.pix && (
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
        )}

        {paymentMethod === "pix" && enabledMethods.pix && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "4px 0 8px 0" }}>
            {!pixQrCode && (
              <div style={{ fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                <p>O código Pix expira em 30 minutos após finalizar a compra.</p>
                <p style={{ marginTop: 8 }}>
                  Valor no Pix: <strong>{formatCurrency(discountedTotal)}</strong>
                </p>
              </div>
            )}

            {pixQrCode && (
              <div style={{ background: "var(--checkout-bg)", borderRadius: 8, padding: 16 }}>
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

            {renderBumps("pix")}
            {!pixQrCode && renderFinalizeButton("pix")}
          </div>
        )}

        {/* Boleto Option */}
        {enabledMethods.boleto && (
          <div
            className={`payment-method-card ${paymentMethod === "boleto" ? "selected" : ""}`}
            onClick={() => setPaymentMethod("boleto")}
          >
            {boletoDiscount > 0 && (
              <span className="payment-method-badge">{boletoDiscount}% DE DESCONTO</span>
            )}
            <input
              type="radio"
              className="radio-custom"
              checked={paymentMethod === "boleto"}
              onChange={() => setPaymentMethod("boleto")}
            />
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--text-secondary)" }}>
              <path d="M4 4h16v16H4z" />
              <path d="M8 8v8" />
              <path d="M12 8v8" />
              <path d="M16 8v8" />
            </svg>
            <span style={{ fontSize: "0.95rem", fontWeight: 500 }}>Boleto bancário</span>
          </div>
        )}

        {paymentMethod === "boleto" && enabledMethods.boleto && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "4px 0 8px 0" }}>
            <div style={{ fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
              <p>O boleto vence em 3 dias e pode levar até 2 dias úteis para compensar.</p>
              <p style={{ marginTop: 8 }}>
                Valor no Boleto: <strong>{formatCurrency(discountedTotal)}</strong>
              </p>
            </div>

            {renderBumps("boleto")}
            {renderFinalizeButton("boleto")}
          </div>
        )}
      </div>
    </div>
  );
}