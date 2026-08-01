"use client";

import { useEffect } from "react";
import type { GoogleAdsConfig } from "@/types";
import { loadGoogleAds, trackPageView } from "@/lib/googleAds";

/**
 * Carrega o script do gtag.js e dispara o page_view na montagem.
 * Renderiza `null`; sem impacto visual.
 */
export default function GoogleAdsTracking({
  config,
}: {
  config?: GoogleAdsConfig | null;
}) {
  useEffect(() => {
    if (!config?.enabled || !config.pixel_id) return;
    loadGoogleAds(config.pixel_id);
    trackPageView(config.pixel_id);
  }, [config?.enabled, config?.pixel_id]);

  return null;
}