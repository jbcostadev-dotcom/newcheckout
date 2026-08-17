"use client";

import React from "react";
import {
  cnpjIsValid,
  cpfIsValid,
  maskCelular,
  maskCnpj,
  maskCpf,
  onlyDigits,
} from "@/lib/masks";

export type CustomerType = "individual" | "company";

interface StepDadosProps {
  name: string;
  email: string;
  phone: string;
  document: string;
  customerType: CustomerType;
  acceptCpf: boolean;
  acceptCnpj: boolean;
  stateRegistration: string;
  stateRegistrationExempt: boolean;
  setName: (v: string) => void;
  setEmail: (v: string) => void;
  setPhone: (v: string) => void;
  setDocument: (v: string) => void;
  setCustomerType: (v: CustomerType) => void;
  setStateRegistration: (v: string) => void;
  setStateRegistrationExempt: (v: boolean) => void;
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
  customerType,
  acceptCpf,
  acceptCnpj,
  stateRegistration,
  stateRegistrationExempt,
  setName,
  setEmail,
  setPhone,
  setDocument,
  setCustomerType,
  setStateRegistration,
  setStateRegistrationExempt,
  onContinue,
  onEdit,
  isActive,
  isCompleted,
  titleFontSize = "1.25rem",
}: StepDadosProps) {
  const isCompany = customerType === "company";
  const docDigits = onlyDigits(document);
  const phoneDigits = onlyDigits(phone);
  const documentIsValid = isCompany ? cnpjIsValid(docDigits) : cpfIsValid(docDigits);
  const expectedDocumentLength = isCompany ? 14 : 11;
  const documentTypeIsAccepted = isCompany ? acceptCnpj : acceptCpf;
  const hasInvalidDocument = docDigits.length === expectedDocumentLength && !documentIsValid;

  const canContinue =
    documentTypeIsAccepted &&
    name.trim().length >= 3 &&
    /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()) &&
    documentIsValid &&
    phoneDigits.length >= 10;

  const handleTypeChange = (nextType: CustomerType) => {
    if (nextType === customerType) return;
    if (nextType === "individual" && !acceptCpf) return;
    if (nextType === "company" && !acceptCnpj) return;

    setCustomerType(nextType);
    setName("");
    setDocument("");
    setStateRegistration("");
    setStateRegistrationExempt(false);
  };

  const handleContinue = () => {
    if (!canContinue) {
      if (!documentTypeIsAccepted) {
        alert("Este tipo de documento não está habilitado para pagamentos.");
      } else if (name.trim().length < 3) {
        alert(isCompany ? "Preencha a razão social." : "Preencha o nome completo.");
      } else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
        alert("Preencha um e-mail válido.");
      } else if (!documentIsValid) {
        alert(`Preencha um ${isCompany ? "CNPJ" : "CPF"} válido.`);
      } else if (phoneDigits.length < 10) {
        alert("Preencha o celular com DDD.");
      }
      return;
    }
    onContinue();
  };

  if (isCompleted && !isActive) {
    return (
      <div className="step-card inactive">
        <div className="step-card-header">
          <h2 className="step-card-title" style={{ fontSize: titleFontSize }}>
            <span className="step-number">1</span> Identificação
          </h2>
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
          <div style={{ color: "var(--text-secondary)" }}>
            {isCompany ? "Pessoa jurídica" : "Pessoa física"} · {document}
          </div>
          <div style={{ color: "var(--text-secondary)" }}>{email}</div>
          {phone && <div style={{ color: "var(--text-secondary)" }}>{phone}</div>}
        </div>
      </div>
    );
  }

  if (!isActive) {
    return (
      <div className="step-card inactive" style={{ opacity: 0.6 }}>
        <div className="step-card-header">
          <h2 className="step-card-title" style={{ fontSize: titleFontSize }}>
            <span className="step-number">1</span> Identificação
          </h2>
          <span className="step-card-counter">1 de 3</span>
        </div>
        <p className="step-card-subtitle">Preencha seus dados para envio do pedido.</p>
      </div>
    );
  }

  return (
    <div className="step-card active">
      <div className="step-card-header">
        <h2 className="step-card-title" style={{ fontSize: titleFontSize }}>
          <span className="step-number">1</span> Identificação
        </h2>
        <span className="step-card-counter">1 de 3</span>
      </div>
      <p className="step-card-subtitle">Preencha seus dados para envio do pedido.</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {acceptCnpj && (
          <div className="customer-type-selector" role="group" aria-label="Tipo de pessoa">
            <button
              type="button"
              className={`customer-type-option ${!isCompany ? "active" : ""}`}
              onClick={() => handleTypeChange("individual")}
              disabled={!acceptCpf}
              aria-pressed={!isCompany}
            >
              <span className="customer-type-abbreviation" aria-hidden="true">PF</span>
              Pessoa física
            </button>
            <button
              type="button"
              className={`customer-type-option ${isCompany ? "active" : ""}`}
              onClick={() => handleTypeChange("company")}
              disabled={!acceptCnpj}
              aria-pressed={isCompany}
            >
              <span className="customer-type-abbreviation" aria-hidden="true">PJ</span>
              Pessoa jurídica
            </button>
          </div>
        )}

        <div>
          <label className="checkout-label">{isCompany ? "Razão social" : "Nome completo"}</label>
          <input
            type="text"
            className="checkout-input"
            placeholder={isCompany ? "Digite a razão social completa" : "Digite seu nome completo"}
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete={isCompany ? "organization" : "name"}
          />
        </div>

        <div>
          <label className="checkout-label">E-mail</label>
          <input
            type="email"
            className="checkout-input"
            placeholder="Digite seu e-mail"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
          />
        </div>

        <div>
          <label className="checkout-label">
            {isCompany ? "CNPJ" : "CPF"}{" "}
            <span title="Documento necessário para processar o pagamento" style={{ cursor: "help", color: "var(--text-muted)" }}>
              &#9432;
            </span>
          </label>
          <input
            type="text"
            inputMode="numeric"
            className={`checkout-input ${hasInvalidDocument ? "checkout-input-error" : ""}`}
            placeholder={isCompany ? "00.000.000/0000-00" : "000.000.000-00"}
            value={document}
            onChange={(event) => setDocument(isCompany ? maskCnpj(event.target.value) : maskCpf(event.target.value))}
          />
          {hasInvalidDocument && (
            <p className="checkout-field-error">Digite um {isCompany ? "CNPJ" : "CPF"} válido</p>
          )}
        </div>

        {isCompany && (
          <div>
            <label className="checkout-label">Inscrição Estadual</label>
            <div className="state-registration-row">
              <input
                type="text"
                className="checkout-input"
                placeholder="000.000.000.000"
                value={stateRegistration}
                onChange={(event) => setStateRegistration(event.target.value.slice(0, 30))}
                disabled={stateRegistrationExempt}
              />
              <label className="state-registration-exempt">
                <input
                  type="checkbox"
                  checked={stateRegistrationExempt}
                  onChange={(event) => {
                    setStateRegistrationExempt(event.target.checked);
                    if (event.target.checked) setStateRegistration("");
                  }}
                />
                Isento
              </label>
            </div>
          </div>
        )}

        <div>
          <label className="checkout-label">Celular/Whatsapp</label>
          <div className="checkout-phone-field">
            <span className="checkout-phone-prefix" aria-hidden="true">+55</span>
            <input
              type="tel"
              className="checkout-input checkout-phone-input"
              placeholder="(00) 00000-0000"
              value={phone}
              onChange={(event) => setPhone(maskCelular(event.target.value))}
              autoComplete="tel"
            />
          </div>
        </div>
      </div>

      <button
        type="button"
        className="btn-primary"
        onClick={handleContinue}
        disabled={!canContinue}
      >
        Ir Para Entrega
      </button>
    </div>
  );
}
