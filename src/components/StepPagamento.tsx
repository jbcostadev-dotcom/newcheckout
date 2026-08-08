"use client";

import React, { useEffect, useMemo, useState } from "react";
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

const carouselArrowStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: "50%",
  border: "1px solid var(--input-border, #d1d5db)",
  background: "var(--card-bg, #ffffff)",
  color: "var(--text-primary)",
  cursor: "pointer",
  fontSize: "1.35rem",
  lineHeight: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

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
  orderBumpDisplayMode?: "stacked" | "carousel";
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
  orderBumpDisplayMode = "stacked",
  selectedOrderBumpId,
  onToggleOrderBump,
}: StepPagamentoProps) {
  const [cardNumberBlurred, setCardNumberBlurred] = useState(false);
  const [carouselIndexByMethod, setCarouselIndexByMethod] = useState<
    Record<"pix" | "credit_card" | "boleto", number>
  >({ pix: 0, credit_card: 0, boleto: 0 });
  const [bumpExpiryById, setBumpExpiryById] = useState<Record<number, number>>({});
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  useEffect(() => {
    if (!isActive) return;

    setBumpExpiryById((previous) => {
      let changed = false;
      const next = { ...previous };

      orderBumps.forEach((bump) => {
        if (!bump.scarcity_timer_enabled || next[bump.id]) return;
        const minutes = Math.max(1, Number(bump.scarcity_timer_minutes) || 10);
        next[bump.id] = Date.now() + minutes * 60 * 1000;
        changed = true;
      });

      return changed ? next : previous;
    });
  }, [isActive, orderBumps]);

  const hasScarcityTimer = orderBumps.some((bump) => bump.scarcity_timer_enabled);

  useEffect(() => {
    if (!hasScarcityTimer || Object.keys(bumpExpiryById).length === 0) return;
    const intervalId = window.setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, [bumpExpiryById, hasScarcityTimer]);

  const getBumpTimer = (bump: OrderBumpOffer) => {
    if (!bump.scarcity_timer_enabled) return undefined;
    const durationMs = Math.max(1, Number(bump.scarcity_timer_minutes) || 10) * 60 * 1000;
    const expiryAt = bumpExpiryById[bump.id] ?? currentTime + durationMs;
    const secondsLeft = Math.max(0, Math.ceil((expiryAt - currentTime) / 1000));
    return { secondsLeft, expired: secondsLeft === 0 };
  };

  useEffect(() => {
    if (selectedOrderBumpId === undefined || selectedOrderBumpId === null) return;
    const selectedBump = orderBumps.find((bump) => bump.id === selectedOrderBumpId);
    if (selectedBump && getBumpTimer(selectedBump)?.expired) {
      onToggleOrderBump?.(selectedOrderBumpId, false);
    }
  }, [currentTime, bumpExpiryById, orderBumps, selectedOrderBumpId, onToggleOrderBump]);

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

    if (orderBumpDisplayMode !== "carousel" || visible.length === 1) {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, margin: "16px 0" }}>
          {visible.map((bump) => (
            <OrderBumpCard
              key={bump.id}
              bump={bump}
              selected={selectedOrderBumpId === bump.id}
              timer={getBumpTimer(bump)}
              onToggle={(sel) => onToggleOrderBump?.(bump.id, sel)}
            />
          ))}
        </div>
      );
    }

    const currentIndex = (carouselIndexByMethod[method] ?? 0) % visible.length;
    const currentBump = visible[currentIndex];
    const goTo = (direction: -1 | 1) => {
      setCarouselIndexByMethod((previous) => ({
        ...previous,
        [method]: (currentIndex + direction + visible.length) % visible.length,
      }));
    };

    return (
      <div style={{ margin: "16px 0" }}>
        <OrderBumpCard
          key={currentBump.id}
          bump={currentBump}
          selected={selectedOrderBumpId === currentBump.id}
          timer={getBumpTimer(currentBump)}
          onToggle={(selected) => {
            onToggleOrderBump?.(currentBump.id, selected);
            if (selected) goTo(1);
          }}
        />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 8 }}>
          <button
            type="button"
            aria-label="Oferta anterior"
            onClick={() => goTo(-1)}
            style={carouselArrowStyle}
          >
            &#8249;
          </button>
          <span style={{ color: "var(--text-secondary)", fontSize: "0.72rem", minWidth: 72, textAlign: "center" }}>
            Oferta {currentIndex + 1} de {visible.length}
          </span>
          <button
            type="button"
            aria-label="Próxima oferta"
            onClick={() => goTo(1)}
            style={carouselArrowStyle}
          >
            &#8250;
          </button>
        </div>
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
            <span
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "#f1f5f9",
                flexShrink: 0,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
                <g fill="#4BB8A9" fillRule="evenodd">
                  <path d="M112.57 391.19c20.056 0 38.928-7.808 53.12-22l76.693-76.692c5.385-5.404 14.765-5.384 20.15 0l76.989 76.989c14.191 14.172 33.045 21.98 53.12 21.98h15.098l-97.138 97.139c-30.326 30.344-79.505 30.344-109.85 0l-97.415-97.416h9.232zm280.068-271.294c-20.056 0-38.929 7.809-53.12 22l-76.97 76.99c-5.551 5.53-14.6 5.568-20.15-.02l-76.711-76.693c-14.192-14.191-33.046-21.999-53.12-21.999h-9.234l97.416-97.416c30.344-30.344 79.523-30.344 109.867 0l97.138 97.138h-15.116z"></path>
                  <path d="M22.758 200.753l58.024-58.024h31.787c13.84 0 27.384 5.605 37.172 15.394l76.694 76.693c7.178 7.179 16.596 10.768 26.033 10.768 9.417 0 18.854-3.59 26.014-10.75l76.989-76.99c9.787-9.787 23.331-15.393 37.171-15.393h37.654l58.3 58.302c30.343 30.344 30.343 79.523 0 109.867l-58.3 58.303H392.64c-13.84 0-27.384-5.605-37.171-15.394l-76.97-76.99c-13.914-13.894-38.172-13.894-52.066.02l-76.694 76.674c-9.788 9.788-23.332 15.413-37.172 15.413H80.782L22.758 310.62c-30.344-30.345-30.344-79.524 0-109.868"></path>
                </g>
              </svg>
            </span>
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
