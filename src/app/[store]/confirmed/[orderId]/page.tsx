"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiGet } from "@/lib/api";
import type { ConfirmedOrderResponse } from "@/types";

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatCPF(cpf: string): string {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return cpf;
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11) {
    return digits.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  }
  if (digits.length === 10) {
    return digits.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  }
  return phone;
}

function ConfirmedContent() {
  const params = useParams();
  const storeSlug = params.store as string;
  const orderId = parseInt(params.orderId as string, 10);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<ConfirmedOrderResponse | null>(null);
  const [settings, setSettings] = useState<{
    primary_color?: string;
    dark_mode?: boolean;
    logo_url?: string | null;
    header_store_name_visible?: boolean;
    header_secure_badge?: boolean;
    header_logo_alignment?: string;
    header_bg_color?: string;
    header_icon_color?: string;
    font_family?: string;
    font_size_base?: string;
    banner_url?: string | null;
    banner_height?: string;
    announcement_bar_enabled?: boolean;
    announcement_bar_bg?: string;
    announcement_bar_text_color?: string;
    banner_message?: string;
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

    const fetchOrder = async () => {
      try {
        const res = await apiGet<ConfirmedOrderResponse>(`/checkout/order/${orderId}/confirmed`);
        setOrder(res);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar pedido.");
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderId]);

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
        <div style={{ fontSize: "1.1rem", opacity: 0.6 }}>Carregando...</div>
      </div>
    );
  }

  if (error || !order) {
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
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary)" }}>Pedido indisponível</h2>
          <p style={{ marginTop: 8, fontSize: "0.9rem", color: "var(--text-muted)" }}>
            {error ?? "Não foi possível carregar os dados do pedido."}
          </p>
        </div>
      </div>
    );
  }

  const storeName = settings.logo_url || (settings.header_store_name_visible ?? true)
    ? order.store_name ?? "Nome da Loja"
    : "";

  const iconColor = settings.header_icon_color || "var(--text-secondary)";
  const logoAlign = settings.header_logo_alignment || "left";

  const LogoContent = (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      {settings.logo_url && (
        <img src={settings.logo_url} alt="" style={{ height: 32, borderRadius: 4, objectFit: "contain" }} />
      )}
      {(settings.header_store_name_visible ?? true) && !settings.logo_url && (
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary)" }}>
          {storeName}
        </h1>
      )}
    </div>
  );

  const BadgeContent = (settings.header_secure_badge ?? true) ? (
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

  const bannerHeightPx = settings.banner_height === "sm" ? 60 : settings.banner_height === "lg" ? 160 : 100;

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
        maxWidth: 800,
        width: "100%",
        margin: "0 auto",
        padding: "32px 24px",
        flex: 1,
      }}>
        {/* Success Banner */}
        <div style={{
          background: "var(--card-bg)",
          border: "1px solid var(--border-color)",
          borderRadius: 12,
          padding: "32px 24px",
          textAlign: "center",
          marginBottom: 24,
        }}>
          <div style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            border: "3px solid var(--green-primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
          }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--green-primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
            Pedido confirmado
          </h2>
          <p style={{ fontSize: "0.95rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
            Você receberá em instantes um e-mail em <strong>{order.customer_email}</strong><br />
            com os detalhes do seu pedido.
          </p>
        </div>

        {/* Order Number */}
        <p style={{
          fontSize: "0.95rem",
          color: "var(--text-primary)",
          marginBottom: 24,
        }}>
          Número do pedido: <strong>Z-{order.order_id}</strong>
        </p>

        {/* Customer Info + Address + Payment */}
        <div style={{
          background: "var(--card-bg)",
          border: "1px solid var(--border-color)",
          borderRadius: 12,
          padding: 24,
          marginBottom: 24,
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 24,
        }}>
          {/* Dados Pessoais */}
          <div>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>
              Dados Pessoais
            </h3>
            <div style={{ fontSize: "0.875rem", color: "var(--text-secondary)", lineHeight: 1.8 }}>
              <div>{order.customer_name}</div>
              <div>{formatCPF(order.customer_document)}</div>
              <div>{order.customer_email}</div>
              <div>{formatPhone(order.customer_phone)}</div>
            </div>
          </div>

          {/* Endereço do Pedido */}
          <div>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>
              Endereço do pedido
            </h3>
            <div style={{ fontSize: "0.875rem", color: "var(--text-secondary)", lineHeight: 1.8 }}>
              <div>{order.shipping_address.logradouro}, {order.shipping_address.numero}</div>
              {order.shipping_address.complemento && <div>{order.shipping_address.complemento}</div>}
              <div>{order.shipping_address.cidade}/{order.shipping_address.uf}</div>
              <div>{order.shipping_address.cep}</div>
            </div>
          </div>

          {/* Forma de Pagamento */}
          <div>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>
              Forma de Pagamento
            </h3>
            <div style={{ fontSize: "0.875rem", color: "var(--text-secondary)", lineHeight: 1.8 }}>
              <div>{order.payment_label}</div>
              {order.installment_label && <div>{order.installment_label}</div>}
              {order.card_brand && order.card_last4 && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                  <span style={{
                    background: "#1a1f71",
                    color: "#fff",
                    padding: "2px 6px",
                    borderRadius: 4,
                    fontSize: "0.75rem",
                    fontWeight: 700,
                  }}>
                    {order.card_brand.toUpperCase()}
                  </span>
                  final {order.card_last4}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Resumo do Pedido */}
        <div style={{
          background: "var(--card-bg)",
          border: "1px solid var(--border-color)",
          borderRadius: 12,
          padding: 24,
        }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 20 }}>
            Resumo do Pedido
          </h3>

          {/* Table Header */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr 1fr 1fr",
            gap: 16,
            paddingBottom: 12,
            borderBottom: "1px solid var(--border-color)",
            marginBottom: 16,
          }}>
            <div />
            <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", textAlign: "center" }}>Quantidade</div>
            <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", textAlign: "center" }}>Preço Unitário</div>
            <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", textAlign: "right" }}>Total</div>
          </div>

          {/* Items */}
          {order.items.map((item) => (
            <div
              key={item.id}
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr 1fr 1fr",
                gap: 16,
                alignItems: "center",
                padding: "12px 0",
                borderBottom: "1px solid var(--border-color)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={item.name}
                    style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8 }}
                  />
                ) : (
                  <div style={{ width: 56, height: 56, background: "var(--border-color)", borderRadius: 8 }} />
                )}
                <div>
                  <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-primary)" }}>{item.name}</div>
                  {item.attributes && item.attributes.length > 0 && (
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      {item.attributes.map((a) => `${a.name}: ${a.value}`).join(" | ")}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ fontSize: "0.875rem", color: "var(--text-secondary)", textAlign: "center" }}>{item.qty}</div>
              <div style={{ fontSize: "0.875rem", color: "var(--text-secondary)", textAlign: "center" }}>{formatCurrency(item.unit_price)}</div>
              <div style={{ fontSize: "0.875rem", color: "var(--text-secondary)", textAlign: "right" }}>{formatCurrency(item.total)}</div>
            </div>
          ))}

          {/* Totals */}
          <div style={{ marginTop: 16 }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "8px 0",
              fontSize: "0.9rem",
            }}>
              <span style={{ color: "var(--text-secondary)" }}>Subtotal</span>
              <span style={{ color: "var(--text-secondary)" }}>{formatCurrency(order.subtotal)}</span>
            </div>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "8px 0",
              fontSize: "0.9rem",
            }}>
              <span style={{ color: "var(--text-secondary)" }}>Frete</span>
              <span style={{ color: order.shipping_price === 0 ? "var(--green-primary)" : "var(--text-secondary)" }}>
                {order.shipping_label}
              </span>
            </div>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "12px 0 0",
              borderTop: "1px solid var(--border-color)",
              marginTop: 8,
              fontSize: "1rem",
              fontWeight: 700,
            }}>
              <span style={{ color: "var(--text-primary)" }}>Total</span>
              <span style={{ color: "var(--text-primary)" }}>{formatCurrency(order.total)}</span>
            </div>
          </div>
        </div>
      </main>

      {/* Responsive */}
      <style>{`
        @media (max-width: 768px) {
          .confirmed-info-grid {
            grid-template-columns: 1fr !important;
          }
          .confirmed-items-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

export default function ConfirmedPage() {
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
      <ConfirmedContent />
    </Suspense>
  );
}
