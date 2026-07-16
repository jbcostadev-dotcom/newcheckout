"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { apiGet, apiPost } from "@/lib/api";
import {
  CheckoutData,
  CheckoutProcessResponse,
  CheckoutProduct,
  ShippingAddress,
  CardData,
} from "@/types";
import Stepper, { StepId } from "@/components/Stepper";
import StepDados from "@/components/StepDados";
import StepEntrega from "@/components/StepEntrega";
import StepPagamento from "@/components/StepPagamento";
import OrderSummary, { GroupedItem } from "@/components/OrderSummary";
import Footer from "@/components/Footer";

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
  const [paymentMethod, setPaymentMethod] = useState<"pix" | "credit_card">(
    "pix"
  );

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

  const groupedItems: GroupedItem[] = data
    ? groupProductsByIds(
        data.products,
        productsParam
          .split(",")
          .map((s) => parseInt(s.trim(), 10))
          .filter((n) => !isNaN(n))
      )
    : [];

  const goToStep = (s: StepId) => setStep(s);

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

  const handleJump = (s: StepId) => {
    if (completed.includes(s) || s === step) setStep(s);
  };

  const handlePayment = async () => {
    if (!data || groupedItems.length === 0) return;
    if (!customerName.trim() || !customerEmail.trim()) {
      alert("Preencha nome e e-mail.");
      setStep("dados");
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
              <Stepper
                current={step}
                completed={completed}
                onJump={handleJump}
                primary={primary}
                textColor={textColor}
                mutedText={mutedText}
                borderColor={borderColor}
              />

              {step === "dados" && (
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
                  primary={primary}
                  textColor={textColor}
                  mutedText={mutedText}
                  inputStyle={inputStyle}
                  borderColor={borderColor}
                />
              )}

              {step === "entrega" && (
                <StepEntrega
                  address={address}
                  setAddress={setAddress}
                  onContinue={handleEntregaContinue}
                  primary={primary}
                  textColor={textColor}
                  mutedText={mutedText}
                  inputStyle={inputStyle}
                  borderColor={borderColor}
                />
              )}

              {step === "pagamento" && (
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
                  primary={primary}
                  textColor={textColor}
                  inputStyle={inputStyle}
                  borderColor={borderColor}
                  inputBg={inputBg}
                  buttonText={settings.button_text || "Finalizar Compra"}
                />
              )}
            </div>
          </div>

          <div className="w-full md:w-[340px]">
            <div
              className="sticky top-4 rounded-xl p-8"
              style={{
                background: cardBg,
                border: `1px solid ${borderColor}`,
              }}
            >
              <OrderSummary
                items={groupedItems}
                total={displayTotal}
                primary={primary}
                mutedText={mutedText}
                borderColor={borderColor}
                inputBg={inputBg}
              />
            </div>
          </div>
        </main>
      )}

      <Footer
        mutedText={mutedText}
        cardBg={cardBg}
        borderColor={borderColor}
      />
    </div>
  );
}