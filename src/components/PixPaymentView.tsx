"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import QRCode from "qrcode";
import { formatCurrency } from "@/lib/utils";

const PIX_EXPIRATION_MINUTES = 30;

export interface PixPaymentSettings {
  logo_url?: string | null;
  header_store_name_visible?: boolean;
  header_secure_badge?: boolean;
  header_logo_alignment?: string;
  header_bg_color?: string;
  header_icon_color?: string;
  primary_color?: string | null;
  dark_mode?: boolean;
  font_family?: string | null;
  font_size_base?: string | null;
}

interface PixPaymentViewProps {
  storeName: string;
  total: number;
  copiaECola: string;
  createdAt?: string | Date | null;
  expiresAt?: string | Date | null;
  isPreview?: boolean;
  initialSettings?: PixPaymentSettings;
  onBackToCheckout?: () => void;
}

export default function PixPaymentView({
  storeName,
  total,
  copiaECola,
  createdAt,
  expiresAt,
  isPreview = false,
  initialSettings = {},
  onBackToCheckout,
}: PixPaymentViewProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [timerReady, setTimerReady] = useState(false);
  const [settings, setSettings] = useState<PixPaymentSettings>(initialSettings);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const applySettings = useCallback((pageSettings: PixPaymentSettings) => {
    const root = document.documentElement;
    const s = pageSettings;

    if (s.primary_color) {
      root.style.setProperty("--green-primary", s.primary_color);
      root.style.setProperty("--green-check", s.primary_color);
      root.style.setProperty("--border-active", s.primary_color);
      root.style.setProperty("--input-border-focus", s.primary_color);
      root.style.setProperty("--badge-green-text", s.primary_color);
    }

    if (s.dark_mode) {
      root.style.setProperty("--checkout-bg", "#0a0a1a");
      root.style.setProperty("--card-bg", "rgba(255,255,255,0.05)");
      root.style.setProperty("--border-color", "rgba(255,255,255,0.1)");
      root.style.setProperty("--text-primary", "#ffffff");
      root.style.setProperty("--text-secondary", "rgba(255,255,255,0.7)");
      root.style.setProperty("--text-muted", "rgba(255,255,255,0.5)");
      root.style.setProperty("--input-bg", "rgba(255,255,255,0.05)");
      root.style.setProperty("--header-banner-bg", "rgba(255,255,255,0.08)");
    } else {
      root.style.setProperty("--checkout-bg", "#f5f5f5");
      root.style.setProperty("--card-bg", "#ffffff");
      root.style.setProperty("--border-color", "#e0e0e0");
      root.style.setProperty("--text-primary", "#1a1a1a");
      root.style.setProperty("--text-secondary", "#666666");
      root.style.setProperty("--text-muted", "#999999");
      root.style.setProperty("--input-bg", "#ffffff");
      root.style.setProperty("--header-banner-bg", "#333333");
    }
  }, []);

  useEffect(() => {
    applySettings(initialSettings);
  }, [applySettings, initialSettings]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== "object") return;
      if (event.data.type !== "checkout:settings") return;
      const newSettings = event.data.settings as PixPaymentSettings;
      setSettings((prev) => ({ ...prev, ...newSettings }));
      applySettings(newSettings);
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [applySettings]);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(copiaECola, {
      width: 240,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    })
      .then((url) => {
        if (!cancelled) setQrCodeUrl(url);
      })
      .catch((err) => {
        console.error("Erro ao gerar QR Code:", err);
        if (!cancelled) setQrCodeUrl(null);
      });

    return () => {
      cancelled = true;
    };
  }, [copiaECola]);

  useEffect(() => {
    if (!createdAt) return;

    // Prioriza a expiração retornada pela gateway (Unipay/FastSoft); senão usa o padrão.
    const expiresAtMs = expiresAt
      ? new Date(expiresAt).getTime()
      : new Date(createdAt).getTime() + PIX_EXPIRATION_MINUTES * 60 * 1000;

    const updateTimer = () => {
      const now = Date.now();
      const diff = Math.max(0, expiresAtMs - now);
      setTimeLeft(diff);
      setTimerReady(true);

      if (diff === 0 && timerRef.current) {
        clearInterval(timerRef.current);
      }
    };

    updateTimer();
    timerRef.current = setInterval(updateTimer, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [createdAt, expiresAt]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  const handleCopy = useCallback(async () => {
    if (!copiaECola) return;
    try {
      await navigator.clipboard.writeText(copiaECola);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Erro ao copiar:", err);
    }
  }, [copiaECola]);

  const isExpired = timerReady && timeLeft === 0;
  const showStoreName = settings.header_store_name_visible ?? true;
  const showSecureBadge = settings.header_secure_badge ?? true;
  const logoAlign = settings.header_logo_alignment || "left";
  const iconColor = settings.header_icon_color || "var(--text-secondary)";

  const LogoContent = (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      {settings.logo_url && (
        <img
          src={settings.logo_url}
          alt=""
          style={{ height: 32, borderRadius: 4, objectFit: "contain" }}
        />
      )}
      {showStoreName && !settings.logo_url && (
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary)" }}>
          {storeName}
        </h1>
      )}
    </div>
  );

  const BadgeContent = showSecureBadge ? (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke={iconColor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
      <div style={{ textAlign: "right", lineHeight: 1.2 }}>
        <div
          style={{
            fontSize: "0.75rem",
            fontWeight: 700,
            color: "var(--text-primary)",
            letterSpacing: 0.5,
          }}
        >
          PAGAMENTO
        </div>
        <div style={{ fontSize: "0.65rem", fontWeight: 600, color: iconColor }}>
          100% SEGURO
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        background: "var(--checkout-bg)",
        fontSize: settings.font_size_base || "16px",
      }}
    >
      {/* Header */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 24px",
          background: settings.header_bg_color || "var(--card-bg)",
          borderBottom: "1px solid var(--border-color)",
        }}
      >
        {logoAlign === "center" ? (
          <>
            <div style={{ flex: 1, display: "flex", justifyContent: "flex-start" }} />
            <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
              {LogoContent}
            </div>
            <div style={{ flex: 1, display: "flex", justifyContent: "flex-end" }}>
              {BadgeContent}
            </div>
          </>
        ) : logoAlign === "right" ? (
          <>
            <div style={{ flex: 1, display: "flex", justifyContent: "flex-start" }}>
              {BadgeContent}
            </div>
            <div style={{ flex: 1, display: "flex", justifyContent: "flex-end" }}>
              {LogoContent}
            </div>
          </>
        ) : (
          <>
            {LogoContent}
            {BadgeContent}
          </>
        )}
      </header>

      {/* Main Content */}
      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-start",
          padding: "32px 20px",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 520,
            textAlign: "center",
          }}
        >
          <h2
            style={{
              fontSize: "1.75rem",
              fontWeight: 700,
              color: "var(--text-primary)",
              marginBottom: 12,
            }}
          >
            Quase lá...
          </h2>

          <p style={{ fontSize: "0.95rem", color: "var(--text-secondary)", marginBottom: 16 }}>
            {isExpired ? (
              "O código Pix expirou."
            ) : (
              <>
                Pague via pix em até{" "}
                <strong style={{ color: "var(--text-primary)" }}>{formatTime(timeLeft)}</strong> para
                confirmar seu pedido.
              </>
            )}
          </p>

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "#fff8e1",
              color: "#b8860b",
              padding: "8px 16px",
              borderRadius: 999,
              fontSize: "0.85rem",
              fontWeight: 600,
              marginBottom: 28,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#f5a623",
                display: "inline-block",
              }}
            />
            Aguardando pagamento
          </div>

          {isExpired ? (
            <div
              style={{
                background: "var(--card-bg)",
                border: "1px solid var(--border-color)",
                borderRadius: 16,
                padding: 32,
              }}
            >
              <p style={{ color: "var(--text-secondary)" }}>
                O prazo para pagamento deste pedido encerrou. Por favor, retorne ao checkout e
                finalize uma nova compra.
              </p>
            </div>
          ) : (
            <>
              {/* Desktop: QR Code */}
              <div className="pix-desktop-only" style={{ marginBottom: 24 }}>
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: 12 }}>
                  Aponte a câmera do seu celular
                </p>
                <div
                  style={{
                    background: "#ffffff",
                    padding: 16,
                    borderRadius: 12,
                    display: "inline-block",
                    border: "1px solid var(--border-color)",
                  }}
                >
                  {qrCodeUrl ? (
                    <img
                      src={qrCodeUrl}
                      alt="QR Code Pix"
                      style={{ width: 240, height: 240, display: "block" }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 240,
                        height: 240,
                        background: "#f5f5f5",
                        borderRadius: 8,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--text-muted)",
                        fontSize: "0.85rem",
                      }}
                    >
                      Gerando QR Code...
                    </div>
                  )}
                </div>
              </div>

              {/* Mobile: Phone Illustration */}
              <div className="pix-mobile-only" style={{ marginBottom: 24 }}>
                <PhoneIllustration />
              </div>

              <p style={{ fontSize: "0.95rem", color: "var(--text-secondary)", marginBottom: 20 }}>
                Total via Pix:{" "}
                <strong style={{ color: "var(--green-primary)", fontSize: "1.05rem" }}>
                  {formatCurrency(total)}
                </strong>
              </p>

              {/* Copia e Cola */}
              <div
                style={{
                  background: "var(--card-bg)",
                  border: "1px solid var(--border-color)",
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 24,
                }}
              >
                <input
                  readOnly
                  value={copiaECola}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: 8,
                    border: "1px solid var(--border-color)",
                    background: "var(--input-bg)",
                    color: "var(--text-muted)",
                    fontSize: "0.85rem",
                    fontFamily: "monospace",
                    textAlign: "center",
                    marginBottom: 12,
                    outline: "none",
                  }}
                />
                <button
                  onClick={handleCopy}
                  style={{
                    width: "100%",
                    padding: "14px 24px",
                    borderRadius: 8,
                    border: "none",
                    background: "var(--green-primary)",
                    color: "#ffffff",
                    fontWeight: 700,
                    fontSize: "1rem",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  {copied ? "Código copiado!" : "Copiar código"}
                </button>
              </div>

              {/* Como pagar o pix */}
              <div style={{ textAlign: "left" }}>
                <h3
                  style={{
                    fontSize: "1.1rem",
                    fontWeight: 700,
                    color: "var(--text-primary)",
                    marginBottom: 16,
                  }}
                >
                  Como pagar o pix
                </h3>
                <ol style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 14 }}>
                  {[
                    "Clique em copiar o código, logo acima",
                    "Abra o aplicativo do seu banco",
                    "Selecione a opção PIX",
                    'Toque em "Pix Copia e Cola"',
                    "Insira o código copiado e finalize seu pagamento",
                  ].map((text, index) => (
                    <li key={index} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                      <span
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: "50%",
                          background: "var(--green-primary)",
                          color: "#ffffff",
                          fontSize: "0.8rem",
                          fontWeight: 700,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        {index + 1}
                      </span>
                      <span style={{ fontSize: "0.9rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                        {text}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Preview back button */}
              {isPreview && onBackToCheckout && (
                <button
                  onClick={onBackToCheckout}
                  style={{
                    marginTop: 32,
                    padding: "12px 24px",
                    borderRadius: 8,
                    border: "1px solid var(--border-color)",
                    background: "var(--card-bg)",
                    color: "var(--text-primary)",
                    fontWeight: 600,
                    fontSize: "0.95rem",
                    cursor: "pointer",
                    width: "100%",
                  }}
                >
                  Voltar ao checkout
                </button>
              )}
            </>
          )}
        </div>
      </main>

      {/* Responsive styles */}
      <style>{`
        @media (max-width: 767px) {
          .pix-desktop-only {
            display: none !important;
          }
          .pix-mobile-only {
            display: block !important;
          }
        }
        @media (min-width: 768px) {
          .pix-desktop-only {
            display: block !important;
          }
          .pix-mobile-only {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}

function PhoneIllustration() {
  return (
    <svg
      width="180"
      height="180"
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ margin: "0 auto", display: "block" }}
    >
      <ellipse cx="100" cy="155" rx="55" ry="25" fill="#f4a886" />
      <path
        d="M65 145 Q55 130 70 115 L75 110 Q80 105 90 110 L135 155 Z"
        fill="#f4a886"
      />
      <rect x="70" y="50" width="80" height="130" rx="12" fill="#1a1a1a" />
      <rect x="76" y="58" width="68" height="114" rx="6" fill="#ffffff" />
      <g transform="translate(100, 100)">
        <path d="M-18 -6 L-6 -18 L6 -6 L18 -18 L18 -6 L6 6 L18 18 L6 18 L0 12 L-6 18 L-18 18 L-6 6 L-18 -6 Z" fill="#32BCAD" />
      </g>
      <circle cx="145" cy="45" r="16" fill="#ffffff" stroke="#e0e0e0" strokeWidth="2" />
      <path d="M145 37 L145 45 L151 49" stroke="#666666" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
