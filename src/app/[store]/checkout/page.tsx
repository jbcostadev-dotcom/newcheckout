"use client";

import React, { Suspense, useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import type { ValidatedCoupon } from "@/types";
import ErrorModal from "@/components/ErrorModal";
import {
  cpfIsValid,
  cvvLengthForBrand,
  getCardBrand,
  isCardExpired,
  isValidLuhn,
  onlyDigits,
} from "@/lib/masks";
import type {
  CheckoutData,
  CheckoutProcessResponse,
  CheckoutProduct,
  ShippingAddress,
  ShippingMethod,
  CardData,
  InstallmentConfig,
  OrderBumpOffer,
} from "@/types";
import StepDados from "@/components/StepDados";
import StepEntrega from "@/components/StepEntrega";
import StepPagamento from "@/components/StepPagamento";
import OrderSummary, { GroupedItem } from "@/components/OrderSummary";
import SocialProofs from "@/components/SocialProofs";
import Footer from "@/components/Footer";
import ScarcityBar from "@/components/ScarcityBar";

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

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // Determine which payment methods are enabled based on API response.
  const enabledMethods = useMemo(() => {
    const pm = data?.store.payment_methods;
    if (!pm) return { pix: true, card: true, boleto: true }; // backwards compat
    return {
      pix: pm.pix?.enabled ?? true,
      card: pm.card?.enabled ?? true,
      boleto: pm.boleto?.enabled ?? false,
    };
  }, [data]);

  const installmentConfig = useMemo((): InstallmentConfig | undefined => {
    const pm = data?.store.payment_methods;
    return pm?.card?.installment_config ?? undefined;
  }, [data]);

  const [hasAutoSelected, setHasAutoSelected] = useState(false);
  useEffect(() => {
    if (!data || hasAutoSelected) return;
    setHasAutoSelected(true);
    const preSelected = installmentConfig?.pre_selected ?? 1;
    setCard((prev) => ({ ...prev, installments: preSelected }));

    const configured = data.store.settings.default_payment_method ?? "credit_card";
    const desired: "pix" | "credit_card" | "boleto" =
      configured === "pix" ? "pix" : configured === "boleto" ? "boleto" : "credit_card";

    if (desired === "pix" && enabledMethods.pix) {
      setPaymentMethod("pix");
    } else if (desired === "boleto" && enabledMethods.boleto) {
      setPaymentMethod("boleto");
    } else if (enabledMethods.card) {
      setPaymentMethod("credit_card");
    } else if (enabledMethods.pix) {
      setPaymentMethod("pix");
    } else if (enabledMethods.boleto) {
      setPaymentMethod("boleto");
    }
  }, [data, enabledMethods, hasAutoSelected, installmentConfig]);

  // Atualiza pré-seleção ao vivo no modo preview
  useEffect(() => {
    if (!isPreview) return;
    const configured = liveSettings.default_payment_method;
    if (!configured) return;
    const desired: "pix" | "credit_card" | "boleto" =
      configured === "pix" ? "pix" : configured === "boleto" ? "boleto" : "credit_card";
    if (desired === "pix" && enabledMethods.pix) {
      setPaymentMethod("pix");
    } else if (desired === "boleto" && enabledMethods.boleto) {
      setPaymentMethod("boleto");
    } else if (desired === "credit_card" && enabledMethods.card) {
      setPaymentMethod("credit_card");
    }
  }, [isPreview, liveSettings?.default_payment_method, enabledMethods]);

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

  const [selectedOrderBumpId, setSelectedOrderBumpId] = useState<number | null>(null);

  const [appliedCoupon, setAppliedCoupon] = useState<ValidatedCoupon | null>(null);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);

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

  const [modalCardRefused, setModalCardRefused] = useState(false);
  const [modalCardLimit, setModalCardLimit] = useState(false);

  // Resolve public key for the card gateway from payment_methods.
  // Falls back to legacy gateways lookup for backwards compatibility.


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
        if (process.env.NODE_ENV === "development") {
          // eslint-disable-next-line no-console
          console.log("[checkout] order_bumps:", res.order_bumps);
        }
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

  // ── Order Bumps ────────────────────────────────────────────────
  // Filtra os bumps aplicáveis à forma de pagamento selecionada.
  const visibleOrderBumps: OrderBumpOffer[] = useMemo(() => {
    if (!data?.order_bumps) return [];

    const pmKey = paymentMethod; // "pix" | "credit_card" | "boleto"
    return data.order_bumps.filter((bump) => {
      if (pmKey === "credit_card" && !bump.show_credit_card) return false;
      if (pmKey === "pix" && !bump.show_pix) return false;
      if (pmKey === "boleto" && !bump.show_boleto) return false;
      return true;
    });
  }, [data?.order_bumps, paymentMethod]);

  const selectedOrderBump: OrderBumpOffer | null = useMemo(() => {
    if (selectedOrderBumpId === null) return null;
    return visibleOrderBumps.find((b) => b.id === selectedOrderBumpId) ?? null;
  }, [visibleOrderBumps, selectedOrderBumpId]);

  // Se o bump selecionado não for mais visível (troca de pagamento),
  // limpa a seleção automaticamente.
  useEffect(() => {
    if (selectedOrderBumpId !== null && !selectedOrderBump) {
      setSelectedOrderBumpId(null);
    }
  }, [selectedOrderBumpId, selectedOrderBump]);

  const orderBumpPrice = selectedOrderBump
    ? Number(selectedOrderBump.product.bump_price) || 0
    : 0;

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
    if (
      appliedCoupon?.coupon.free_shipping &&
      appliedCoupon.coupon.shipping_method_id === selectedShippingMethod.id
    ) {
      return 0;
    }
    return selectedShippingMethod.price;
  }, [selectedShippingMethod, subtotal, appliedCoupon]);

  const subtotalWithBump = subtotal + orderBumpPrice;

  const displayTotal = subtotalWithBump + shippingPrice - couponDiscount;

  // Itens exibidos no resumo pedidos: produtos normais + order bump selecionado.
  const summaryItems: GroupedItem[] = useMemo(() => {
    if (!selectedOrderBump) return groupedItems;
    const bumpProduct = {
      ...selectedOrderBump.product,
      price: selectedOrderBump.product.bump_price,
    };
    return [...groupedItems, { product: bumpProduct, qty: 1 }];
  }, [groupedItems, selectedOrderBump]);

  const markCompleted = (s: StepId) => {
    setCompleted((prev) => (prev.includes(s) ? prev : [...prev, s]));
  };

  // Registra o cliente no backend (e sincroniza com a Shopify quando a loja
  // estiver conectada). Fire-and-forget — não bloqueia o fluxo do checkout.
  const registerCustomer = useCallback(() => {
    const domain = getStoreIdentifier();
    const name = customerName.trim();
    const email = customerEmail.trim();
    const phone = customerPhone;
    const document = customerDocument;

    if (name.length < 3 || !email) return;

    try {
      apiPost("/checkout/customer", {
        domain,
        name,
        email,
        phone,
        document,
      }).catch(() => {
        /* ignore: best-effort */
      });
    } catch {
      /* ignore */
    }
  }, [customerName, customerEmail, customerPhone, customerDocument, getStoreIdentifier]);

  // Atualiza o endereço do cliente no backend e na Shopify (best-effort).
  const updateCustomerAddress = useCallback(() => {
    const domain = getStoreIdentifier();
    const email = customerEmail.trim();
    if (!email || !address.cep) return;

    try {
      apiPost("/checkout/customer/address", {
        domain,
        email,
        address: {
          cep: address.cep,
          logradouro: address.logradouro,
          numero: address.numero,
          complemento: address.complemento,
          bairro: address.bairro,
          cidade: address.cidade,
          uf: address.uf,
        },
      }).catch(() => {
        /* ignore: best-effort */
      });
    } catch {
      /* ignore */
    }
  }, [customerEmail, address, getStoreIdentifier]);

  // Rastreia o carrinho abandonado no backend (best-effort).
  const trackAbandonedCart = useCallback(
    (
      step: "dados" | "entrega" | "pagamento" | "pagamento_tentado",
      extra?: {
        payment_method?: "pix" | "credit_card" | "boleto";
        abandoned_reason?:
          | "left_dados"
          | "left_entrega"
          | "left_pagamento"
          | "card_refused"
          | "pix_expired"
          | "boleto_expired";
        card_brand?: string | null;
        card_last4?: string | null;
      }
    ) => {
      const domain = getStoreIdentifier();
      const email = customerEmail.trim();
      const name = customerName.trim();
      if (!email || name.length < 3 || groupedItems.length === 0) return;

      const payload: Record<string, unknown> = {
        domain,
        step_reached: step,
        customer_name: name,
        customer_email: email,
        customer_phone: customerPhone || null,
        customer_document: customerDocument || null,
        items: groupedItems.map((g) => ({
          product_id: g.product.id,
          name: g.product.name,
          qty: g.qty,
          unit_price: Number(g.product.price),
        })),
        subtotal,
        total: displayTotal,
      };

      if (step !== "dados" && address.cep) {
        payload.shipping_address = {
          cep: address.cep,
          logradouro: address.logradouro,
          numero: address.numero,
          complemento: address.complemento,
          bairro: address.bairro,
          cidade: address.cidade,
          uf: address.uf,
        };
      }

      if (selectedShippingMethod) {
        payload.shipping_method_id = selectedShippingMethod.id;
      }

      if (extra?.payment_method) {
        payload.payment_method = extra.payment_method;
      }
      if (extra?.abandoned_reason) {
        payload.abandoned_reason = extra.abandoned_reason;
      }
      if (extra?.card_brand) {
        payload.card_brand = extra.card_brand;
      }
      if (extra?.card_last4) {
        payload.card_last4 = extra.card_last4;
      }

      try {
        apiPost("/checkout/abandoned-cart", payload).catch(() => {
          /* ignore: best-effort */
        });
      } catch {
        /* ignore */
      }
    },
    [
      customerName,
      customerEmail,
      customerPhone,
      customerDocument,
      groupedItems,
      subtotal,
      displayTotal,
      address,
      selectedShippingMethod,
      getStoreIdentifier,
    ]
  );

  const handleDadosContinue = () => {
    registerCustomer();
    trackAbandonedCart("dados");
    markCompleted("dados");
    setStep("entrega");
  };

  const handleEntregaContinue = () => {
    updateCustomerAddress();
    trackAbandonedCart("entrega");
    markCompleted("entrega");
    setStep("pagamento");
  };

  const handleEditStep = (s: StepId) => {
    setStep(s);
  };

  // Rastreia quando o cliente alcança a etapa de pagamento.
  useEffect(() => {
    if (step === "pagamento") {
      trackAbandonedCart("pagamento", { payment_method: paymentMethod });
    }
  }, [step, paymentMethod, trackAbandonedCart]);

  const handleApplyCoupon = async (code: string) => {
    if (!data) return;
    setApplyingCoupon(true);
    setCouponError(null);
    try {
      const domain = getStoreIdentifier();
      const productIds = productsParam
        .split(",")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n))
        .join(",");
      const res = await apiGet<ValidatedCoupon>(
        `/checkout/coupon?domain=${encodeURIComponent(domain)}&product_ids=${encodeURIComponent(productIds)}&code=${encodeURIComponent(code)}`
      );
      setAppliedCoupon(res);

      const base = subtotalWithBump + shippingPrice;
      let discount = 0;
      if (res.coupon.discount_type === "percent") {
        discount = base * (res.coupon.discount_value / 100);
      } else {
        discount = res.coupon.discount_value;
      }
      setCouponDiscount(Math.min(discount, base));
    } catch (err) {
      setAppliedCoupon(null);
      setCouponDiscount(0);
      setCouponError(err instanceof Error ? err.message : "Erro ao aplicar cupom.");
    } finally {
      setApplyingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponDiscount(0);
    setCouponError(null);
  };

  const handlePayment = async (method?: "pix" | "credit_card" | "boleto") => {
    if (!data || groupedItems.length === 0) return;
    const pm = method ?? paymentMethod;
    const docDigits = onlyDigits(customerDocument);
    const phoneDigits = onlyDigits(customerPhone);

    if (customerName.trim().length < 3) {
      alert("Preencha o nome completo.");
      setStep("dados");
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(customerEmail.trim())) {
      alert("Preencha um e-mail válido.");
      setStep("dados");
      return;
    }
    if (docDigits.length !== 11 || !cpfIsValid(docDigits)) {
      alert("Preencha um CPF válido.");
      setStep("dados");
      return;
    }
    if (phoneDigits.length < 10) {
      alert("Preencha o celular com DDD.");
      setStep("dados");
      return;
    }

    if (address.cep.replace(/\D+/g, "").length !== 8) {
      alert("Preencha o CEP válido.");
      setStep("entrega");
      return;
    }
    if (address.logradouro.trim().length < 3) {
      alert("Preencha o endereço.");
      setStep("entrega");
      return;
    }
    if (address.numero.trim().length === 0) {
      alert("Preencha o número do endereço.");
      setStep("entrega");
      return;
    }
    if (address.bairro.trim().length < 2) {
      alert("Preencha o bairro.");
      setStep("entrega");
      return;
    }

    if (data?.shipping_methods && data.shipping_methods.length > 0 && !selectedShippingMethod) {
      alert("Selecione uma forma de frete.");
      setStep("entrega");
      return;
    }

      // Pré-calcula descontos para aplicá-los no payload (checkout já exibe preço com desconto).
      const methodDiscountPct = pm === "pix" ? 1 : pm === "credit_card" ? 5 : 0;
      const finalAmount = displayTotal * (1 - methodDiscountPct / 100);

      // A API calcula o total a partir dos itens + frete (sem desconto por método).
      // Para honrar o desconto exibido, repassamos como redução proporcional via
      // metadata; o backend hoje ignora. Fluxo atual: API decide total sozinha.
      void finalAmount;

      if (isPreview) {
        if (pm === "pix" || pm === "boleto") {
          try {
            sessionStorage.setItem(
              "pix_page_settings",
              JSON.stringify({
                logo_url: data?.store.settings.logo_url,
                pix_confirmation_logo: data?.store.settings.pix_confirmation_logo,
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
            pm === "boleto"
              ? `/${storeSlug}/boleto/preview?preview=1`
              : `/${storeSlug}/pix/preview?preview=1`;
          router.push(dest);
        } else {
          alert("Modo de visualização: o pagamento não é processado no editor.");
        }
        return;
      }

    // Cartão: coleta dados e os envia para o backend processar na Unipay.
    let cardBrand: string | null = null;
    let cardLast4: string | null = null;
    let installments = card.installments;

    if (pm === "credit_card") {
      const digitsOnly = card.number.replace(/\D+/g, "");
      const brand = getCardBrand(digitsOnly);
      const expectedCvvLength = cvvLengthForBrand(brand);

      if (digitsOnly.length < 13 || !isValidLuhn(digitsOnly)) {
        alert("Número do cartão inválido.");
        return;
      }

      if (!/^\d{2}\/\d{2}$/.test(card.expiry) || isCardExpired(card.expiry)) {
        alert("Data de validade inválida.");
        return;
      }

      if (card.cvv.length !== expectedCvvLength) {
        alert(`CVV inválido. O cartão ${brand ?? ""} exige ${expectedCvvLength} dígitos.`);
        return;
      }

      if (card.holder.trim().length < 3) {
        alert("Nome do titular inválido.");
        return;
      }

      cardLast4 = digitsOnly.slice(-4) || null;
      cardBrand = brand;
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
        payment_method: pm,
        shipping_method_id: selectedShippingMethod?.id ?? null,
        shipping_address: address,
        order_bump_id: selectedOrderBump?.id ?? null,
      };
      if (pm === "credit_card") {
        payload.card_number = card.number.replace(/\D+/g, "");
        payload.card_holder = card.holder.trim().toUpperCase();
        payload.card_expiry = card.expiry;
        payload.card_cvv = card.cvv;
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
        markCompleted("pagamento");
        router.push(`/${storeSlug}/confirmed/${res.order_id}`);
        return;
      }

      if (!res.order_id) {
        alert(res.message ?? "Não foi possível iniciar o pagamento.");
        return;
      }

      markCompleted("pagamento");
      switch (res.payment_method ?? pm) {
        case "boleto":
          router.push(`/${storeSlug}/boleto/${res.order_id}`);
          break;
        case "pix":
        default:
          router.push(`/${storeSlug}/pix/${res.order_id}`);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        const message = err.message.toLowerCase();
        const body = err.body as { error?: string; message?: string; details?: { error?: { refusedReason?: string } } } | null;
        const refusedReason = body?.details?.error?.refusedReason?.toLowerCase() ?? "";
        const isRefused =
          message.includes("recusada") ||
          refusedReason.includes("provider") ||
          refusedReason.includes("recusado") ||
          refusedReason.includes("recusada");
        const isLimit = message.includes("limite de 3 tentativas") || message.includes("limite de tentativas");

        if (isLimit) {
          setModalCardLimit(true);
          setPaymentMethod("pix");
        } else if (isRefused) {
          setModalCardRefused(true);
          trackAbandonedCart("pagamento_tentado", {
            payment_method: "credit_card",
            abandoned_reason: "card_refused",
            card_brand: getCardBrand(card.number.replace(/\D+/g, "")),
            card_last4: card.number.replace(/\D+/g, "").slice(-4) || null,
          });
        } else {
          alert(err.message || "Erro ao processar pagamento.");
        }
      } else {
        alert(err instanceof Error ? err.message : "Erro ao processar pagamento.");
      }
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

  // ─── Mobile step progress helpers ───
  const steps: { id: StepId; label: string; num: number }[] = [
    { id: "dados", label: "Identificação", num: 1 },
    { id: "entrega", label: "Entrega", num: 2 },
    { id: "pagamento", label: "Pagamento", num: 3 },
  ];

  const getStepState = (id: StepId) => {
    if (step === id) return "active";
    if (completed.includes(id)) return "completed";
    return "";
  };

  /** On mobile, hide steps that are not active AND not completed */
  const mobileHidden = (id: StepId) =>
    step !== id && !completed.includes(id) ? "step-card-mobile-hidden" : "";

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
        <div style={{ fontSize: "0.75rem", fontWeight: 700, color: iconColor, letterSpacing: 0.5 }}>PAGAMENTO</div>
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
        <>
        {/* ─── Main 3-Column Layout ─── */}
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
          {/* ─── Mobile Step Progress Bar ─── */}
          <div className="mobile-step-progress">
            {steps.map((s, i) => (
              <React.Fragment key={s.id}>
                <div
                  className={`mobile-step-progress-item ${getStepState(s.id)}`}
                  onClick={() => {
                    if (completed.includes(s.id) || step === s.id) handleEditStep(s.id);
                  }}
                  style={{ cursor: completed.includes(s.id) ? "pointer" : "default" }}
                >
                  <div className="mobile-step-progress-circle">
                    {completed.includes(s.id) && step !== s.id ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      s.num
                    )}
                  </div>
                  <span className="mobile-step-progress-label">{s.label}</span>
                </div>
                {i < steps.length - 1 && (
                  <div
                    className={`mobile-step-progress-line ${
                      completed.includes(s.id) ? "filled" : ""
                    }`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>

          {/* ─── Column 1: Identificação + Entrega ─── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div className={mobileHidden("dados")}>
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
            </div>

            <div className={mobileHidden("entrega")}>
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
          </div>

          {/* ─── Column 2: Pagamento ─── */}
          <div className={mobileHidden("pagamento")}>
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
              sdkReady={true}
              sdkError={null}
              enabledMethods={enabledMethods}
              installmentConfig={installmentConfig}
              orderBumps={data?.order_bumps ?? []}
              selectedOrderBumpId={selectedOrderBumpId}
              onToggleOrderBump={(id, sel) =>
                setSelectedOrderBumpId(sel ? id : null)
              }
            />
          </div>

          {/* ─── Column 3: Order Summary ─── */}
          <div className="checkout-summary-col" style={{ position: "sticky", top: 24 }}>
            <div
              style={{
                background: "var(--card-bg)",
                border: "1px solid var(--border-color)",
                borderRadius: 12,
                padding: 24,
              }}
            >
              <OrderSummary
                items={summaryItems}
                subtotal={subtotalWithBump}
                shipping={shippingPrice}
                total={subtotalWithBump + shippingPrice}
                discount={couponDiscount + (step === "pagamento" ? discountValue : 0)}
                title={settings.summary_title || "Resumo do pedido"}
                showDiscount={settings.summary_show_discount ?? true}
                couponEnabled={settings.summary_coupon_enabled ?? true}
                onApplyCoupon={handleApplyCoupon}
                onRemoveCoupon={handleRemoveCoupon}
                appliedCoupon={appliedCoupon}
                applyingCoupon={applyingCoupon}
                couponError={couponError}
              />
            </div>

            {(effectiveSettings.social_proofs_enabled ?? true) && (
              <div className="desktop-social-proofs" style={{ marginTop: 24 }}>
                <SocialProofs reviews={data?.social_proofs} />
              </div>
            )}
          </div>
        </main>
        </>
      )}

      {!orderPaid && (effectiveSettings.social_proofs_enabled ?? true) && (
        <div className="mobile-social-proofs">
          <SocialProofs reviews={data?.social_proofs} />
        </div>
      )}

      <ErrorModal
        isOpen={modalCardRefused}
        title="Pagamento não aprovado"
        message="Sua transação foi recusada pelo emissor. Use outro cartão ou forma de pagamento."
        buttonText="Entendi"
        onClose={() => setModalCardRefused(false)}
      />

      <ErrorModal
        isOpen={modalCardLimit}
        title="Limite de tentativas atingido"
        message="Você atingiu o limite de tentativas para pagamentos com cartão. Utilize outra forma de pagamento."
        buttonText="Pagar com PIX"
        onClose={() => setModalCardLimit(false)}
      />

      <Footer settings={settings} storeName={data?.store?.name} />

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
          .checkout-summary-col {
            align-self: stretch !important;
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
