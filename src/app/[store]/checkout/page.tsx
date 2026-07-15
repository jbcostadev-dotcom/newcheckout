"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { apiGet, apiPost } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { CheckoutData, CheckoutProcessResponse, CheckoutProduct } from "@/types";

interface GroupedItem {
  product: CheckoutProduct;
  qty: number;
}

function groupProductsByIds(products: CheckoutProduct[], ids: number[]): GroupedItem[] {
  // IDs repetidos no query string viram quantidade. Agrupa preservando a ordem.
  const seen = new Map<number, GroupedItem>();
  const orderedIds: number[] = [];

  for (const id of ids) {
    const p = products.find((x) => x.id === id);
    if (!p) continue;
    if (!seen.has(id)) orderedIds.push(id);
    const existing = seen.get(id);
    if (existing) {
      existing.qty++;
    } else {
      seen.set(id, { product: p, qty: 1 });
    }
  }
  return orderedIds.map((id) => seen.get(id)!).filter(Boolean);
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0a0a1a] text-white">
          <div className="animate-pulse text-lg">Carregando...</div>
        </div>
      }
    >
      <CheckoutPageContent />
    </Suspense>
  );
}

function CheckoutPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const storeSlug = params.store as string;
  const productsParam = searchParams.get("products") ?? "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CheckoutData | null>(null);
  const [processing, setProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"pix" | "credit_card">("pix");

  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerDocument, setCustomerDocument] = useState("");

  const [pixQrCode, setPixQrCode] = useState<string | null>(null);
  const [pixCopiaCola, setPixCopiaCola] = useState<string | null>(null);
  const [orderPaid, setOrderPaid] = useState(false);

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

  useEffect(() => {
    const fetchCheckout = async () => {
      try {
        const domain = getStoreIdentifier();
        const res = await apiGet<CheckoutData>(
          `/checkout?domain=${encodeURIComponent(domain)}&product_ids=${encodeURIComponent(productsParam)}`
        );
        setData(res);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar checkout.");
      } finally {
        setLoading(false);
      }
    };
    fetchCheckout();
  }, [productsParam, getStoreIdentifier]);

  // Lista de IDs (preserva repetições) derivada da resposta — garante que
  // só enviamos de volta IDs que o backend confirmou como ativos.
  const groupedItems: GroupedItem[] = data
    ? groupProductsByIds(
        data.products,
        productsParam
          .split(",")
          .map((s) => parseInt(s.trim(), 10))
          .filter((n) => !isNaN(n))
      )
    : [];

  const handlePayment = async () => {
    if (!data || groupedItems.length === 0) return;
    if (!customerName.trim() || !customerEmail.trim()) {
      alert("Preencha nome e e-mail.");
      return;
    }

    setProcessing(true);
    try {
      const domain = getStoreIdentifier();
      const items = groupedItems.map((g) => ({
        product_id: g.product.id,
        qty: g.qty,
      }));
      const res = await apiPost<CheckoutProcessResponse>("/checkout/process", {
        domain,
        items,
        customer_name: customerName.trim(),
        customer_email: customerEmail.trim(),
        customer_phone: customerPhone,
        customer_document: customerDocument,
        payment_method: paymentMethod,
      });

      if (res.status === "paid") {
        setOrderPaid(true);
      } else if (res.pix_qrcode) {
        setPixQrCode(res.pix_qrcode);
        setPixCopiaCola(res.pix_copia_cola ?? "");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao processar pagamento.");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a1a] text-white">
        <div className="animate-pulse text-lg">Carregando...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a1a] p-4 text-center text-white">
        <div>
          <h2 className="text-xl font-bold">Checkout indisponível</h2>
          <p className="mt-2 text-sm opacity-60">
            {error ?? "Nenhum produto encontrado."}
          </p>
        </div>
      </div>
    );
  }

  const { store } = data;
  const settings = store.settings || {};
  const isDark = settings.dark_mode ?? true;
  const primary = settings.primary_color || "#6366f1";

  const bgBase = isDark ? "#0a0a1a" : "#f3f4f6";
  const cardBg = isDark ? "rgba(255,255,255,0.06)" : "#ffffff";
  const textColor = isDark ? "#ffffff" : "#1f2937";
  const mutedText = isDark ? "rgba(255,255,255,0.55)" : "#6b7280";
  const inputBg = isDark ? "rgba(0,0,0,0.25)" : "#f9fafb";
  const borderColor = isDark ? "rgba(255,255,255,0.1)" : "#e5e7eb";

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 16px",
    borderRadius: 8,
    border: `1px solid ${borderColor}`,
    background: inputBg,
    color: textColor,
    outline: "none",
    fontSize: "0.95rem",
  };

  const displayTotal = groupedItems.reduce(
    (sum, g) => sum + Number(g.product.price) * g.qty,
    0
  );

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ background: bgBase, color: textColor }}
    >
      <header
        className="flex items-center gap-3 px-6 py-4"
        style={{ background: primary, color: "#fff" }}
      >
        {settings.logo_url && (
          <img
            src={settings.logo_url}
            alt=""
            className="h-8 rounded object-contain"
          />
        )}
        <h1 className="text-lg font-bold">{store.name}</h1>
        <span className="ml-auto flex items-center gap-1 text-xs opacity-80">
          🔒 Ambiente seguro
        </span>
      </header>

      {settings.banner_url && (
        <img
          src={settings.banner_url}
          alt=""
          className="w-full object-cover"
          style={{ maxHeight: 200 }}
        />
      )}

      {orderPaid ? (
        <div className="flex flex-1 items-center justify-center p-8">
          <div
            className="rounded-xl p-10 text-center"
            style={{ background: cardBg, border: `1px solid ${borderColor}` }}
          >
            <div
              className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
              style={{ background: primary }}
            >
              <svg
                className="h-8 w-8 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold">Pagamento confirmado!</h2>
            <p className="mt-2 text-sm" style={{ color: mutedText }}>
              Obrigado pela sua compra. Você receberá um e-mail com os detalhes.
            </p>
          </div>
        </div>
      ) : (
        <main className="mx-auto flex w-full max-w-5xl flex-1 gap-8 p-8 md:flex-row flex-col">
          <div className="flex-1">
            <div
              className="rounded-xl p-8"
              style={{ background: cardBg, border: `1px solid ${borderColor}` }}
            >
              <h2 className="mb-6 text-lg font-bold">1. Dados de Contato</h2>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Nome Completo *"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  style={inputStyle}
                />
                <input
                  type="email"
                  placeholder="E-mail *"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  style={inputStyle}
                />
                <input
                  type="tel"
                  placeholder="WhatsApp"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  style={inputStyle}
                />
                <input
                  type="text"
                  placeholder="CPF (opcional)"
                  value={customerDocument}
                  onChange={(e) => setCustomerDocument(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <h2 className="mb-4 mt-8 text-lg font-bold">2. Pagamento</h2>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setPaymentMethod("pix");
                    setPixQrCode(null);
                    setPixCopiaCola(null);
                  }}
                  style={{
                    flex: 1,
                    padding: "14px",
                    borderRadius: 8,
                    border: `2px solid ${
                      paymentMethod === "pix" ? primary : borderColor
                    }`,
                    background: paymentMethod === "pix" ? primary : "transparent",
                    color: paymentMethod === "pix" ? "#fff" : textColor,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontSize: "0.95rem",
                  }}
                >
                  📱 PIX
                </button>
                <button
                  onClick={() => {
                    setPaymentMethod("credit_card");
                    setPixQrCode(null);
                    setPixCopiaCola(null);
                  }}
                  style={{
                    flex: 1,
                    padding: "14px",
                    borderRadius: 8,
                    border: `2px solid ${
                      paymentMethod === "credit_card" ? primary : borderColor
                    }`,
                    background:
                      paymentMethod === "credit_card" ? primary : "transparent",
                    color: paymentMethod === "credit_card" ? "#fff" : textColor,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontSize: "0.95rem",
                  }}
                >
                  💳 Cartão
                </button>
              </div>

              {pixQrCode && (
                <div
                  className="mt-6 rounded-lg p-4"
                  style={{ background: inputBg }}
                >
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
                onClick={handlePayment}
                disabled={processing || !!pixQrCode}
                style={{
                  width: "100%",
                  marginTop: 24,
                  padding: "16px",
                  borderRadius: 8,
                  border: "none",
                  background: primary,
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: "1.05rem",
                  cursor: processing || pixQrCode ? "not-allowed" : "pointer",
                  opacity: processing || pixQrCode ? 0.7 : 1,
                }}
              >
                {processing
                  ? "Processando..."
                  : pixQrCode
                    ? "Aguardando pagamento..."
                    : (settings.button_text || "Finalizar Compra")}
              </button>
            </div>
          </div>

          <div className="w-full md:w-[340px]">
            <div
              className="rounded-xl p-8"
              style={{ background: cardBg, border: `1px solid ${borderColor}` }}
            >
              <h2 className="mb-6 text-lg font-bold">Resumo do Pedido</h2>

              <div className="space-y-3">
                {groupedItems.map((g) => (
                  <div
                    key={g.product.id}
                    className="flex items-center gap-3 pb-3"
                    style={{ borderBottom: `1px solid ${borderColor}` }}
                  >
                    {g.product.image_url ? (
                      <img
                        src={g.product.image_url}
                        alt={g.product.name}
                        className="h-12 w-12 rounded-lg object-cover"
                      />
                    ) : (
                      <div
                        className="flex h-12 w-12 items-center justify-center rounded-lg"
                        style={{ background: inputBg }}
                      >
                        <svg
                          className="h-5 w-5"
                          style={{ color: mutedText }}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                          />
                        </svg>
                      </div>
                    )}
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold">{g.product.name}</h3>
                      <p style={{ color: mutedText }} className="text-xs">
                        {g.qty > 1 ? `${g.qty}× ` : ""}
                        {formatCurrency(Number(g.product.price))}
                      </p>
                    </div>
                    <span className="text-sm font-medium">
                      {formatCurrency(Number(g.product.price) * g.qty)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-4 space-y-2" style={{ color: mutedText }}>
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>{formatCurrency(displayTotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Frete</span>
                  <span>Grátis</span>
                </div>
              </div>
              <div
                className="mt-4 flex justify-between text-lg font-bold"
                style={{ borderTop: `1px solid ${borderColor}`, paddingTop: 16 }}
              >
                <span>Total</span>
                <span style={{ color: primary }}>
                  {formatCurrency(displayTotal)}
                </span>
              </div>
            </div>
          </div>
        </main>
      )}

      <footer
        className="px-6 py-3 text-center text-xs"
        style={{ color: mutedText, background: cardBg }}
      >
        Checkout PRO — Pagamento seguro
      </footer>
    </div>
  );
}