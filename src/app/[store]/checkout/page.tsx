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
import { getCheckoutSessionId, useLiveCheckout } from "@/lib/useLiveCheckout";
import {
  loadGoogleAds,
  trackBeginCheckout,
  trackConversion,
  shouldFireForProducts,
  persistGoogleAdsConfig,
  markFired,
  isFired,
} from "@/lib/googleAds";
import GoogleAdsTracking from "@/components/GoogleAdsTracking";
import MetaPixelTracking from "@/components/MetaPixelTracking";
import TikTokPixelTracking from "@/components/TikTokPixelTracking";
import KwaiPixelTracking from "@/components/KwaiPixelTracking";
import TaboolaPixelTracking from "@/components/TaboolaPixelTracking";
import {
  getMetaTrackingParameters,
  persistMetaPixelConfig,
  trackMetaEvent,
  trackMetaBrowserEvent,
  shouldFireForMetaProducts,
  createMetaEventId,
} from "@/lib/metaPixel";
import {
  getTikTokTrackingParameters,
  persistTikTokPixelConfig,
  trackTikTokEvent,
  shouldFireForTikTokProducts,
  createTikTokEventId,
} from "@/lib/tiktokPixel";
import {
  getKwaiTrackingParameters,
  persistKwaiPixelConfig,
  trackKwaiEvent,
  shouldFireForKwaiProducts,
  createKwaiEventId,
} from "@/lib/kwaiPixel";
import {
  getTaboolaTrackingParameters,
  persistTaboolaPixelConfig,
  trackTaboolaEvent,
  shouldFireForTaboolaProducts,
  createTaboolaEventId,
} from "@/lib/taboolaPixel";

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
  const isStoreId = useMemo(() => /^\d+$/.test(storeSlug), [storeSlug]);
  const storePathPrefix = useMemo(
    () => (isStoreId ? `/store/${storeSlug}` : `/${storeSlug}`),
    [isStoreId, storeSlug]
  );
  const isPreview = searchParams.get("preview") === "1";
  const productsParam = isPreview ? "1,2" : searchParams.get("products") ?? "";

  // Captura parâmetros de rastreamento (UTMs/src/sck) da URL do checkout.
  const trackingParameters = useMemo(() => {
    const get = (k: string) => searchParams.get(k);
    const params = {
      src: get("src"),
      sck: get("sck"),
      utm_source: get("utm_source"),
      utm_campaign: get("utm_campaign"),
      utm_medium: get("utm_medium"),
      utm_content: get("utm_content"),
      utm_term: get("utm_term"),
      ...getMetaTrackingParameters(),
      ...getTikTokTrackingParameters(),
      ...getKwaiTrackingParameters(),
      ...getTaboolaTrackingParameters(),
    };
    const hasAny = Object.values(params).some((v) => v && v.trim() !== "");
    return hasAny ? params : null;
  }, [searchParams]);

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
    const config = pm?.card?.installment_config;
    if (!config) return undefined;

    const limit = Math.max(
      1,
      Math.min(12, Number(liveSettings.card_installment_limit ?? config.limit))
    );
    const preSelected = Math.max(
      1,
      Math.min(limit, Number(liveSettings.card_pre_selected_installment ?? config.pre_selected))
    );

    return {
      ...config,
      limit,
      pre_selected: preSelected,
      interest_free: Math.min(limit, config.interest_free),
    };
  }, [data, liveSettings.card_installment_limit, liveSettings.card_pre_selected_installment]);

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
    const limit = Number(liveSettings.card_installment_limit);
    const preSelected = Number(liveSettings.card_pre_selected_installment);
    if (preSelected > 0) {
      setCard((previous) => ({
        ...previous,
        installments: Math.min(preSelected, limit > 0 ? limit : 12),
      }));
    } else if (limit > 0) {
      setCard((previous) => ({
        ...previous,
        installments: Math.min(previous.installments, limit),
      }));
    }

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
  }, [
    isPreview,
    liveSettings?.default_payment_method,
    liveSettings?.card_pre_selected_installment,
    liveSettings?.card_installment_limit,
    enabledMethods,
  ]);

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
  const [quantityAdjustments, setQuantityAdjustments] = useState<Record<number, number>>({});

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

  const buildStoreQuery = useCallback((): string => {
    if (isStoreId) {
      return `store_id=${encodeURIComponent(storeSlug)}`;
    }
    return `domain=${encodeURIComponent(getStoreIdentifier())}`;
  }, [isStoreId, storeSlug, getStoreIdentifier]);

  useEffect(() => {
    const fetchCheckout = async () => {
      try {
        const storeQuery = buildStoreQuery();
        const endpoint = isPreview
          ? `/checkout/preview?${storeQuery}`
          : `/checkout?${storeQuery}&product_ids=${encodeURIComponent(productsParam)}`;
        const res = await apiGet<CheckoutData>(endpoint);
        if (process.env.NODE_ENV === "development") {
          // eslint-disable-next-line no-console
          console.log("[checkout] order_bumps:", res.order_bumps);
        }
        setData(res);

        // Persiste configuração do Google Ads (reisada nas páginas de status).
        persistGoogleAdsConfig(res.store?.google_ads ?? null);
        persistMetaPixelConfig(res.store?.meta_pixel ?? null);
        persistTikTokPixelConfig(res.store?.tiktok_pixel ?? null);
        persistKwaiPixelConfig(res.store?.kwai_pixel ?? null);
        persistTaboolaPixelConfig(res.store?.taboola_pixel ?? null);

        // Se a URL atual usa slug legado no domínio principal do checkout,
        // redireciona para o novo formato imutável /store/{id}/checkout.
        // Domínios customizados/subdomínios de loja continuam no host original.
        const hostname = window.location.hostname;
        const checkoutAppDomain =
          process.env.NEXT_PUBLIC_CHECKOUT_APP_DOMAIN || `checkout.${process.env.NEXT_PUBLIC_CHECKOUT_BASE_DOMAIN || "bersenker.shop"}`;
        if (!isStoreId && res.store?.id && !isPreview && productsParam &&
            (hostname === checkoutAppDomain || hostname === `www.${checkoutAppDomain}`)) {
          const newUrl = `/store/${res.store.id}/checkout?products=${encodeURIComponent(productsParam)}`;
          router.replace(newUrl);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar checkout.");
      } finally {
        setLoading(false);
      }
    };
    fetchCheckout();
  }, [productsParam, buildStoreQuery, isPreview, isStoreId, router]);

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

    root.style.setProperty("--step-number-color", s.step_number_color || "#000000");
    root.style.setProperty("--step-button-color", s.step_button_color || "#1b7a2b");
    root.style.setProperty("--finalize-button-color", s.finalize_button_color || "#1a3a5c");
    root.style.setProperty("--order-bump-bg-color", s.order_bump_bg_color || "#FEFCE8");
    root.style.setProperty("--order-bump-border-color", s.order_bump_border_color || "#E2E8F0");
    root.style.setProperty("--order-bump-button-color", s.order_bump_button_color || "#13BF8C");
    root.style.setProperty("--order-bump-button-text-color", s.order_bump_button_text_color || "#FFFFFF");
    root.style.setProperty(
      "--input-border-radius",
      s.input_border_radius === "none" ? "0" : s.input_border_radius === "large" ? "16px" : "8px"
    );

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

    root.style.setProperty(
      "--step-card-bg",
      s.step_card_background_color || (s.dark_mode ? "rgba(255,255,255,0.05)" : "#ffffff")
    );
  }, [effectiveSettings]);

  const baseGroupedItems = useMemo(
    () =>
      data
        ? groupProductsByIds(
            data.products,
            productsParam
              .split(",")
              .map((s) => parseInt(s.trim(), 10))
              .filter((n) => !isNaN(n))
          )
        : [],
    [data, productsParam]
  );

  const groupedItems = useMemo(
    () =>
      baseGroupedItems.map((item) => ({
        ...item,
        qty: item.qty + (quantityAdjustments[item.product.id] ?? 0),
      })),
    [baseGroupedItems, quantityAdjustments]
  );

  useEffect(() => {
    setQuantityAdjustments({});
  }, [productsParam]);

  const handleQuantityChange = useCallback(
    (productId: number, delta: number) => {
      if (delta === 0 || !baseGroupedItems.some((item) => item.product.id === productId)) return;

      setQuantityAdjustments((previous) => {
        const current = previous[productId] ?? 0;
        const next = Math.max(0, current + delta);
        if (next === current) return previous;
        return { ...previous, [productId]: next };
      });
    },
    [baseGroupedItems]
  );

  const subtotal = groupedItems.reduce(
    (sum, g) => sum + Number(g.product.price) * g.qty,
    0
  );

  const shippingAddressComplete =
    address.cep.replace(/\D+/g, "").length === 8 &&
    address.logradouro.trim().length >= 3 &&
    address.numero.trim().length > 0 &&
    address.bairro.trim().length >= 2;

  const shippingPrice = useMemo(() => {
    if (!shippingAddressComplete || !selectedShippingMethod) return 0;
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
  }, [shippingAddressComplete, selectedShippingMethod, subtotal, appliedCoupon]);

  const shippingSummaryMessage = !shippingAddressComplete
    ? "Inserir endereço"
    : !selectedShippingMethod
      ? "Selecione o frete"
      : null;

  const subtotalWithBump = subtotal + orderBumpPrice;

  const displayTotal = subtotalWithBump + shippingPrice - couponDiscount;

  useEffect(() => {
    if (!appliedCoupon) return;

    const base = subtotalWithBump + shippingPrice;
    const discount =
      appliedCoupon.coupon.discount_type === "percent"
        ? base * (appliedCoupon.coupon.discount_value / 100)
        : appliedCoupon.coupon.discount_value;

    setCouponDiscount(Math.min(discount, base));
  }, [appliedCoupon, subtotalWithBump, shippingPrice]);

  // ── Live checkout heartbeat ───────────────────────────────────────
  useLiveCheckout(
    !isPreview && data?.store != null,
    isStoreId ? storeSlug : undefined,
    isStoreId ? undefined : getStoreIdentifier(),
    () => {
      const items: { name: string; qty: number; unit_price: number }[] = [];
      for (const g of groupedItems) {
        items.push({
          name: g.product.name,
          qty: g.qty,
          unit_price: Number(g.product.price),
        });
      }
      if (selectedOrderBump) {
        items.push({
          name: selectedOrderBump.product.name,
          qty: 1,
          unit_price: Number(selectedOrderBump.product.bump_price),
        });
      }

      return {
        storeId: isStoreId ? storeSlug : undefined,
        domain: isStoreId ? undefined : getStoreIdentifier(),
        step,
        customer_name: customerName,
        customer_email: customerEmail,
        cep: address.cep,
        payment_method: paymentMethod,
        total: displayTotal,
        items,
      };
    }
  );

  // Itens exibidos no resumo pedidos: produtos normais + order bump selecionado.
  const summaryItems: GroupedItem[] = useMemo(() => {
    if (!selectedOrderBump) return groupedItems;
    const bumpProduct = {
      ...selectedOrderBump.product,
      price: selectedOrderBump.product.bump_price,
    };
    return [...groupedItems, { product: bumpProduct, qty: 1 }];
  }, [groupedItems, selectedOrderBump]);

  // Dispara `begin_checkout` assim que o carrinho é montado (uma vez por sessão).
  useEffect(() => {
    if (!data || groupedItems.length === 0) return;
    const ga = data.store?.google_ads;
    const productIds = groupedItems.map((g) => g.product.id);
    const cartItems = groupedItems.map((g) => ({
      id: String(g.product.id),
      name: g.product.name,
      content_category: g.product.product_type ?? g.product.parent_title ?? undefined,
      brand: g.product.vendor ?? undefined,
      sku: g.product.sku ?? undefined,
      quantity: g.qty,
      price: Number(g.product.price),
    }));
    if (ga?.enabled && ga.pixel_id) {
      loadGoogleAds(ga.pixel_id);
      trackBeginCheckout({
        transaction_id: `cart-${data.store.id}-${productIds.join("-")}`,
        value: displayTotal,
        currency: "BRL",
        items: cartItems,
      });
    }
    const meta = data.store?.meta_pixel;
    if (meta?.enabled && shouldFireForMetaProducts(meta, productIds)) {
      const metaData = {
        value: Number(displayTotal.toFixed(2)),
        currency: "BRL",
        content_ids: productIds.map(String),
        contents: cartItems,
        content_type: "product",
        num_items: cartItems.reduce((sum, item) => sum + item.quantity, 0),
      };
      const eventId = createMetaEventId(`checkout_${data.store.id}`);
      trackMetaEvent(meta, data.store.id, "ViewContent", { ...metaData, event_id: `${eventId}_view` }, true);
      trackMetaEvent(meta, data.store.id, "AddToCart", { ...metaData, event_id: `${eventId}_cart` }, true);
      trackMetaEvent(meta, data.store.id, "InitiateCheckout", { ...metaData, event_id: eventId }, true);
    }
    const tiktok = data.store?.tiktok_pixel;
    if (tiktok?.enabled && shouldFireForTikTokProducts(tiktok, productIds)) {
      const tiktokData = {
        value: Number(displayTotal.toFixed(2)),
        currency: "BRL",
        content_ids: productIds.map(String),
        contents: cartItems.map((item) => ({
          content_id: item.id,
          content_name: item.name,
          content_category: item.content_category,
          brand: item.brand,
          sku: item.sku,
          content_type: "product",
          quantity: item.quantity,
          price: item.price,
        })),
        content_type: "product",
        quantity: cartItems.reduce((sum, item) => sum + item.quantity, 0),
        shipping_price: Number(shippingPrice.toFixed(2)),
        coupon: appliedCoupon?.coupon.code,
      };
      const eventId = createTikTokEventId(`checkout_${data.store.id}`);
      trackTikTokEvent(tiktok, data.store.id, "ViewContent", { ...tiktokData, event_id: `${eventId}_view` }, true);
      trackTikTokEvent(tiktok, data.store.id, "AddToCart", { ...tiktokData, event_id: `${eventId}_cart` }, true);
      trackTikTokEvent(tiktok, data.store.id, "InitiateCheckout", { ...tiktokData, event_id: eventId }, true);
    }
    const kwai = data.store?.kwai_pixel;
    if (kwai?.enabled && shouldFireForKwaiProducts(kwai, productIds)) {
      const kwaiData = {
        value: Number(displayTotal.toFixed(2)),
        currency: "BRL",
        content_ids: productIds.map(String),
        contents: cartItems.map((item) => ({
          content_id: item.id,
          content_name: item.name,
          content_category: item.content_category,
          brand: item.brand,
          sku: item.sku,
          content_type: "product",
          quantity: item.quantity,
          price: item.price,
        })),
        content_type: "product",
        quantity: cartItems.reduce((sum, item) => sum + item.quantity, 0),
        shipping_price: Number(shippingPrice.toFixed(2)),
        coupon: appliedCoupon?.coupon.code,
      };
      const eventId = createKwaiEventId(`checkout_${data.store.id}`);
      trackKwaiEvent(kwai, data.store.id, "ViewContent", { ...kwaiData, event_id: `${eventId}_view` }, true);
      trackKwaiEvent(kwai, data.store.id, "AddToCart", { ...kwaiData, event_id: `${eventId}_cart` }, true);
      trackKwaiEvent(kwai, data.store.id, "InitiateCheckout", { ...kwaiData, event_id: eventId }, true);
    }
    const taboola = data.store?.taboola_pixel;
    if (taboola?.enabled && shouldFireForTaboolaProducts(taboola, productIds)) {
      const taboolaData = {
        value: Number(displayTotal.toFixed(2)), currency: "BRL",
        content_ids: productIds.map(String), contents: cartItems.map((item) => ({
          content_id: item.id, content_name: item.name, content_category: item.content_category,
          brand: item.brand, sku: item.sku, quantity: item.quantity, price: item.price,
        })), quantity: cartItems.reduce((sum, item) => sum + item.quantity, 0),
        shipping_price: Number(shippingPrice.toFixed(2)), coupon: appliedCoupon?.coupon.code,
      };
      const eventId = createTaboolaEventId(`checkout_${data.store.id}`);
      trackTaboolaEvent(taboola, data.store.id, "ViewContent", { ...taboolaData, event_id: `${eventId}_view` }, true);
      trackTaboolaEvent(taboola, data.store.id, "AddToCart", { ...taboolaData, event_id: `${eventId}_cart` }, true);
      trackTaboolaEvent(taboola, data.store.id, "InitiateCheckout", { ...taboolaData, event_id: eventId }, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, groupedItems.length]);

  // Order bump é uma adição real ao carrinho: registra o AddToCart adicional
  // com os dados do item e um event_id próprio para não duplicar o funil inicial.
  useEffect(() => {
    if (!data || !selectedOrderBump) return;
    const tiktok = data.store?.tiktok_pixel;
    const productIds = [...groupedItems.map((g) => g.product.id), selectedOrderBump.product.id];
    if (tiktok?.enabled && shouldFireForTikTokProducts(tiktok, productIds)) {
      trackTikTokEvent(tiktok, data.store.id, "AddToCart", {
        event_id: createTikTokEventId(`order_bump_${selectedOrderBump.id}`), value: Number(displayTotal.toFixed(2)), currency: "BRL",
        content_id: String(selectedOrderBump.product.id), content_ids: productIds.map(String),
        contents: [{ content_id: String(selectedOrderBump.product.id), content_name: selectedOrderBump.product.name, content_type: "product", quantity: 1, price: Number(selectedOrderBump.product.bump_price) }],
        content_type: "product", quantity: 1,
      }, true);
    }
    const kwai = data.store?.kwai_pixel;
    if (kwai?.enabled && shouldFireForKwaiProducts(kwai, productIds)) {
      trackKwaiEvent(kwai, data.store.id, "AddToCart", {
        event_id: createKwaiEventId(`order_bump_${selectedOrderBump.id}`), value: Number(displayTotal.toFixed(2)), currency: "BRL",
        content_id: String(selectedOrderBump.product.id), content_ids: productIds.map(String),
        contents: [{ content_id: String(selectedOrderBump.product.id), content_name: selectedOrderBump.product.name, content_type: "product", quantity: 1, price: Number(selectedOrderBump.product.bump_price) }],
        content_type: "product", quantity: 1,
      }, true);
    }
    const taboola = data.store?.taboola_pixel;
    if (taboola?.enabled && shouldFireForTaboolaProducts(taboola, productIds)) {
      trackTaboolaEvent(taboola, data.store.id, "AddToCart", {
        event_id: createTaboolaEventId(`order_bump_${selectedOrderBump.id}`), value: Number(displayTotal.toFixed(2)), currency: "BRL",
        content_id: String(selectedOrderBump.product.id), content_ids: productIds.map(String), quantity: 1,
        contents: [{ content_id: String(selectedOrderBump.product.id), content_name: selectedOrderBump.product.name, quantity: 1, price: Number(selectedOrderBump.product.bump_price) }],
      }, true);
    }
  }, [data, selectedOrderBump?.id]);

  const markCompleted = (s: StepId) => {
    setCompleted((prev) => (prev.includes(s) ? prev : [...prev, s]));
  };

  // Registra o cliente no backend (e sincroniza com a Shopify quando a loja
  // estiver conectada). Fire-and-forget — não bloqueia o fluxo do checkout.
  const registerCustomer = useCallback(() => {
    const name = customerName.trim();
    const email = customerEmail.trim();
    const phone = customerPhone;
    const document = customerDocument;

    if (name.length < 3 || !email) return;

    const payload: Record<string, unknown> = {
      name,
      email,
      phone,
      document,
    };
    if (isStoreId) {
      payload.store_id = storeSlug;
    } else {
      payload.domain = getStoreIdentifier();
    }

    try {
      apiPost("/checkout/customer", payload).catch(() => {
        /* ignore: best-effort */
      });
    } catch {
      /* ignore */
    }
  }, [customerName, customerEmail, customerPhone, customerDocument, isStoreId, storeSlug, getStoreIdentifier]);

  // Atualiza o endereço do cliente no backend e na Shopify (best-effort).
  const updateCustomerAddress = useCallback(() => {
    const email = customerEmail.trim();
    if (!email || !address.cep) return;

    const payload: Record<string, unknown> = {
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
    };
    if (isStoreId) {
      payload.store_id = storeSlug;
    } else {
      payload.domain = getStoreIdentifier();
    }

    try {
      apiPost("/checkout/customer/address", payload).catch(() => {
        /* ignore: best-effort */
      });
    } catch {
      /* ignore */
    }
  }, [customerEmail, address, isStoreId, storeSlug, getStoreIdentifier]);

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
      const email = customerEmail.trim();
      const name = customerName.trim();
      if (!email || name.length < 3 || groupedItems.length === 0) return;

      const payload: Record<string, unknown> = {
        session_id: getCheckoutSessionId(),
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

      if (isStoreId) {
        payload.store_id = storeSlug;
      } else {
        payload.domain = getStoreIdentifier();
      }

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
      isStoreId,
      storeSlug,
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
      const productIds = productsParam
        .split(",")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n))
        .join(",");
      const storeQuery = isStoreId
        ? `store_id=${encodeURIComponent(storeSlug)}`
        : `domain=${encodeURIComponent(getStoreIdentifier())}`;
      const res = await apiGet<ValidatedCoupon>(
        `/checkout/coupon?${storeQuery}&product_ids=${encodeURIComponent(productIds)}&code=${encodeURIComponent(code)}`
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
      // A API calcula o total a partir dos itens + frete (sem desconto por método).
      // Para honrar o desconto exibido, repassamos como redução proporcional via
      // metadata; o backend hoje ignora. Fluxo atual: API decide total sozinha.
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
              ? `${storePathPrefix}/boleto/preview?preview=1`
              : `${storePathPrefix}/pix/preview?preview=1`;
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
      const meta = data?.store?.meta_pixel;
      if (meta?.enabled && shouldFireForMetaProducts(meta, groupedItems.map((g) => g.product.id))) {
        const metaEventId = createMetaEventId("add_payment_info");
        trackMetaEvent(meta, data!.store.id, "AddPaymentInfo", {
          event_id: metaEventId,
          value: Number(displayTotal.toFixed(2)),
          currency: "BRL",
          content_ids: groupedItems.map((g) => String(g.product.id)),
          contents: groupedItems.map((g) => ({ id: String(g.product.id), quantity: g.qty, item_price: Number(g.product.price) })),
          content_type: "product",
          num_items: groupedItems.reduce((sum, g) => sum + g.qty, 0),
          email: customerEmail.trim(),
          phone: customerPhone,
          name: customerName.trim(),
          city: address.cidade,
          state: address.uf,
          zip: address.cep,
          country: "br",
          payment_method: pm,
          installments,
        }, true);
      }
      const tiktok = data?.store?.tiktok_pixel;
      if (tiktok?.enabled && shouldFireForTikTokProducts(tiktok, groupedItems.map((g) => g.product.id))) {
        const tiktokEventId = createTikTokEventId("add_payment_info");
        trackTikTokEvent(tiktok, data!.store.id, "AddPaymentInfo", {
          event_id: tiktokEventId,
          value: Number(displayTotal.toFixed(2)),
          currency: "BRL",
          content_ids: groupedItems.map((g) => String(g.product.id)),
          contents: groupedItems.map((g) => ({
            content_id: String(g.product.id),
            content_name: g.product.name,
            content_category: g.product.product_type ?? g.product.parent_title ?? undefined,
            brand: g.product.vendor ?? undefined,
            sku: g.product.sku ?? undefined,
            content_type: "product",
            quantity: g.qty,
            price: Number(g.product.price),
          })),
          content_type: "product",
          quantity: groupedItems.reduce((sum, g) => sum + g.qty, 0),
          email: customerEmail.trim(),
          phone: customerPhone,
          payment_method: pm,
          installments,
          shipping_price: Number(shippingPrice.toFixed(2)),
          coupon: appliedCoupon?.coupon.code,
        }, true);
      }
      const kwai = data?.store?.kwai_pixel;
      if (kwai?.enabled && shouldFireForKwaiProducts(kwai, groupedItems.map((g) => g.product.id))) {
        const kwaiEventId = createKwaiEventId("add_payment_info");
        trackKwaiEvent(kwai, data!.store.id, "AddPaymentInfo", {
          event_id: kwaiEventId,
          value: Number(displayTotal.toFixed(2)), currency: "BRL",
          content_ids: groupedItems.map((g) => String(g.product.id)),
          contents: groupedItems.map((g) => ({
            content_id: String(g.product.id), content_name: g.product.name,
            content_category: g.product.product_type ?? g.product.parent_title ?? undefined,
            brand: g.product.vendor ?? undefined, sku: g.product.sku ?? undefined,
            content_type: "product", quantity: g.qty, price: Number(g.product.price),
          })),
          content_type: "product", quantity: groupedItems.reduce((sum, g) => sum + g.qty, 0),
          email: customerEmail.trim(), phone: customerPhone, payment_method: pm,
          installments, shipping_price: Number(shippingPrice.toFixed(2)), coupon: appliedCoupon?.coupon.code,
        }, true);
      }
      const taboola = data?.store?.taboola_pixel;
      if (taboola?.enabled && shouldFireForTaboolaProducts(taboola, groupedItems.map((g) => g.product.id))) {
        const taboolaEventId = createTaboolaEventId("add_payment_info");
        trackTaboolaEvent(taboola, data!.store.id, "AddPaymentInfo", {
          event_id: taboolaEventId, value: Number(displayTotal.toFixed(2)), currency: "BRL",
          content_ids: groupedItems.map((g) => String(g.product.id)), quantity: groupedItems.reduce((sum, g) => sum + g.qty, 0),
          contents: groupedItems.map((g) => ({ content_id: String(g.product.id), content_name: g.product.name, content_category: g.product.product_type ?? g.product.parent_title ?? undefined, brand: g.product.vendor ?? undefined, sku: g.product.sku ?? undefined, quantity: g.qty, price: Number(g.product.price) })),
          email: customerEmail.trim(), payment_method: pm, installments, shipping_price: Number(shippingPrice.toFixed(2)), coupon: appliedCoupon?.coupon.code,
        }, true);
      }
      const items = groupedItems.map((g) => ({
        product_id: g.product.id,
        qty: g.qty,
      }));
      const payload: Record<string, unknown> = {
        items,
        customer_name: customerName.trim(),
        customer_email: customerEmail.trim(),
        customer_phone: customerPhone,
        customer_document: customerDocument,
        payment_method: pm,
        shipping_method_id: selectedShippingMethod?.id ?? null,
        shipping_address: address,
        order_bump_id: selectedOrderBump?.id ?? null,
        tracking_parameters: {
          ...(trackingParameters ?? {}),
          ...getMetaTrackingParameters(),
          ...getTikTokTrackingParameters(),
          ...getKwaiTrackingParameters(),
          ...getTaboolaTrackingParameters(),
          meta_consent: true,
          tiktok_consent: true,
          kwai_consent: true,
          taboola_consent: true,
          coupon: appliedCoupon?.coupon.code ?? null,
        },
      };

      if (isStoreId) {
        payload.store_id = parseInt(storeSlug, 10);
      } else {
        payload.domain = getStoreIdentifier();
      }
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

      // Dispara conversão do Google Ads quando a flag `only_paid_sales` está OFF.
      // Caso contrário, será disparada na página `confirmed` (status pago).
      try {
        const ga = data?.store?.google_ads;
        if (ga?.enabled && ga.pixel_id && res.order_id) {
          const productIds = groupedItems.map((g) => g.product.id);
          const cartItems = [...groupedItems, ...(selectedOrderBump ? [{ product: { ...selectedOrderBump.product, price: selectedOrderBump.product.bump_price }, qty: 1 }] : [])];
          const txnId = String(res.order_id);
          const paidNow = res.status === "paid" || res.status === "authorized";
          if (!ga.only_paid_sales && !isFired(txnId) && shouldFireForProducts(ga, productIds)) {
            trackConversion(
              { pixel_id: ga.pixel_id, conversion_label: ga.conversion_label },
              {
                transaction_id: txnId,
                value: Number(displayTotal.toFixed(2)),
                currency: "BRL",
                items: cartItems.map((g) => ({
                  id: String(g.product.id),
                  name: g.product.name,
                  quantity: g.qty,
                  price: Number(g.product.price),
                })),
              }
            );
            markFired(txnId);
            void paidNow;
          }
        }
      } catch {
        // tracking não deve quebrar o checkout
      }

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
            card_redirect_enabled: data?.store.settings.card_redirect_enabled,
            card_redirect_url: data?.store.settings.card_redirect_url,
            pix_redirect_enabled: data?.store.settings.pix_redirect_enabled,
            pix_redirect_url: data?.store.settings.pix_redirect_url,
          })
        );
      } catch {
        // ignore storage errors
      }

      // Status pagos imediatamente (cartão autorizado/pago).
      if (res.status === "paid" || res.status === "authorized") {
        markCompleted("pagamento");
        if (res.payment_method === "credit_card" && data?.store.settings.card_redirect_enabled && data?.store.settings.card_redirect_url) {
          window.location.href = data.store.settings.card_redirect_url;
          return;
        }
        if (res.has_upsell && res.payment_method === "credit_card") {
          router.push(`${storePathPrefix}/upsell/${res.order_id}`);
        } else {
          router.push(`${storePathPrefix}/confirmed/${res.order_id}`);
        }
        return;
      }

      if (!res.order_id) {
        alert(res.message ?? "Não foi possível iniciar o pagamento.");
        return;
      }

      markCompleted("pagamento");
      switch (res.payment_method ?? pm) {
        case "boleto":
          router.push(`${storePathPrefix}/boleto/${res.order_id}`);
          break;
        case "pix":
        default:
          router.push(`${storePathPrefix}/pix/${res.order_id}`);
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

  const pixDiscount = Number(settings.pix_discount_percentage ?? 1);
  const boletoDiscount = Number(settings.boleto_discount_percentage ?? 0);
  const cardDiscount = Number(settings.card_discount_percentage ?? 5);
  const discountPct = paymentMethod === "pix"
    ? pixDiscount
    : paymentMethod === "boleto"
      ? boletoDiscount
      : cardDiscount;
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
    !isPreview && step !== id && !completed.includes(id) ? "step-card-mobile-hidden" : "";

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
      <GoogleAdsTracking config={store.google_ads ?? null} />
      <MetaPixelTracking config={store.meta_pixel ?? null} />
      <TikTokPixelTracking config={store.tiktok_pixel ?? null} />
      <KwaiPixelTracking config={store.kwai_pixel ?? null} />
      <TaboolaPixelTracking config={store.taboola_pixel ?? null} />
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
      {settings.scarcity_enabled && (
        <ScarcityBar
          type={(settings.scarcity_type as "countdown" | "stock" | "visitors") || "countdown"}
          text={settings.scarcity_text}
          title={settings.scarcity_title}
          countdownMinutes={settings.scarcity_countdown_minutes || 20}
          fontColor={settings.scarcity_font_color}
          counterColor={settings.scarcity_counter_color}
          counterTextColor={settings.scarcity_counter_text_color}
        />
      )}

      {settings.banner_url && (
        <div
          className="checkout-banner-wrapper"
          style={{
            maxWidth: 1200,
            width: "100%",
            margin: "0 auto",
            padding: "24px 24px 0 24px",
          }}
        >
          <div
            style={{
              width: "100%",
              overflow: "hidden",
              borderRadius: 12,
              background: "var(--card-bg)",
            }}
          >
            <img
              src={settings.banner_url}
              alt="Banner"
              style={{
                width: "100%",
                objectFit: "contain",
                display: "block",
                borderRadius: 12,
              }}
            />
          </div>
        </div>
      )}

      {/* ── Scarcity Bar ─── */}
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
              isActive={isPreview || step === "pagamento"}
              total={displayTotal}
              pixDiscount={pixDiscount}
              boletoDiscount={boletoDiscount}
              cardDiscount={cardDiscount}
              titleFontSize={stepTitleSize}
              sdkReady={true}
              sdkError={null}
              enabledMethods={enabledMethods}
              installmentConfig={installmentConfig}
              orderBumps={data?.order_bumps ?? []}
              orderBumpDisplayMode={settings.order_bump_display_mode ?? "stacked"}
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
                shippingMessage={shippingSummaryMessage}
                total={subtotalWithBump + shippingPrice}
                discount={couponDiscount + (step === "pagamento" ? discountValue : 0)}
                title={settings.summary_title || "Resumo do pedido"}
                totalTextColor={settings.summary_total_text_color ?? "#00A37C"}
                defaultExpanded={settings.summary_default_expanded ?? true}
                showDiscount={settings.summary_show_discount ?? true}
                couponEnabled={settings.summary_coupon_enabled ?? true}
                onApplyCoupon={handleApplyCoupon}
                onRemoveCoupon={handleRemoveCoupon}
                appliedCoupon={appliedCoupon}
                applyingCoupon={applyingCoupon}
                couponError={couponError}
                onQtyChange={
                  settings.quantity_selector_enabled ?? true
                    ? handleQuantityChange
                    : undefined
                }
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
        @media (max-width: 768px) {
          .checkout-banner-wrapper {
            padding: 16px 16px 0 16px !important;
          }
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
            width: 100% !important;
            padding: 0 16px 24px 16px !important;
          }
        }
      `}</style>
    </div>
  );
}
