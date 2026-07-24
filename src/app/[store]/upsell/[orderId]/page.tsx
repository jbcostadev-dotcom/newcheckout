"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import QRCode from "qrcode";
import { apiGet, apiPost } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import type {
  ConfirmedOrderResponse,
  InstallmentConfig,
  UpsellChargeResponse,
  UpsellOffer,
  UpsellOfferResponse,
} from "@/types";

function formatCardBrand(brand?: string | null): string {
  if (!brand) return "";
  return brand.toUpperCase();
}

function buildInstallmentOptions(total: number, config?: InstallmentConfig | null) {
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
    const totalWithInterest = total * Math.pow(1 + rate / 100, i);
    const installmentValue = totalWithInterest / i;
    const rateLabel = rate > 0 ? ` (${rate.toString().replace(".", ",")}% a.m.)` : " (sem juros)";
    options.push({
      value: i,
      label: `${i}x de ${formatCurrency(installmentValue)}${rateLabel}`,
    });
  }

  return options;
}

function UpsellContent() {
  const params = useParams();
  const router = useRouter();
  const storeSlug = params.store as string;
  const orderId = parseInt(params.orderId as string, 10);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offer, setOffer] = useState<UpsellOffer | null>(null);
  const [orderInfo, setOrderInfo] = useState<{ payment_method: string; card_brand?: string | null; card_last4?: string | null } | null>(null);
  const [charging, setCharging] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [pixResult, setPixResult] = useState<UpsellChargeResponse | null>(null);
  const [pixQrUrl, setPixQrUrl] = useState<string | null>(null);
  const [pixPolling, setPixPolling] = useState(false);
  const [installments, setInstallments] = useState<number>(1);
  const [installmentConfig, setInstallmentConfig] = useState<InstallmentConfig | null>(null);
  const getStoreIdentifier = useCallback((): string => {
    const hostname = window.location.hostname;
    const baseDomain =
      process.env.NEXT_PUBLIC_CHECKOUT_BASE_DOMAIN || "bersenker.shop";
    const checkoutAppDomain =
      process.env.NEXT_PUBLIC_CHECKOUT_APP_DOMAIN || `checkout.${baseDomain}`;

    if (hostname === checkoutAppDomain || hostname === `www.${checkoutAppDomain}`) {
      return storeSlug;
    }

    if (hostname.endsWith(`.${baseDomain}`)) {
      const sub = hostname.replace(`.${baseDomain}`, "");
      if (sub && sub !== checkoutAppDomain.split(".")[0]) return sub;
    }

    return hostname;
  }, [storeSlug]);

  const domain = useMemo(() => getStoreIdentifier(), [getStoreIdentifier]);

  const installmentOptions = useMemo(() => {
    if (!offer) return [];
    return buildInstallmentOptions(offer.product.upsell_price, installmentConfig);
  }, [offer, installmentConfig]);

  const [settings, setSettings] = useState<{
    primary_color?: string;
    dark_mode?: boolean;
    logo_url?: string | null;
    banner_url?: string | null;
    banner_height?: string;
    banner_message?: string;
    header_store_name_visible?: boolean;
    header_secure_badge?: boolean;
    header_logo_alignment?: string;
    header_bg_color?: string;
    header_icon_color?: string;
    font_family?: string;
    font_size_base?: string;
    announcement_bar_enabled?: boolean;
    announcement_bar_bg?: string;
    announcement_bar_text_color?: string;
  }>({});

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("pix_page_settings");
      if (raw) {
        setSettings(JSON.parse(raw));
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (settings.primary_color) {
      root.style.setProperty("--green-primary", settings.primary_color);
      root.style.setProperty("--green-check", settings.primary_color);
      root.style.setProperty("--border-active", settings.primary_color);
      root.style.setProperty("--input-border-focus", settings.primary_color);
      root.style.setProperty("--badge-green-text", settings.primary_color);
    }

    if (settings.dark_mode) {
      root.style.setProperty("--checkout-bg", "#0a0a1a");
      root.style.setProperty("--card-bg", "rgba(255,255,255,0.05)");
      root.style.setProperty("--border-color", "rgba(255,255,255,0.1)");
      root.style.setProperty("--text-primary", "#ffffff");
      root.style.setProperty("--text-secondary", "rgba(255,255,255,0.7)");
      root.style.setProperty("--text-muted", "rgba(255,255,255,0.5)");
    } else {
      root.style.setProperty("--checkout-bg", "#f5f5f5");
      root.style.setProperty("--card-bg", "#ffffff");
      root.style.setProperty("--border-color", "#e0e0e0");
      root.style.setProperty("--text-primary", "#1a1a1a");
      root.style.setProperty("--text-secondary", "#666666");
      root.style.setProperty("--text-muted", "#999999");
    }
  }, [settings]);

  useEffect(() => {
    if (!orderId || isNaN(orderId)) {
      setError("Pedido inválido.");
      setLoading(false);
      return;
    }

    const fetchOffer = async () => {
      try {
        const d = getStoreIdentifier();
        const res = await apiGet<UpsellOfferResponse>(
          `/checkout/upsell?domain=${encodeURIComponent(d)}&order_id=${orderId}`
        );

        if (!res.has_upsell || !res.upsell) {
          router.replace(`/${storeSlug}/confirmed/${orderId}`);
          return;
        }

        setOffer(res.upsell);
        setOrderInfo(res.order);
        if (res.installment_config) {
          setInstallmentConfig(res.installment_config);
          setInstallments(res.installment_config.pre_selected ?? 1);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar oferta.");
      } finally {
        setLoading(false);
      }
    };

    fetchOffer();
  }, [orderId, getStoreIdentifier, router, storeSlug]);

  // Gera QR code quando retorna novo PIX
  useEffect(() => {
    if (!pixResult?.success || !pixResult.pix_copia_cola) return;

    let cancelled = false;
    QRCode.toDataURL(pixResult.pix_copia_cola, { width: 240, margin: 2 })
      .then((url) => {
        if (!cancelled) setPixQrUrl(url);
      })
      .catch((err) => {
        console.error("Erro ao gerar QR Code do upsell:", err);
      });

    return () => {
      cancelled = true;
    };
  }, [pixResult]);

  // Polling de PIX após gerar novo QR code
  useEffect(() => {
    if (!pixResult?.success || !pixResult.pix_copia_cola || pixPolling) return;

    setPixPolling(true);
    const interval = setInterval(async () => {
      try {
        const res = await apiGet<{ status: string; has_upsell?: boolean }>(
          `/checkout/order/${orderId}/pix`
        );
        if (res.status === "paid" || res.status === "authorized") {
          clearInterval(interval);
          router.replace(`/${storeSlug}/confirmed/${orderId}`);
        }
      } catch (err) {
        console.error("Erro no polling do PIX upsell", err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [pixResult, pixPolling, orderId, router, storeSlug]);

  const handleAccept = useCallback(async () => {
    if (!offer) return;
    setCharging(true);
    try {
      const res = await apiPost<UpsellChargeResponse>("/checkout/upsell/charge", {
        domain,
        order_id: orderId,
        upsell_id: offer.id,
        installments,
      });

      if (!res.success) {
        setError(res.message || "Não foi possível processar a oferta.");
        return;
      }

      // Cartão: redireciona direto para confirmed
      if (!res.pix_copia_cola) {
        router.replace(`/${storeSlug}/confirmed/${orderId}`);
        return;
      }

      // PIX: exibe QR code
      setPixResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao processar oferta.");
    } finally {
      setCharging(false);
    }
  }, [offer, orderId, domain, router, installments]);

  const handleDecline = useCallback(async () => {
    setDeclining(true);
    try {
      await apiPost("/checkout/upsell/decline", {
        domain,
        order_id: orderId,
      });
      router.replace(`/${storeSlug}/confirmed/${orderId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao recusar oferta.");
      setDeclining(false);
    }
  }, [orderId, domain, router, storeSlug]);

  if (loading) {
    return (
      <div style={{
        display: "flex",
        minHeight: "100vh",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--checkout-bg)",
        color: "var(--text-primary)",
      }}>
        <div style={{ fontSize: "1.1rem", opacity: 0.6 }}>Carregando oferta...</div>
      </div>
    );
  }

  if (error || !offer || !orderInfo) {
    return (
      <div style={{
        display: "flex",
        minHeight: "100vh",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--checkout-bg)",
        padding: 20,
        textAlign: "center",
      }}>
        <div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary)" }}>Oferta indisponível</h2>
          <p style={{ marginTop: 8, fontSize: "0.9rem", color: "var(--text-muted)" }}>
            {error ?? "Não foi possível carregar a oferta."}
          </p>
          <button
            onClick={() => router.replace(`/${storeSlug}/confirmed/${orderId}`)}
            style={{
              marginTop: 16,
              padding: "12px 24px",
              borderRadius: 8,
              border: "none",
              background: "var(--green-primary)",
              color: "#fff",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Ver resumo do pedido
          </button>
        </div>
      </div>
    );
  }

  const showStoreName = settings.header_store_name_visible ?? true;
  const showSecureBadge = settings.header_secure_badge ?? true;
  const logoAlign = settings.header_logo_alignment || "left";
  const iconColor = settings.header_icon_color || "var(--text-secondary)";
  const bannerHeightPx = settings.banner_height === "sm" ? 60 : settings.banner_height === "lg" ? 160 : 100;

  const LogoContent = (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      {settings.logo_url && (
        <img src={settings.logo_url} alt="" style={{ height: 32, borderRadius: 4, objectFit: "contain" }} />
      )}
      {showStoreName && !settings.logo_url && (
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary)" }}>
          {storeSlug}
        </h1>
      )}
    </div>
  );

  const BadgeContent = showSecureBadge ? (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
      <div style={{ textAlign: "right", lineHeight: 1.2 }}>
        <div style={{ fontSize: "0.75rem", fontWeight: 700, color: iconColor, letterSpacing: 0.5 }}>PAGAMENTO</div>
        <div style={{ fontSize: "0.65rem", fontWeight: 600, color: iconColor }}>100% SEGURO</div>
      </div>
    </div>
  ) : null;

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      minHeight: "100vh",
      background: "var(--checkout-bg)",
      fontSize: settings.font_size_base || "16px",
    }}>
      {/* Header */}
      <header style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "16px 32px",
        background: settings.header_bg_color || "var(--card-bg)",
        borderBottom: "1px solid var(--border-color)",
      }}>
        {logoAlign === "center" ? (
          <>
            <div style={{ flex: 1 }} />
            <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>{LogoContent}</div>
            <div style={{ flex: 1, display: "flex", justifyContent: "flex-end" }}>{BadgeContent}</div>
          </>
        ) : logoAlign === "right" ? (
          <>
            <div style={{ flex: 1, display: "flex", justifyContent: "flex-start" }}>{BadgeContent}</div>
            <div style={{ flex: 1, display: "flex", justifyContent: "flex-end" }}>{LogoContent}</div>
          </>
        ) : (
          <>
            {LogoContent}
            {BadgeContent}
          </>
        )}
      </header>

      {/* Announcement Bar */}
      {(settings.announcement_bar_enabled ?? true) && (
        <div style={{
          background: settings.announcement_bar_bg || "#333333",
          color: settings.announcement_bar_text_color || "#d4a843",
          textAlign: "center",
          padding: "8px 16px",
          fontSize: "0.85rem",
          fontWeight: 500,
        }}>
          {settings.banner_message || "Digite aqui a mensagem"}
        </div>
      )}

      {/* Banner Image */}
      {settings.banner_url && (
        <div style={{ width: "100%", overflow: "hidden" }}>
          <img src={settings.banner_url} alt="Banner" style={{ width: "100%", height: bannerHeightPx, objectFit: "cover", display: "block" }} />
        </div>
      )}

      {/* Main Content */}
      <main style={{
        maxWidth: 680,
        width: "100%",
        margin: "0 auto",
        padding: "32px 24px",
        flex: 1,
      }}>
        {/* Success message */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            border: "3px solid var(--green-primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--green-primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p style={{ fontSize: "0.95rem", color: "var(--text-secondary)" }}>
            Seu pedido nº <strong>{orderId}</strong> foi realizado.
          </p>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: 4 }}>
            Em instantes você receberá um e-mail com todos os detalhes da sua compra.
          </p>
        </div>

        {/* Upsell Card */}
        <div style={{
          background: "var(--card-bg)",
          border: "1px solid var(--border-color)",
          borderRadius: 16,
          padding: "28px 24px",
        }}>
          <h2 style={{
            fontSize: "1.5rem",
            fontWeight: 700,
            color: "var(--text-primary)",
            textAlign: "center",
            marginBottom: 8,
          }}>
            {offer.offer_title ?? "Você foi selecionado para ganhar esta SUPER OFERTA!"}
          </h2>
          <p style={{
            fontSize: "0.95rem",
            color: "var(--text-secondary)",
            textAlign: "center",
            marginBottom: 24,
          }}>
            {offer.offer_message ?? "Aproveite agora mesmo! É uma OPORTUNIDADE ÚNICA que separamos exclusivamente para você."}
          </p>

          {!pixResult ? (
            <>
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 24,
                alignItems: "start",
                marginBottom: 24,
              }}>
                {/* Product Image */}
                <div>
                  {offer.product.image_url ? (
                    <img
                      src={offer.product.image_url}
                      alt={offer.product.name}
                      style={{
                        width: "100%",
                        maxHeight: 240,
                        objectFit: "cover",
                        borderRadius: 12,
                      }}
                    />
                  ) : (
                    <div style={{
                      width: "100%",
                      height: 200,
                      background: "var(--border-color)",
                      borderRadius: 12,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--text-muted)",
                    }}>
                      Sem imagem
                    </div>
                  )}
                </div>

                {/* Product Info */}
                <div>
                  <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    1 UNIDADE DE
                  </p>
                  <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
                    {offer.product.name}
                  </h3>
                  <p style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--green-primary)", marginBottom: 16 }}>
                    {formatCurrency(offer.product.upsell_price)}
                  </p>

                  {/* Atributos / variação do produto */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {offer.product.attributes && offer.product.attributes.length > 0 && (
                      <div>
                        <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
                          Variação
                        </label>
                        <div style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 8,
                          fontSize: "0.9rem",
                          color: "var(--text-primary)",
                        }}>
                          {offer.product.attributes.map((attr, idx) => (
                            <span
                              key={idx}
                              style={{
                                padding: "4px 10px",
                                borderRadius: 6,
                                background: "var(--checkout-bg)",
                                border: "1px solid var(--border-color)",
                              }}
                            >
                              {attr.name}: {attr.value}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {orderInfo.payment_method === "credit_card" && installmentOptions.length > 0 && (
                      <div>
                        <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
                          Nº de Parcelas
                        </label>
                        <select
                          value={String(installments)}
                          onChange={(e) => setInstallments(Number(e.target.value))}
                          style={{
                            width: "100%",
                            padding: "10px 12px",
                            borderRadius: 8,
                            border: "1px solid var(--border-color)",
                            background: "var(--card-bg)",
                            color: "var(--text-primary)",
                            fontSize: "0.95rem",
                          }}
                        >
                          {installmentOptions.map((i) => (
                            <option key={i.value} value={String(i.value)}>{i.label}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Accept Button */}
              <button
                onClick={handleAccept}
                disabled={charging}
                style={{
                  width: "100%",
                  padding: "16px 24px",
                  borderRadius: 8,
                  border: "none",
                  background: offer.button_color,
                  color: offer.button_text_color,
                  fontWeight: 700,
                  fontSize: "1rem",
                  cursor: charging ? "not-allowed" : "pointer",
                  opacity: charging ? 0.7 : 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                {charging ? "Processando..." : offer.button_label}
              </button>

              {/* Card info */}
              {orderInfo.payment_method === "credit_card" && orderInfo.card_last4 && (
                <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", textAlign: "center", marginBottom: 16 }}>
                  Comprando com seu cartão {formatCardBrand(orderInfo.card_brand)} final {orderInfo.card_last4}
                  <br />
                  <span style={{ fontSize: "0.75rem" }}>Você está em um ambiente seguro</span>
                </p>
              )}

              {/* Decline Link */}
              <button
                onClick={handleDecline}
                disabled={declining}
                style={{
                  width: "100%",
                  padding: "12px 24px",
                  borderRadius: 8,
                  border: "none",
                  background: "transparent",
                  color: "var(--text-secondary)",
                  fontWeight: 600,
                  fontSize: "0.95rem",
                  cursor: declining ? "not-allowed" : "pointer",
                  textDecoration: "underline",
                }}
              >
                {declining ? "Processando..." : "FINALIZAR PEDIDO SEM A OFERTA"}
              </button>
            </>
          ) : (
            /* PIX QR Code */
            <div style={{ textAlign: "center" }}>
              <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>
                Novo PIX gerado!
              </h3>
              <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginBottom: 24 }}>
                Escaneie o QR code ou copie o código para pagar o valor adicional do upsell.
              </p>
              <div style={{
                background: "#ffffff",
                padding: 16,
                borderRadius: 12,
                display: "inline-block",
                marginBottom: 20,
              }}>
                {pixQrUrl ? (
                  <img
                    src={pixQrUrl}
                    alt="QR Code PIX"
                    style={{ width: 240, height: 240, display: "block" }}
                  />
                ) : (
                  <div style={{
                    width: 240,
                    height: 240,
                    background: "#f5f5f5",
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--text-muted)",
                    fontSize: "0.85rem",
                  }}>
                    Gerando QR Code...
                  </div>
                )}
              </div>
              <div style={{
                background: "var(--checkout-bg)",
                border: "1px solid var(--border-color)",
                borderRadius: 8,
                padding: 12,
                marginBottom: 16,
              }}>
                <p style={{
                  fontFamily: "monospace",
                  fontSize: "0.85rem",
                  color: "var(--text-secondary)",
                  wordBreak: "break-all",
                }}>
                  {pixResult.pix_copia_cola}
                </p>
              </div>
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                Aguardando confirmação do pagamento...
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function UpsellPage() {
  return (
    <Suspense fallback={
      <div style={{
        display: "flex",
        minHeight: "100vh",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--checkout-bg)",
        color: "var(--text-primary)",
      }}>
        <div style={{ fontSize: "1.1rem", opacity: 0.6 }}>Carregando...</div>
      </div>
    }>
      <UpsellContent />
    </Suspense>
  );
}
