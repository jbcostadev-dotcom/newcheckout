"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import PixPaymentView, { type PixPaymentSettings } from "@/components/PixPaymentView";
import Loading from "../[orderId]/loading";

const PREVIEW_COPIA_E_COLA = "00020126580014br.gov.bcb.pix0136dummy00000000000000000000000000000000";
const PREVIEW_TOTAL = 99.9;
const SETTINGS_STORAGE_KEY = "pix_page_settings";

export default function PixPreviewPage() {
  return (
    <Suspense fallback={<Loading />}>
      <PixPreviewContent />
    </Suspense>
  );
}

function PixPreviewContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const storeSlug = params.store as string;

  const isPreview = searchParams.get("preview") === "1";
  const [mounted, setMounted] = useState(false);
  const [isInsideIframe, setIsInsideIframe] = useState(false);
  const [settings, setSettings] = useState<PixPaymentSettings>({});

  useEffect(() => {
    setMounted(true);
    setIsInsideIframe(window.self !== window.top);

    try {
      const raw = sessionStorage.getItem(SETTINGS_STORAGE_KEY);
      if (raw) {
        setSettings(JSON.parse(raw));
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  if (!mounted) {
    return <Loading />;
  }

  if (!isPreview || !isInsideIframe) {
    return (
      <div
        style={{
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--checkout-bg)",
          padding: 24,
          textAlign: "center",
        }}
      >
        <div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary)" }}>
            Acesso não permitido
          </h2>
          <p style={{ marginTop: 8, fontSize: "0.9rem", color: "var(--text-muted)" }}>
            Esta visualização só está disponível dentro do editor do checkout.
          </p>
        </div>
      </div>
    );
  }

  return (
    <PixPaymentView
      storeName={storeSlug ? storeSlug.charAt(0).toUpperCase() + storeSlug.slice(1) : "Nome da Loja"}
      total={PREVIEW_TOTAL}
      copiaECola={PREVIEW_COPIA_E_COLA}
      createdAt={new Date().toISOString()}
      isPreview
      initialSettings={settings}
      onBackToCheckout={() => router.push(`/${storeSlug}/checkout?preview=1`)}
    />
  );
}
