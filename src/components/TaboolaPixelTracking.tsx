"use client";

import { useEffect } from "react";
import type { TaboolaPixelConfig } from "@/types";
import { loadTaboolaPixel } from "@/lib/taboolaPixel";

export default function TaboolaPixelTracking({ config }: { config?: TaboolaPixelConfig | null }) {
  useEffect(() => {
    if (!config?.enabled || !config.browser_enabled || !config.account_id) return;
    loadTaboolaPixel(config.account_id);
  }, [config?.enabled, config?.browser_enabled, config?.account_id]);
  return null;
}
