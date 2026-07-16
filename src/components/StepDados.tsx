"use client";

import React from "react";

interface StepDadosProps {
  name: string;
  email: string;
  phone: string;
  document: string;
  setName: (v: string) => void;
  setEmail: (v: string) => void;
  setPhone: (v: string) => void;
  setDocument: (v: string) => void;
  onContinue: () => void;
  primary: string;
  textColor: string;
  mutedText: string;
  inputStyle: React.CSSProperties;
  borderColor: string;
}

import { maskCpf, maskCelular } from "@/lib/masks";

export default function StepDados({
  name,
  email,
  phone,
  document,
  setName,
  setEmail,
  setPhone,
  setDocument,
  onContinue,
  primary,
  textColor,
  mutedText,
  inputStyle,
  borderColor,
}: StepDadosProps) {
  const canContinue =
    name.trim().length >= 3 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());

  return (
    <div>
      <h2 className="mb-6 text-lg font-bold">Dados de Contato</h2>
      <div className="space-y-3">
        <input
          type="text"
          placeholder="Nome Completo *"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={inputStyle}
        />
        <input
          type="email"
          placeholder="E-mail *"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />
        <input
          type="tel"
          placeholder="Celular"
          value={phone}
          onChange={(e) => setPhone(maskCelular(e.target.value))}
          style={inputStyle}
        />
        <input
          type="text"
          placeholder="CPF (opcional)"
          value={document}
          onChange={(e) => setDocument(maskCpf(e.target.value))}
          style={inputStyle}
        />
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
        * Campos obrigatórios
      </p>
    </div>
  );
}