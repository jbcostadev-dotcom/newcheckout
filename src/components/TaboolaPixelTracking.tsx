"use client";

import { useEffect } from "react";
import type { TaboolaPixelConfig } from "@/types";
import { loadTaboolaPixel, readTaboolaConsent } from "@/lib/taboolaPixel";

export default function TaboolaPixelTracking({ config }: { config?: TaboolaPixelConfig | null }) {
  useEffect(() => {
    if (!config?.enabled || !config.browser_enabled || !config.account_id || (config.require_consent && !readTaboolaConsent())) return;
    loadTaboolaPixel(config.account_id);
  }, [config?.enabled, config?.browser_enabled, config?.account_id, config?.require_consent]);
  return null;
}
