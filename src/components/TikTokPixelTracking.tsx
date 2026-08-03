"use client";

import { useEffect } from "react";
import type { TikTokPixelConfig } from "@/types";
import { loadTikTokPixel, readTikTokConsent } from "@/lib/tiktokPixel";

export default function TikTokPixelTracking({ config }: { config?: TikTokPixelConfig | null }) {
  useEffect(() => {
    if (!config?.enabled || !config.browser_enabled || !config.pixel_code || (config.require_consent && !readTikTokConsent())) return;
    loadTikTokPixel(config.pixel_code);
  }, [config?.enabled, config?.browser_enabled, config?.pixel_code, config?.require_consent]);

  return null;
}
