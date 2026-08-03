"use client";

import { useEffect } from "react";
import type { MetaPixelConfig } from "@/types";
import { loadMetaPixel, readMetaConsent } from "@/lib/metaPixel";

export default function MetaPixelTracking({ config }: { config?: MetaPixelConfig | null }) {
  useEffect(() => {
    if (!config?.enabled || !config.browser_enabled || !config.pixel_id || (config.require_consent && !readMetaConsent())) return;
    loadMetaPixel(config.pixel_id);
  }, [config?.enabled, config?.browser_enabled, config?.pixel_id]);

  return null;
}
