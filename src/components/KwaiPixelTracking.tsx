"use client";

import { useEffect } from "react";
import type { KwaiPixelConfig } from "@/types";
import { loadKwaiPixel, readKwaiConsent } from "@/lib/kwaiPixel";

export default function KwaiPixelTracking({ config }: { config?: KwaiPixelConfig | null }) {
  useEffect(() => {
    if (!config?.enabled || !config.browser_enabled || !config.pixel_code || (config.require_consent && !readKwaiConsent())) return;
    loadKwaiPixel(config.pixel_code);
  }, [config?.enabled, config?.browser_enabled, config?.pixel_code, config?.require_consent]);

  return null;
}
