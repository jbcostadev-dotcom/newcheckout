"use client";

import { Suspense, useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { apiGet, apiPost } from "@/lib/api";
import { useFastSoft } from "@/lib/useFastSoft";
import {
  CheckoutData,
  CheckoutProcessResponse,
  CheckoutProduct,
  ShippingAddress,
  ShippingMethod,
  CardData,
} from "@/types";
import StepDados from "@/components/StepDados";
import StepEntrega from "@/components/StepEntrega";
import StepPagamento from "@/components/StepPagamento";
import OrderSummary, { GroupedItem } from "@/components/OrderSummary";
import SocialProofs from "@/components/SocialProofs";
import Footer from "@/components/Footer";
import ScarcityBar from "@/components/ScarcityBar";

type StepId = "dados" | "entrega" | "pagamento";

/**
 * Heurística simples para identificar a bandeira do cartão a partir do BIN.
 * Útil apenas para exibir; a Unipay retorna a brand oficial no webhook.
 */
function guessCardBrand(number: string): string | null {
  const n = number.replace(/\D+/g, "");
  if (!n) return null;
  if (/^4/.test(n)) return "VISA";
  if (/^(5[1-5]|2[2-7])/.test(n)) return "MASTERCARD";
  if (/^(4011|4312|4389|4514|4576|5041|5066|5067|509|6277|6362|6363|650|6516|6550)/.test(n)) return "ELO";
  if (/^3[47]/.test(n)) return "AMEX";
  if (/^(606282|3841)/.test(n)) return "HIPERCARD";
  return null;
}

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const storeSlug = params.store as string;
  const isPreview = searchParams.get("preview") === "1";
  const productsParam = isPreview ? "1,2" : searchParams.get("products") ?? "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CheckoutData | null>(null);
  const [liveSettings, setLiveSettings] = useState<Partial<CheckoutData["store"]["settings"]>>({});
  const [processing, setProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"pix" | "credit_card" | "boleto">("credit_card");
  const [sdkError, setSdkError] = useState<string | null>(null);

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

  const [selectedShippingMethod, setSelectedShippingMethod] = useState<ShippingMethod | null>(null);

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

  const [orderPaid, setOrderPaid] = useState(false);

  // Chave pública da Unipay (pk_live_*) vinda do backend (gateways unipay).
  const unipayPublicKey = useMemo(() => {
    const gw = data?.store.gateways?.find((g) => g.provider === "unipay");
    return gw?.public_key ?? null;
  }, [data]);

  const fastSoft = useFastSoft(unipayPublicKey);
  useEffect(() => {
    setSdkError(fastSoft.error);
  }, [fastSoft.error]);

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

  const subtotal = groupedItems.reduce(
    (sum, g) => sum + Number(g.product.price) * g.qty,
    0
  );

  const shippingPrice = useMemo(() => {
    if (!selectedShippingMethod) return 0;
    if (
      selectedShippingMethod.price === null ||
      selectedShippingMethod.price === undefined
    ) {
      return 0;
    }
    if (
      selectedShippingMethod.min_value_free_shipping !== null &&
      selectedShippingMethod.min_value_free_shipping !== undefined &&
      subtotal >= selectedShippingMethod.min_value_free_shipping
    ) {
      return 0;
    }
    return selectedShippingMethod.price;
  }, [selectedShippingMethod, subtotal]);

  const displayTotal = subtotal + shippingPrice;

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

    if (data?.shipping_methods && data.shipping_methods.length > 0 && !selectedShippingMethod) {
      alert("Selecione uma forma de frete.");
      setStep("entrega");
      return;
    }

      // Pré-calcula descontos para aplicá-los no payload (checkout já exibe preço com desconto).
      const methodDiscountPct = paymentMethod === "pix" ? 1 : paymentMethod === "credit_card" ? 5 : 0;
      const finalAmount = displayTotal * (1 - methodDiscountPct / 100);

      // A API calcula o total a partir dos itens + frete (sem desconto por método).
      // Para honrar o desconto exibido, repassamos como redução proporcional via
      // metadata; o backend hoje ignora. Fluxo atual: API decide total sozinha.
      void finalAmount;

      if (isPreview) {
        if (paymentMethod === "pix" || paymentMethod === "boleto") {
          try {
            sessionStorage.setItem(
              "pix_page_settings",
              JSON.stringify({
                logo_url: data?.store.settings.logo_url,
                header_store_name_visible: data?.store.settings.header_store_name_visible,
                header_secure_badge: data?.store.settings.header_secure_badge,
                header_logo_alignment: data?.store.settings.header_logo_alignment,
                header_bg_color: data?.store.settings.header_bg_color,
                header_icon_color: data?.store.settings.header_icon_color,
                primary_color: data?.store.settings.primary_color,
                dark_mode: data?.store.settings.dark_mode,
                font_family: data?.store.settings.font_family,
                font_size_base: data?.store.settings.font_size_base,
              })
            );
          } catch {
            // ignore storage errors
          }
          markCompleted("pagamento");
          const dest =
            paymentMethod === "boleto"
              ? `/${storeSlug}/boleto/preview?preview=1`
              : `/${storeSlug}/pix/preview?preview=1`;
          router.push(dest);
        } else {
          alert("Modo de visualização: o pagamento não é processado no editor.");
        }
        return;
      }

    // Cartão exige SDK + tokenização (com 3DS opcional).
    let cardToken: string | null = null;
    let cardBrand: string | null = null;
    let cardLast4: string | null = null;
    let installments = card.installments;

    if (paymentMethod === "credit_card") {
      if (!fastSoft.ready || !fastSoft.tokenizeWith3DS) {
        alert(sdkError ?? "SDK de pagamento ainda carregando. Tente novamente em instantes.");
        return;
      }

      // Converte expirar "MM/AA" → expMonth/expYear(4 dígitos).
      const [mm, yy] = card.expiry.split("/");
      const expMonth = (mm ?? "").trim();
      const expYear = yy && yy.length === 2 ? `20${yy}` : (yy ?? "").trim();
      const digitsOnly = card.number.replace(/\D+/g, "");

      if (digitsOnly.length < 13 || expMonth.length !== 2 || expYear.length !== 4 || card.cvv.length < 3 || card.holder.trim().length < 3) {
        alert("Verifique os dados do cartão.");
        return;
      }

      cardLast4 = digitsOnly.slice(-4) || null;
      cardBrand = guessCardBrand(digitsOnly);

      try {
        const token = await fastSoft.tokenizeWith3DS(
          {
            number: digitsOnly,
            holderName: card.holder.trim().toUpperCase(),
            expMonth,
            expYear,
            cvv: card.cvv,
          },
          {
            transaction: {
              amount: Math.round(displayTotal * 100), // centavos
              currency: "BRL",
              installments,
            },
            auth: {
              customer: {
                name: customerName.trim(),
                email: customerEmail.trim(),
                phoneNumber: customerPhone?.replace(/\D+/g, "") ?? "",
              },
              address: {
                street: address.logradouro || "",
                streetNumber: address.numero || "",
                complement: address.complemento || "",
                zipCode: address.cep?.replace(/\D+/g, "") || "",
                neighborhood: address.bairro || "",
                city: address.cidade || "",
                state: address.uf || "",
                country: "BR",
              },
            },
          }
        );
        cardToken = token;
      } catch (err) {
        alert(
          err instanceof Error
            ? `Erro na tokenização do cartão: ${err.message}`
            : "Erro na tokenização do cartão."
        );
        return;
      }
    }

    setProcessing(true);
    try {
      const domain = getStoreIdentifier();
      const items = groupedItems.map((g) => ({
        product_id: g.product.id,
        qty: g.qty,
      }));
      const payload: Record<string, unknown> = {
        domain,
        items,
        customer_name: customerName.trim(),
        customer_email: customerEmail.trim(),
        customer_phone: customerPhone,
        customer_document: customerDocument,
        payment_method: paymentMethod,
        shipping_method_id: selectedShippingMethod?.id ?? null,
        shipping_address: address,
      };
      if (paymentMethod === "credit_card" && cardToken) {
        payload.card_token = cardToken;
        payload.installments = installments;
        if (cardBrand) payload.card_brand = cardBrand;
        if (cardLast4) payload.card_last4 = cardLast4;
      }

      const res = await apiPost<CheckoutProcessResponse>("/checkout/process", payload);

      // Persiste settings visuais para reuso nas páginas de status.
      try {
        sessionStorage.setItem(
          "pix_page_settings",
          JSON.stringify({
            logo_url: data?.store.settings.logo_url,
            header_store_name_visible: data?.store.settings.header_store_name_visible,
            header_secure_badge: data?.store.settings.header_secure_badge,
            header_logo_alignment: data?.store.settings.header_logo_alignment,
            header_bg_color: data?.store.settings.header_bg_color,
            header_icon_color: data?.store.settings.header_icon_color,
            primary_color: data?.store.settings.primary_color,
            dark_mode: data?.store.settings.dark_mode,
            font_family: data?.store.settings.font_family,
            font_size_base: data?.store.settings.font_size_base,
          })
        );
      } catch {
        // ignore storage errors
      }

      // Status pagos imediatamente (cartão autorizado/pago).
      if (res.status === "paid" || res.status === "authorized") {
        setOrderPaid(true);
        return;
      }

      if (!res.order_id) {
        alert(res.message ?? "Não foi possível iniciar o pagamento.");
        return;
      }

      markCompleted("pagamento");
      switch (res.payment_method ?? paymentMethod) {
        case "boleto":
          router.push(`/${storeSlug}/boleto/${res.order_id}`);
          break;
        case "pix":
        default:
          router.push(`/${storeSlug}/pix/${res.order_id}`);
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

  const discountPct = paymentMethod === "pix" ? 1 : 5;
  const discountValue = displayTotal * (discountPct / 100);

  const bannerHeightPx =
    settings.banner_height === "sm" ? 60 : settings.banner_height === "lg" ? 160 : 100;

  const stepTitleSize = settings.step_title_font_size || "1.25rem";
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
      {(settings.header_store_name_visible ?? true) && !settings.logo_url && (
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary)" }}>
          {store.name}
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
        <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-primary)", letterSpacing: 0.5 }}>PAGAMENTO</div>
        <div style={{ fontSize: "0.65rem", fontWeight: 600, color: iconColor }}>100% SEGURO</div>
      </div>
    </div>
  ) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "var(--checkout-bg)", fontSize: settings.font_size_base || "16px" }}>
      {/* ─── Header ─── */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 32px",
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

      {/* ─── Announcement Bar ─── */}
      {(settings.announcement_bar_enabled ?? true) && (
        <div
          style={{
            background: settings.announcement_bar_bg || "#333333",
            color: settings.announcement_bar_text_color || "#d4a843",
            textAlign: "center",
            padding: "8px 16px",
            fontSize: "0.85rem",
            fontWeight: 500,
          }}
        >
          {settings.banner_message || "Digite aqui a mensagem"}
        </div>
      )}

      {/* ─── Banner Image ─── */}
      {settings.banner_url && (
        <div style={{ width: "100%", overflow: "hidden" }}>
          <img
            src={settings.banner_url}
            alt="Banner"
            style={{
              width: "100%",
              height: bannerHeightPx,
              objectFit: "cover",
              display: "block",
            }}
          />
        </div>
      )}

      {/* ── Scarcity Bar ─── */}
      {settings.scarcity_enabled && (
        <ScarcityBar
          type={(settings.scarcity_type as "countdown" | "stock" | "visitors") || "countdown"}
          text={settings.scarcity_text}
          countdownMinutes={settings.scarcity_countdown_minutes || 15}
        />
      )}

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
              titleFontSize={stepTitleSize}
            />

            <StepEntrega
              address={address}
              setAddress={setAddress}
              shippingMethods={data?.shipping_methods ?? []}
              subtotal={subtotal}
              selectedShippingMethod={selectedShippingMethod}
              setSelectedShippingMethod={setSelectedShippingMethod}
              onContinue={handleEntregaContinue}
              onEdit={() => handleEditStep("entrega")}
              isActive={step === "entrega"}
              isCompleted={completed.includes("entrega")}
              titleFontSize={stepTitleSize}
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
              awaitingPix={false}
              pixQrCode={null}
              pixCopiaCola={null}
              buttonText={settings.button_text || "Finalizar Compra"}
              isActive={step === "pagamento"}
              total={displayTotal}
              titleFontSize={stepTitleSize}
              sdkReady={fastSoft.ready}
              sdkError={sdkError}
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
                subtotal={subtotal}
                shipping={shippingPrice}
                total={displayTotal}
                discount={step === "pagamento" ? discountValue : 0}
                title={settings.summary_title || "Resumo do pedido"}
                showDiscount={settings.summary_show_discount ?? true}
                couponEnabled={settings.summary_coupon_enabled ?? true}
              />
            </div>
            {(effectiveSettings.social_proofs_enabled ?? true) && (
              <div className="desktop-social-proofs" style={{ marginTop: 24 }}>
                <SocialProofs reviews={data?.social_proofs} />
              </div>
            )}
          </div>
        </main>
      )}

      {!orderPaid && (effectiveSettings.social_proofs_enabled ?? true) && (
        <div className="mobile-social-proofs">
          <SocialProofs reviews={data?.social_proofs} />
        </div>
      )}

      <Footer
        footer_text={settings.footer_text}
        footer_show_cnpj={settings.footer_show_cnpj}
        footer_cnpj={settings.footer_cnpj}
      />

      {/* ─── Google Font Loader ─── */}
      {settings.font_family && settings.font_family !== "Inter" && (
        <link
          href={`https://fonts.googleapis.com/css2?family=${settings.font_family.replace(/ /g, "+")}:wght@300;400;500;600;700&display=swap`}
          rel="stylesheet"
        />
      )}

      {/* ─── Responsive Styles ─── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=${settings.font_family ? settings.font_family.replace(/ /g, "+") : "Inter"}:wght@300;400;500;600;700&display=swap');

        html {
          font-family: '${settings.font_family || "Inter"}', ui-sans-serif, system-ui, sans-serif;
        }

        .step-card-title {
          font-size: ${stepTitleSize} !important;
        }

        .desktop-social-proofs {
          display: block;
        }

        .mobile-social-proofs {
          display: none;
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 24px 32px 24px;
        }

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
            display: flex !important;
            flex-direction: column !important;
          }
          .checkout-main > div:last-child {
            position: static !important;
            order: -1 !important;
          }
          .desktop-social-proofs {
            display: none !important;
          }
          .mobile-social-proofs {
            display: block !important;
            padding: 0 16px 24px 16px !important;
          }
        }
      `}</style>
    </div>
  );
}
