"use client";

import { Suspense, useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { apiGet, apiPost } from "@/lib/api";
import {
  CheckoutData,
  CheckoutProcessResponse,
  CheckoutProduct,
  ShippingAddress,
  CardData,
} from "@/types";
import StepDados from "@/components/StepDados";
import StepEntrega from "@/components/StepEntrega";
import StepPagamento from "@/components/StepPagamento";
import OrderSummary, { GroupedItem } from "@/components/OrderSummary";
import Footer from "@/components/Footer";

type StepId = "dados" | "entrega" | "pagamento";

function groupProductsByIds(
  products: CheckoutProduct[],
  ids: number[]
): GroupedItem[] {
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
  const isPreview = searchParams.get("preview") === "1";
  const productsParam = isPreview ? "1,2" : searchParams.get("products") ?? "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CheckoutData | null>(null);
  // Overrides applied em tempo real pelo editor do dashboard via postMessage.
  const [liveSettings, setLiveSettings] = useState<Partial<CheckoutData["store"]["settings"]>>({});
  const [processing, setProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"pix" | "credit_card">("credit_card");

  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerDocument, setCustomerDocument] = useState("");

  const [address, setAddress] = useState<ShippingAddress>({
    cep: "",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    uf: "",
  });

  const [card, setCard] = useState<CardData>({
    number: "",
    expiry: "",
    cvv: "",
    holder: "",
    holder_document: "",
    installments: 1,
  });

  const [step, setStep] = useState<StepId>("dados");
  const [completed, setCompleted] = useState<StepId[]>([]);

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
        const endpoint = isPreview
          ? `/checkout/preview?domain=${encodeURIComponent(domain)}`
          : `/checkout?domain=${encodeURIComponent(domain)}&product_ids=${encodeURIComponent(productsParam)}`;
        const res = await apiGet<CheckoutData>(endpoint);
        setData(res);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar checkout.");
      } finally {
        setLoading(false);
      }
    };
    fetchCheckout();
  }, [productsParam, getStoreIdentifier, isPreview]);

  // Recebe atualizações de personalização em tempo real do editor do dashboard.
  useEffect(() => {
    if (!isPreview) return;
    const handler = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== "object") return;
      if (event.data.type !== "checkout:settings") return;
      setLiveSettings(event.data.settings ?? {});
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [isPreview]);

  // Aplica as settings (persistidas + overrides ao vivo) nas CSS vars do checkout.
  const effectiveSettings = useMemo(
    () => ({ ...data?.store.settings, ...liveSettings }),
    [data?.store.settings, liveSettings]
  );

  useEffect(() => {
    const root = document.documentElement;
    const s = effectiveSettings;
    if (!s) return;

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
  }, [effectiveSettings]);

  const groupedItems: GroupedItem[] = data
    ? groupProductsByIds(
        data.products,
        productsParam
          .split(",")
          .map((s) => parseInt(s.trim(), 10))
          .filter((n) => !isNaN(n))
      )
    : [];

  const markCompleted = (s: StepId) => {
    setCompleted((prev) => (prev.includes(s) ? prev : [...prev, s]));
  };

  const handleDadosContinue = () => {
    markCompleted("dados");
    setStep("entrega");
  };

  const handleEntregaContinue = () => {
    markCompleted("entrega");
    setStep("pagamento");
  };

  const handleEditStep = (s: StepId) => {
    setStep(s);
  };

  const handlePayment = async () => {
    if (!data || groupedItems.length === 0) return;
    if (!customerName.trim() || !customerEmail.trim()) {
      alert("Preencha nome e e-mail.");
      setStep("dados");
      return;
    }

    if (isPreview) {
      alert("Modo de visualização: o pagamento não é processado no editor.");
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
        shipping_address: address,
      });

      if (res.status === "paid") {
        setOrderPaid(true);
      } else if (res.pix_qrcode) {
        setPixQrCode(res.pix_qrcode);
        setPixCopiaCola(res.pix_copia_cola ?? "");
        markCompleted("pagamento");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao processar pagamento.");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        display: "flex",
        minHeight: "100vh",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--checkout-bg)",
      }}>
        <div style={{ fontSize: "1.1rem", opacity: 0.6 }}>Carregando...</div>
      </div>
    );
  }

  if (error || !data) {
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
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700 }}>Checkout indisponível</h2>
          <p style={{ marginTop: 8, fontSize: "0.9rem", color: "var(--text-muted)" }}>
            {error ?? "Nenhum produto encontrado."}
          </p>
        </div>
      </div>
    );
  }

  const { store } = data;
  const settings = effectiveSettings;

  const displayTotal = groupedItems.reduce(
    (sum, g) => sum + Number(g.product.price) * g.qty,
    0
  );

  const discountPct = paymentMethod === "pix" ? 1 : 5;
  const discountValue = displayTotal * (discountPct / 100);

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "var(--checkout-bg)" }}>
      {/* ─── Header ─── */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 32px",
          background: "var(--card-bg)",
          borderBottom: "1px solid var(--border-color)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {settings.logo_url && (
            <img
              src={settings.logo_url}
              alt=""
              style={{ height: 32, borderRadius: 4, objectFit: "contain" }}
            />
          )}
          <h1 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary)" }}>
            {store.name}
          </h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--text-secondary)" }}>
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <div style={{ textAlign: "right", lineHeight: 1.2 }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-primary)", letterSpacing: 0.5 }}>PAGAMENTO</div>
            <div style={{ fontSize: "0.65rem", fontWeight: 600, color: "var(--text-secondary)" }}>100% SEGURO</div>
          </div>
        </div>
      </header>

      {/* ─── Banner Message ─── */}
      <div
        style={{
          background: "var(--header-banner-bg)",
          color: "var(--header-banner-text)",
          textAlign: "center",
          padding: "8px 16px",
          fontSize: "0.85rem",
          fontWeight: 500,
        }}
      >
        {settings.banner_message || "Digite aqui a mensagem"}
      </div>

      {/* ─── Order Paid Success ─── */}
      {orderPaid ? (
        <div style={{
          display: "flex",
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: 32,
        }}>
          <div
            style={{
              background: "var(--card-bg)",
              border: "1px solid var(--border-color)",
              borderRadius: 16,
              padding: 48,
              textAlign: "center",
              maxWidth: 480,
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: "var(--green-primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
              }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Pagamento confirmado!</h2>
            <p style={{ marginTop: 8, fontSize: "0.9rem", color: "var(--text-muted)" }}>
              Obrigado pela sua compra. Você receberá um e-mail com os detalhes.
            </p>
          </div>
        </div>
      ) : (
        /* ─── Main 3-Column Layout ─── */
        <main
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 340px",
            gap: 24,
            maxWidth: 1200,
            width: "100%",
            margin: "0 auto",
            padding: "32px 24px",
            flex: 1,
          }}
          className="checkout-main"
        >
          {/* ─── Column 1: Identificação + Entrega ─── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <StepDados
              name={customerName}
              email={customerEmail}
              phone={customerPhone}
              document={customerDocument}
              setName={setCustomerName}
              setEmail={setCustomerEmail}
              setPhone={setCustomerPhone}
              setDocument={setCustomerDocument}
              onContinue={handleDadosContinue}
              onEdit={() => handleEditStep("dados")}
              isActive={step === "dados"}
              isCompleted={completed.includes("dados")}
            />

            <StepEntrega
              address={address}
              setAddress={setAddress}
              onContinue={handleEntregaContinue}
              onEdit={() => handleEditStep("entrega")}
              isActive={step === "entrega"}
              isCompleted={completed.includes("entrega")}
            />
          </div>

          {/* ─── Column 2: Pagamento ─── */}
          <div>
            <StepPagamento
              paymentMethod={paymentMethod}
              setPaymentMethod={setPaymentMethod}
              card={card}
              setCard={setCard}
              onFinalize={handlePayment}
              processing={processing}
              awaitingPix={Boolean(pixQrCode)}
              pixQrCode={pixQrCode}
              pixCopiaCola={pixCopiaCola}
              buttonText={settings.button_text || "Finalizar Compra"}
              isActive={step === "pagamento"}
              total={displayTotal}
            />
          </div>

          {/* ─── Column 3: Order Summary ─── */}
          <div style={{ position: "sticky", top: 24, alignSelf: "start" }}>
            <div
              style={{
                background: "var(--card-bg)",
                border: "1px solid var(--border-color)",
                borderRadius: 12,
                padding: 24,
              }}
            >
              <OrderSummary
                items={groupedItems}
                total={displayTotal}
                discount={step === "pagamento" ? discountValue : 0}
              />
            </div>
          </div>
        </main>
      )}

      <Footer />

      {/* ─── Responsive Styles ─── */}
      <style>{`
        @media (max-width: 1024px) {
          .checkout-main {
            grid-template-columns: 1fr 1fr !important;
          }
          .checkout-main > div:last-child {
            grid-column: 1 / -1;
            position: static !important;
          }
        }
        @media (max-width: 768px) {
          .checkout-main {
            grid-template-columns: 1fr !important;
            padding: 16px !important;
            gap: 16px !important;
          }
          .checkout-main > div:last-child {
            position: static !important;
          }
        }
      `}</style>
    </div>
  );
}