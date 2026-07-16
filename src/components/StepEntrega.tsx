"use client";

import React, { useState } from "react";
import { maskCep } from "@/lib/masks";
import { lookupCep } from "@/lib/viacep";
import type { ShippingAddress } from "@/types";

interface StepEntregaProps {
  address: ShippingAddress;
  setAddress: React.Dispatch<React.SetStateAction<ShippingAddress>>;
  onContinue: () => void;
  primary: string;
  textColor: string;
  mutedText: string;
  inputStyle: React.CSSProperties;
  borderColor: string;
}

export default function StepEntrega({
  address,
  setAddress,
  onContinue,
  primary,
  textColor,
  mutedText,
  inputStyle,
  borderColor,
}: StepEntregaProps) {
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);
  const [showFields, setShowFields] = useState(
    Boolean(address.cep && address.logradouro)
  );

  const cepDigits = address.cep.replace(/\D+/g, "");
  const cepValid = cepDigits.length === 8;
  const canContinue = cepValid && address.numero.trim().length > 0;

  const handleCepBlur = async () => {
    if (!cepValid) return;
    setCepLoading(true);
    setCepError(null);
    const res = await lookupCep(address.cep);
    setCepLoading(false);
    if (!res) {
      setCepError("CEP não encontrado. Confira o número e tente novamente.");
      setShowFields(false);
      return;
    }
    setAddress((prev) => ({
      ...prev,
      ...res,
      cep: address.cep,
    }));
    setShowFields(true);
  };

  const update = (patch: Partial<ShippingAddress>) =>
    setAddress((prev) => ({ ...prev, ...patch }));

  return (
    <div>
      <h2 className="mb-6 text-lg font-bold">Endereço de Entrega</h2>
      <div className="space-y-3">
        <input
          type="text"
          inputMode="numeric"
          placeholder="CEP *"
          value={address.cep}
          onChange={(e) => {
            const v = maskCep(e.target.value);
            setAddress((prev) => ({ ...prev, cep: v }));
            const d = v.replace(/\D+/g, "");
            if (d.length !== 8) setShowFields(false);
          }}
          onBlur={handleCepBlur}
          style={inputStyle}
        />
        {cepError && (
          <p className="text-xs" style={{ color: "#ef4444" }}>
            {cepError}
          </p>
        )}
        {cepLoading && (
          <p className="text-xs" style={{ color: mutedText }}>
            Buscando CEP...
          </p>
        )}
        {showFields && (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px]">
              <input
                type="text"
                placeholder="Logradouro"
                value={address.logradouro}
                onChange={(e) => update({ logradouro: e.target.value })}
                style={inputStyle}
              />
              <input
                type="text"
                inputMode="numeric"
                placeholder="Número *"
                value={address.numero}
                onChange={(e) => update({ numero: e.target.value })}
                style={inputStyle}
              />
            </div>
            <input
              type="text"
              placeholder="Complemento"
              value={address.complemento ?? ""}
              onChange={(e) => update({ complemento: e.target.value })}
              style={inputStyle}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                type="text"
                placeholder="Bairro"
                value={address.bairro}
                onChange={(e) => update({ bairro: e.target.value })}
                style={inputStyle}
              />
              <input
                type="text"
                placeholder="Cidade"
                value={address.cidade}
                onChange={(e) => update({ cidade: e.target.value })}
                style={inputStyle}
              />
            </div>
            <input
              type="text"
              placeholder="UF"
              maxLength={2}
              value={address.uf}
              onChange={(e) => update({ uf: e.target.value.toUpperCase().slice(0, 2) })}
              style={inputStyle}
            />
          </>
        )}
      </div>

      <button
        type="button"
        onClick={onContinue}
        disabled={!canContinue}
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
          cursor: canContinue ? "pointer" : "not-allowed",
          opacity: canContinue ? 1 : 0.6,
        }}
      >
        Continuar
      </button>
      <p className="mt-3 text-xs" style={{ color: mutedText }}>
        Frete: Grátis · Digite o CEP para liberar o endereço.
      </p>
    </div>
  );
}