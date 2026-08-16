import type { InstallmentConfig } from "@/types";

export function getInstallmentRate(
  config: InstallmentConfig | undefined,
  installments: number
): number {
  if (!config || installments <= config.interest_free) return 0;

  const configuredRate =
    config.type === "custom"
      ? config.rates?.[installments - 1]
      : config.default_rate;
  const rate = Number(configuredRate ?? 0);

  return Number.isFinite(rate) && rate > 0 ? rate : 0;
}

export function calculateInstallmentValue(
  total: number,
  installments: number,
  config: InstallmentConfig | undefined
): number {
  const safeInstallments = Math.max(1, installments);
  const rate = getInstallmentRate(config, safeInstallments);
  const totalWithInterest = total * Math.pow(1 + rate / 100, safeInstallments);

  return totalWithInterest / safeInstallments;
}
