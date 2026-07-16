"use client";

import React from "react";
import { maskCpf, maskCelular } from "@/lib/masks";

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
  onEdit?: () => void;
  isActive: boolean;
  isCompleted: boolean;
  titleFontSize?: string;
}

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
  onEdit,
  isActive,
  isCompleted,
  titleFontSize = "1.25rem",
}: StepDadosProps) {
  const canContinue =
    name.trim().length >= 3 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());

  // Completed summary view
  if (isCompleted && !isActive) {
    return (
      <div className="step-card inactive">
        <div className="step-card-header">
          <h2 className="step-card-title" style={{ fontSize: titleFontSize }}>Identificação</h2>
          <button type="button" className="step-edit-btn" onClick={onEdit}>
            Editar{" "}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        </div>
        <div style={{ marginTop: 8, fontSize: "0.9rem", lineHeight: 1.7 }}>
          <div style={{ fontWeight: 600 }}>{name}</div>
          <div style={{ color: "var(--text-secondary)" }}>{email}</div>
          {phone && <div style={{ color: "var(--text-secondary)" }}>{phone}</div>}
        </div>
      </div>
    );
  }

  // Inactive (not yet reached)
  if (!isActive) {
    return (
      <div className="step-card inactive" style={{ opacity: 0.6 }}>
        <div className="step-card-header">
          <h2 className="step-card-title" style={{ fontSize: titleFontSize }}>Identificação</h2>
          <span className="step-card-counter">1 de 3</span>
        </div>
        <p className="step-card-subtitle">Preencha seus dados para envio do pedido.</p>
      </div>
    );
  }

  // Active form view
  return (
    <div className="step-card active">
      <div className="step-card-header">
        <h2 className="step-card-title" style={{ fontSize: titleFontSize }}>Identificação</h2>
        <span className="step-card-counter">1 de 3</span>
      </div>
      <p className="step-card-subtitle">Preencha seus dados para envio do pedido.</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label className="checkout-label">Nome completo</label>
          <input
            type="text"
            className="checkout-input"
            placeholder="Digite seu nome completo"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div>
          <label className="checkout-label">E-mail</label>
          <input
            type="email"
            className="checkout-input"
            placeholder="Digite seu e-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div>
          <label className="checkout-label">
            CPF{" "}
            <span title="Documento necessário para emissão da nota fiscal" style={{ cursor: "help", color: "var(--text-muted)" }}>
              &#9432;
            </span>
          </label>
          <input
            type="text"
            className="checkout-input"
            placeholder="000.000.000-00"
            value={document}
            onChange={(e) => setDocument(maskCpf(e.target.value))}
          />
        </div>

        <div>
          <label className="checkout-label">Celular/Whatsapp</label>
          <input
            type="tel"
            className="checkout-input"
            placeholder="+55  (00) 00000-0000"
            value={phone}
            onChange={(e) => setPhone(maskCelular(e.target.value))}
          />
        </div>
      </div>

      <button
        type="button"
        className="btn-primary"
        onClick={onContinue}
        disabled={!canContinue}
      >
        Ir Para Entrega
      </button>
    </div>
  );
}