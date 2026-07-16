"use client";

import React from "react";
import { maskCardExpiry, maskCardNumber, maskCvv } from "@/lib/masks";
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
  primary: string;
  textColor: string;
  inputStyle: React.CSSProperties;
  borderColor: string;
  inputBg: string;
  buttonText: string;
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
  primary,
  textColor,
  inputStyle,
  borderColor,
  inputBg,
  buttonText,
}: StepPagamentoProps) {
  const cardValid =
    card.number.replace(/\D+/g, "").length >= 13 &&
    /^\d{2}\/\d{2}$/.test(card.expiry) &&
    card.cvv.length >= 3 &&
    card.holder.trim().length >= 3;

  const canFinalize =
    !processing && !awaitingPix && (paymentMethod === "pix" || cardValid);

  const methodBtn = (id: "pix" | "credit_card", label: string) => {
    const active = paymentMethod === id;
    return (
      <button
        key={id}
        type="button"
        onClick={() => {
          setPaymentMethod(id);
          if (id === "pix") {
            /* mantém estado do cartão */
          }
        }}
        style={{
          flex: 1,
          padding: 14,
          borderRadius: 8,
          border: `2px solid ${active ? primary : borderColor}`,
          background: active ? primary : "transparent",
          color: active ? "#fff" : textColor,
          fontWeight: 600,
          cursor: "pointer",
          fontSize: "0.95rem",
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <div>
      <h2 className="mb-6 text-lg font-bold">Pagamento</h2>
      <div className="flex gap-3">
        {methodBtn("pix", "📱 PIX")}
        {methodBtn("credit_card", "💳 Cartão")}
      </div>

      {paymentMethod === "credit_card" && (
        <div className="mt-6 space-y-3">
          <input
            type="text"
            inputMode="numeric"
            placeholder="Número do cartão *"
            value={card.number}
            onChange={(e) =>
              setCard((prev) => ({ ...prev, number: maskCardNumber(e.target.value) }))
            }
            style={inputStyle}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              type="text"
              inputMode="numeric"
              placeholder="Validade (MM/AA) *"
              value={card.expiry}
              onChange={(e) =>
                setCard((prev) => ({
                  ...prev,
                  expiry: maskCardExpiry(e.target.value),
                }))
              }
              style={inputStyle}
            />
            <input
              type="text"
              inputMode="numeric"
              placeholder="CVV *"
              value={card.cvv}
              onChange={(e) =>
                setCard((prev) => ({ ...prev, cvv: maskCvv(e.target.value) }))
              }
              style={inputStyle}
            />
          </div>
          <input
            type="text"
            placeholder="Nome impresso no cartão *"
            value={card.holder}
            onChange={(e) =>
              setCard((prev) => ({ ...prev, holder: e.target.value.toUpperCase() }))
            }
            style={inputStyle}
          />
        </div>
      )}

      {pixQrCode && paymentMethod === "pix" && (
        <div className="mt-6 rounded-lg p-4" style={{ background: inputBg }}>
          <p className="mb-3 text-sm font-medium">QR Code PIX</p>
          <img
            src={pixQrCode}
            alt="QR Code PIX"
            className="mx-auto mb-3 h-48 w-48 rounded-lg"
          />
          {pixCopiaCola && (
            <div className="rounded bg-black/10 p-2 text-xs font-mono break-all">
              {pixCopiaCola}
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={onFinalize}
        disabled={!canFinalize}
        style={{
          width: "100%",
          marginTop: 24,
          padding: 16,
          borderRadius: 8,
          border: "none",
          background: primary,
          color: "#fff",
          fontWeight: 700,
          fontSize: "1.05rem",
          cursor: canFinalize ? "pointer" : "not-allowed",
          opacity: canFinalize ? 1 : 0.6,
        }}
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