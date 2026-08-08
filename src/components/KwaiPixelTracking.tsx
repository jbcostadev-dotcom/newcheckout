"use client";

import { useEffect } from "react";
import type { KwaiPixelConfig } from "@/types";
import { loadKwaiPixel } from "@/lib/kwaiPixel";

export default function KwaiPixelTracking({ config }: { config?: KwaiPixelConfig | null }) {
  useEffect(() => {
    if (!config?.enabled || !config.browser_enabled || !config.pixel_code) return;
    loadKwaiPixel(config.pixel_code);
  }, [config?.enabled, config?.browser_enabled, config?.pixel_code]);

  return null;
}
