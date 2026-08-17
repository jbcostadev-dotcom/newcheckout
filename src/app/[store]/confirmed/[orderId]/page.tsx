"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiGet } from "@/lib/api";
import type { ConfirmedOrderResponse } from "@/types";
import {
  loadGoogleAds,
  trackConversion,
  shouldFireForProducts,
  readGoogleAdsConfig,
  isFired,
  markFired,
} from "@/lib/googleAds";
import GoogleAdsTracking from "@/components/GoogleAdsTracking";
import MetaPixelTracking from "@/components/MetaPixelTracking";
import { readMetaPixelConfig, trackMetaBrowserEvent, isMetaPurchaseFired, markMetaPurchaseFired, shouldFireForMetaProducts } from "@/lib/metaPixel";
import TikTokPixelTracking from "@/components/TikTokPixelTracking";
import { readTikTokPixelConfig, trackTikTokBrowserEvent, isTikTokPurchaseFired, markTikTokPurchaseFired, shouldFireForTikTokProducts } from "@/lib/tiktokPixel";
import KwaiPixelTracking from "@/components/KwaiPixelTracking";
import { readKwaiPixelConfig, trackKwaiBrowserEvent, isKwaiPurchaseFired, markKwaiPurchaseFired, shouldFireForKwaiProducts } from "@/lib/kwaiPixel";
import TaboolaPixelTracking from "@/components/TaboolaPixelTracking";
import { readTaboolaPixelConfig, trackTaboolaBrowserEvent, isTaboolaPurchaseFired, markTaboolaPurchaseFired, shouldFireForTaboolaProducts } from "@/lib/taboolaPixel";

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

const PREVIEW_CONFIRMED_ORDER: ConfirmedOrderResponse = {
  order_id: 12345,
  status: "paid",
  payment_method: "credit_card",
  payment_label: "Cartão de crédito",
  installments: 1,
  installment_label: "1x sem juros",
  card_brand: "visa",
  card_last4: "4242",
  customer_name: "Cliente de Exemplo",
  customer_email: "cliente@exemplo.com",
  customer_document: "12345678901",
  customer_phone: "11999999999",
  shipping_address: {
    logradouro: "Rua Exemplo",
    numero: "123",
    complemento: null,
    bairro: "Centro",
    cidade: "São Paulo",
    uf: "SP",
    cep: "01001000",
  },
  shipping_method: "Entrega padrão",
  shipping_price: 0,
  shipping_label: "Grátis",
  items: [
    {
      id: 1,
      product_id: 1,
      name: "Produto Exemplo",
      attributes: null,
      unit_price: 99.9,
      qty: 1,
      total: 99.9,
      image_url: null,
    },
  ],
  subtotal: 99.9,
  total: 99.9,
  store_name: "Nome da Loja",
};

function ConfirmedContent() {
  const params = useParams();
  const storeSlug = params.store as string;
  const orderIdParam = params.orderId as string;
  const isPreview = orderIdParam === "preview";
  const orderId = isPreview ? PREVIEW_CONFIRMED_ORDER.order_id : parseInt(orderIdParam, 10);

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
    if (!isPreview) return;
    const handler = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== "object") return;
      if (event.data.type === "checkout:settings") {
        setSettings(event.data.settings ?? {});
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [isPreview]);

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
    if (isPreview) {
      setOrder(PREVIEW_CONFIRMED_ORDER);
      setLoading(false);
      return;
    }

    if (!orderId || isNaN(orderId)) {
      setError("Pedido inválido.");
      setLoading(false);
      return;
    }

    const fetchOrder = async () => {
      try {
        const res = await apiGet<ConfirmedOrderResponse>(`/checkout/order/${orderId}/confirmed`);
        setOrder(res);

        const meta = readMetaPixelConfig();
        const metaProductIds = (res.items ?? []).map((it) => it.product_id);
        const metaPaid = res.status === "paid" || res.status === "authorized";
        if (meta && metaPaid && shouldFireForMetaProducts(meta, metaProductIds) && !isMetaPurchaseFired(String(res.order_id))) {
          trackMetaBrowserEvent(meta, "Purchase", {
            event_id: `purchase_${res.order_id}`,
            value: Number(res.total),
            currency: "BRL",
            content_ids: metaProductIds.map(String),
            contents: (res.items ?? []).map((item) => ({
              id: String(item.product_id),
              quantity: item.qty,
              item_price: Number(item.unit_price),
            })),
            content_type: "product",
            num_items: (res.items ?? []).reduce((sum, item) => sum + item.qty, 0),
            order_id: String(res.order_id),
            email: res.customer_email,
            phone: res.customer_phone,
            name: res.customer_name,
            city: res.shipping_address.cidade,
            state: res.shipping_address.uf,
            zip: res.shipping_address.cep,
            country: "br",
          }, true);
          markMetaPurchaseFired(String(res.order_id));
        }

        const tiktok = readTikTokPixelConfig();
        const tiktokProductIds = (res.items ?? []).map((it) => it.product_id);
        if (tiktok && metaPaid && shouldFireForTikTokProducts(tiktok, tiktokProductIds) && !isTikTokPurchaseFired(String(res.order_id))) {
          trackTikTokBrowserEvent(tiktok, "Purchase", {
            event_id: `purchase_${res.order_id}`,
            value: Number(res.total),
            currency: "BRL",
            content_ids: tiktokProductIds.map(String),
            contents: (res.items ?? []).map((item) => ({
              content_id: String(item.product_id),
              content_name: item.name,
              content_category: item.product_type ?? undefined,
              brand: item.vendor ?? undefined,
              sku: item.sku ?? undefined,
              content_type: "product",
              quantity: item.qty,
              price: Number(item.unit_price),
            })),
            content_type: "product",
            quantity: (res.items ?? []).reduce((sum, item) => sum + item.qty, 0),
            order_id: String(res.order_id),
            email: res.customer_email,
            phone: res.customer_phone,
            shipping_price: Number(res.shipping_price ?? 0),
          }, true);
          markTikTokPurchaseFired(String(res.order_id));
        }

        const kwai = readKwaiPixelConfig();
        const kwaiProductIds = (res.items ?? []).map((it) => it.product_id);
        if (kwai && metaPaid && shouldFireForKwaiProducts(kwai, kwaiProductIds) && !isKwaiPurchaseFired(String(res.order_id))) {
          trackKwaiBrowserEvent(kwai, "Purchase", {
            event_id: `purchase_${res.order_id}`,
            value: Number(res.total), currency: "BRL",
            content_ids: kwaiProductIds.map(String),
            contents: (res.items ?? []).map((item) => ({
              content_id: String(item.product_id), content_name: item.name,
              content_category: item.product_type ?? undefined, brand: item.vendor ?? undefined,
              sku: item.sku ?? undefined, content_type: "product", quantity: item.qty, price: Number(item.unit_price),
            })),
            content_type: "product", quantity: (res.items ?? []).reduce((sum, item) => sum + item.qty, 0),
            order_id: String(res.order_id), email: res.customer_email, phone: res.customer_phone,
            shipping_price: Number(res.shipping_price ?? 0), payment_method: res.payment_method,
            installments: res.installments,
          }, true);
          markKwaiPurchaseFired(String(res.order_id));
        }

        const taboola = readTaboolaPixelConfig();
        const taboolaProductIds = (res.items ?? []).map((it) => it.product_id);
        if (taboola && metaPaid && shouldFireForTaboolaProducts(taboola, taboolaProductIds) && !isTaboolaPurchaseFired(String(res.order_id))) {
          trackTaboolaBrowserEvent(taboola, "Purchase", {
            event_id: `purchase_${res.order_id}`,
            value: Number(res.total), currency: "BRL",
            content_ids: taboolaProductIds.map(String),
            contents: (res.items ?? []).map((item) => ({
              content_id: String(item.product_id), content_name: item.name,
              content_category: item.product_type ?? undefined, brand: item.vendor ?? undefined,
              sku: item.sku ?? undefined, quantity: item.qty, price: Number(item.unit_price),
            })),
            quantity: (res.items ?? []).reduce((sum, item) => sum + item.qty, 0),
            order_id: String(res.order_id), email: res.customer_email,
            shipping_price: Number(res.shipping_price ?? 0), payment_method: res.payment_method,
          }, true);
          markTaboolaPurchaseFired(String(res.order_id));
        }

        // Dispara a conversão do Google Ads quando o pedido está pago/autorizado.
        const ga = readGoogleAdsConfig();
        if (ga?.enabled && ga.pixel_id) {
          loadGoogleAds(ga.pixel_id);
          const txnId = String(res.order_id);
          const productIds = (res.items ?? []).map((it) => it.product_id);
          const paid = res.status === "paid" || res.status === "authorized";
          // A página confirmed só é atingida quando o pedido foi pago;
          // `only_paid_sales=true` é satisfeito pelo simples fato de estarmos aqui.
          // Carrinho/boleto ainda pendentes não chegam nesta rota.
          const allowedByFilter = !ga.only_selected_products
            ? true
            : shouldFireForProducts(ga, productIds);
          if (ga.pixel_id && ga.enabled && paid && allowedByFilter && !isFired(txnId)) {
            trackConversion(
              { pixel_id: ga.pixel_id, conversion_label: ga.conversion_label },
              {
                transaction_id: txnId,
                value: Number(res.total),
                currency: "BRL",
                items: (res.items ?? []).map((it) => ({
                  id: String(it.product_id),
                  name: it.name,
                  quantity: it.qty,
                  price: Number(it.unit_price),
                })),
              }
            );
            markFired(txnId);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar pedido.");
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderId, isPreview]);

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

  const logoAlign = settings.header_logo_alignment || "left";

  const LogoContent = (
    <div className="confirmed-store-logo">
      {settings.logo_url && (
        <img src={settings.logo_url} alt={storeName} />
      )}
      {(settings.header_store_name_visible ?? true) && !settings.logo_url && (
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary)" }}>
          {storeName}
        </h1>
      )}
    </div>
  );

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      minHeight: "100vh",
      background: "var(--checkout-bg)",
      fontSize: settings.font_size_base || "16px",
    }}>
      {!isPreview && (
        <>
          <GoogleAdsTracking config={readGoogleAdsConfig()} />
          <MetaPixelTracking config={readMetaPixelConfig()} />
          <TikTokPixelTracking config={readTikTokPixelConfig()} />
          <KwaiPixelTracking config={readKwaiPixelConfig()} />
          <TaboolaPixelTracking config={readTaboolaPixelConfig()} />
        </>
      )}
      {/* Header */}
      <header style={{
        background: settings.header_bg_color || "var(--card-bg)",
        borderBottom: "1px solid var(--border-color)",
      }}>
        <div
          className="confirmed-header-inner"
          style={{
            justifyContent: logoAlign === "center" ? "center" : logoAlign === "right" ? "flex-end" : "flex-start",
          }}
        >
          {LogoContent}
        </div>
      </header>

      {/* Main Content */}
      <main className="confirmed-main" style={{
        maxWidth: 800,
        width: "100%",
        margin: "0 auto",
        padding: "32px 24px",
        flex: 1,
      }}>
        {/* Success Banner */}
        <div className="confirmed-success-card" style={{
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
            Você receberá em instantes um e-mail em <strong className="confirmed-break-text">{order.customer_email}</strong><br />
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
        <div className="confirmed-info-grid" style={{
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
            <div className="confirmed-break-text" style={{ fontSize: "0.875rem", color: "var(--text-secondary)", lineHeight: 1.8 }}>
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
        <div className="confirmed-summary-card" style={{
          background: "var(--card-bg)",
          border: "1px solid var(--border-color)",
          borderRadius: 12,
          padding: 24,
        }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 20 }}>
            Resumo do Pedido
          </h3>

          {/* Table Header */}
          <div className="confirmed-table-header" style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr 1fr 1fr",
            gap: 16,
            paddingBottom: 12,
            borderBottom: "1px solid var(--border-color)",
            marginBottom: 16,
          }}>
            <div className="confirmed-table-spacer" />
            <div className="confirmed-desktop-column" style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", textAlign: "center" }}>Quantidade</div>
            <div className="confirmed-desktop-column" style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", textAlign: "center" }}>Preço Unitário</div>
            <div className="confirmed-total-column" style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", textAlign: "right" }}>Total</div>
          </div>

          {/* Items */}
          {order.items.map((item) => (
            <div
              key={item.id}
              className="confirmed-items-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr 1fr 1fr",
                gap: 16,
                alignItems: "center",
                padding: "12px 0",
                borderBottom: "1px solid var(--border-color)",
              }}
            >
              <div className="confirmed-product-cell" style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={item.name}
                    style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8 }}
                  />
                ) : (
                  <div style={{ width: 56, height: 56, background: "var(--border-color)", borderRadius: 8 }} />
                )}
                <div className="confirmed-product-copy">
                  <div className="confirmed-break-text" style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-primary)" }}>{item.name}</div>
                  {item.attributes && item.attributes.length > 0 && (
                    <div className="confirmed-break-text" style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      {item.attributes.map((a) => `${a.name}: ${a.value}`).join(" | ")}
                    </div>
                  )}
                </div>
              </div>
              <div className="confirmed-desktop-column" style={{ fontSize: "0.875rem", color: "var(--text-secondary)", textAlign: "center" }}>{item.qty}</div>
              <div className="confirmed-desktop-column" style={{ fontSize: "0.875rem", color: "var(--text-secondary)", textAlign: "center" }}>{formatCurrency(item.unit_price)}</div>
              <div className="confirmed-total-column" style={{ fontSize: "0.875rem", color: "var(--text-secondary)", textAlign: "right" }}>{formatCurrency(item.total)}</div>
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
        .confirmed-header-inner {
          display: flex;
          align-items: center;
          width: 100%;
          max-width: 800px;
          min-height: 64px;
          margin: 0 auto;
          padding: 16px 24px;
        }
        .confirmed-store-logo {
          display: flex;
          align-items: center;
          min-width: 0;
        }
        .confirmed-store-logo img {
          display: block;
          width: auto;
          max-width: 100%;
          height: 32px;
          border-radius: 4px;
          object-fit: contain;
        }
        .confirmed-info-grid,
        .confirmed-items-grid,
        .confirmed-table-header {
          min-width: 0;
        }
        .confirmed-product-cell,
        .confirmed-product-copy {
          min-width: 0;
        }
        .confirmed-product-cell img,
        .confirmed-product-cell > div:first-child:not(.confirmed-product-copy) {
          flex-shrink: 0;
        }
        .confirmed-break-text {
          overflow-wrap: anywhere;
          word-break: break-word;
        }
        @media (max-width: 768px) {
          .confirmed-header-inner {
            min-height: 60px;
            padding: 14px 16px;
          }
          .confirmed-main {
            padding: 24px 16px !important;
          }
          .confirmed-success-card {
            padding: 24px 16px !important;
          }
          .confirmed-info-grid {
            grid-template-columns: 1fr !important;
            gap: 28px !important;
            padding: 20px !important;
          }
          .confirmed-summary-card {
            padding: 20px !important;
          }
          .confirmed-table-header,
          .confirmed-items-grid {
            grid-template-columns: minmax(0, 1fr) auto !important;
            gap: 12px !important;
          }
          .confirmed-table-spacer {
            display: block;
          }
          .confirmed-desktop-column {
            display: none !important;
          }
          .confirmed-total-column {
            min-width: max-content;
            align-self: center;
          }
          .confirmed-product-cell {
            align-items: flex-start !important;
          }
          .confirmed-product-cell img,
          .confirmed-product-cell > div:first-child:not(.confirmed-product-copy) {
            width: 64px !important;
            height: 64px !important;
          }
        }
        @media (max-width: 380px) {
          .confirmed-main {
            padding-right: 12px !important;
            padding-left: 12px !important;
          }
          .confirmed-summary-card,
          .confirmed-info-grid {
            padding: 16px !important;
          }
          .confirmed-table-header,
          .confirmed-items-grid {
            gap: 8px !important;
          }
          .confirmed-product-cell {
            gap: 8px !important;
          }
          .confirmed-product-cell img,
          .confirmed-product-cell > div:first-child:not(.confirmed-product-copy) {
            width: 52px !important;
            height: 52px !important;
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
