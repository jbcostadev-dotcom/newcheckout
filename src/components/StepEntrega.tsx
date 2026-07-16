"use client";

import React, { useState } from "react";
import { maskCep } from "@/lib/masks";
import { lookupCep } from "@/lib/viacep";
import type { ShippingAddress } from "@/types";

interface StepEntregaProps {
  address: ShippingAddress;
  setAddress: React.Dispatch<React.SetStateAction<ShippingAddress>>;
  onContinue: () => void;
  onEdit?: () => void;
  isActive: boolean;
  isCompleted: boolean;
  titleFontSize?: string;
}

export default function StepEntrega({
  address,
  setAddress,
  onContinue,
  onEdit,
  isActive,
  isCompleted,
  titleFontSize = "1.25rem",
}: StepEntregaProps) {
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);
  const [cepValidated, setCepValidated] = useState(
    Boolean(address.cep && address.logradouro)
  );
  const [showFields, setShowFields] = useState(
    Boolean(address.cep && address.logradouro)
  );

  const cepDigits = address.cep.replace(/\D+/g, "");
  const cepValid = cepDigits.length === 8;
  const canContinue = cepValid && address.numero.trim().length > 0;

  const handleCepChange = (value: string) => {
    const v = maskCep(value);
    setAddress((prev) => ({ ...prev, cep: v }));
    const d = v.replace(/\D+/g, "");
    if (d.length !== 8) {
      setShowFields(false);
      setCepValidated(false);
    }
  };

  const handleCepBlur = async () => {
    if (!cepValid) return;
    setCepLoading(true);
    setCepError(null);
    const res = await lookupCep(address.cep);
    setCepLoading(false);
    if (!res) {
      setCepError("CEP não encontrado. Confira o número e tente novamente.");
      setShowFields(false);
      setCepValidated(false);
      return;
    }
    setAddress((prev) => ({
      ...prev,
      ...res,
      cep: address.cep,
    }));
    setShowFields(true);
    setCepValidated(true);
  };

  const update = (patch: Partial<ShippingAddress>) =>
    setAddress((prev) => ({ ...prev, ...patch }));

  // Completed summary view
  if (isCompleted && !isActive) {
    const fullAddr = [
      address.logradouro,
      address.numero ? `${address.numero}` : "",
      address.complemento ? `- ${address.complemento}` : "",
    ]
      .filter(Boolean)
      .join(", ");
    const cityLine = [address.bairro, `${address.cidade}/${address.uf}`, address.cep.replace(/\D+/g, "")]
      .filter(Boolean)
      .join(", ");

    return (
      <div className="step-card inactive">
        <div className="step-card-header">
          <h2 className="step-card-title" style={{ fontSize: titleFontSize }}>Enviar para</h2>
          <button type="button" className="step-edit-btn" onClick={onEdit}>
            Editar{" "}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        </div>
        <div style={{ marginTop: 8, fontSize: "0.9rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
          <div>{fullAddr}</div>
          <div>{cityLine}</div>
        </div>
      </div>
    );
  }

  // Inactive (not yet reached)
  if (!isActive) {
    return (
      <div className="step-card inactive" style={{ opacity: 0.6 }}>
        <div className="step-card-header">
          <h2 className="step-card-title" style={{ fontSize: titleFontSize }}>Entrega</h2>
          <span className="step-card-counter">2 de 3</span>
        </div>
        <p className="step-card-subtitle">Informe o endereço de entrega</p>
      </div>
    );
  }

  // Active form view
  return (
    <div className="step-card active">
      <div className="step-card-header">
        <h2 className="step-card-title" style={{ fontSize: titleFontSize }}>Entrega</h2>
        <span className="step-card-counter">2 de 3</span>
      </div>
      <p className="step-card-subtitle">Informe o endereço de entrega</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* CEP */}
        <div>
          <label className="checkout-label">CEP</label>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ position: "relative", flex: cepValidated ? "0 0 200px" : "1" }}>
              <input
                type="text"
                inputMode="numeric"
                className={`checkout-input ${cepValidated ? "has-check" : ""}`}
                placeholder="00000-000"
                value={address.cep}
                onChange={(e) => handleCepChange(e.target.value)}
                onBlur={handleCepBlur}
              />
              {cepValidated && (
                <span className="input-check">✓</span>
              )}
            </div>
            {cepValidated && address.uf && (
              <span style={{ fontSize: "0.9rem", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                {address.uf}/{address.cidade}
              </span>
            )}
          </div>
          {cepError && (
            <p style={{ color: "#ef4444", fontSize: "0.75rem", marginTop: 4 }}>{cepError}</p>
          )}
          {cepLoading && (
            <p style={{ color: "var(--text-muted)", fontSize: "0.75rem", marginTop: 4 }}>Buscando CEP...</p>
          )}
        </div>

        {showFields && (
          <>
            {/* Endereço */}
            <div>
              <label className="checkout-label">Endereço</label>
              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  className="checkout-input has-check"
                  value={address.logradouro}
                  onChange={(e) => update({ logradouro: e.target.value })}
                />
                {address.logradouro && (
                  <span className="input-check">✓</span>
                )}
              </div>
            </div>

            {/* Nº + Bairro */}
            <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: 12 }}>
              <div>
                <label className="checkout-label">Nº</label>
                <input
                  type="text"
                  inputMode="numeric"
                  className="checkout-input"
                  placeholder="Número"
                  value={address.numero}
                  onChange={(e) => update({ numero: e.target.value })}
                />
              </div>
              <div>
                <label className="checkout-label">Bairro</label>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    className="checkout-input has-check"
                    value={address.bairro}
                    onChange={(e) => update({ bairro: e.target.value })}
                  />
                  {address.bairro && (
                    <span className="input-check">✓</span>
                  )}
                </div>
              </div>
            </div>

            {/* Complemento */}
            <div>
              <label className="checkout-label">
                Complemento <span className="optional">(Opcional)</span>
              </label>
              <input
                type="text"
                className="checkout-input"
                value={address.complemento ?? ""}
                onChange={(e) => update({ complemento: e.target.value })}
              />
            </div>
          </>
        )}

        {/* Escolha o frete */}
        <div>
          <h3 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: 10 }}>Escolha o frete:</h3>
          <div
            style={{
              background: "var(--checkout-bg)",
              borderRadius: 8,
              padding: "20px 16px",
              textAlign: "center",
              color: "var(--text-muted)",
              fontSize: "0.85rem",
              lineHeight: 1.5,
            }}
          >
            {canContinue
              ? "Frete Grátis"
              : "Insira o endereço de entrega para ver as formas de frete disponíveis."}
          </div>
        </div>
      </div>

      <button
        type="button"
        className="btn-primary"
        onClick={onContinue}
        disabled={!canContinue}
      >
        Ir para pagamento
      </button>
    </div>
  );
}