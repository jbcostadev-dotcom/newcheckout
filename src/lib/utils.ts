export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value) || 0);
}

export function getSubdomainFromHost(hostname: string): string | null {
  const baseDomain =
    process.env.NEXT_PUBLIC_CHECKOUT_BASE_DOMAIN || "bersenker.shop";

  // e.g. hostname = "nike.example.com" → subdomain = "nike"
  if (hostname.endsWith(`.${baseDomain}`)) {
    const sub = hostname.replace(`.${baseDomain}`, "");
    // ignore bare domain and www on bare domain
    if (sub && sub !== baseDomain) return sub;
  }

  // For custom domains (www.lojanike.com.br), we don't resolve here.
  // The backend resolves custom_domain → store. Return the full hostname.
  // The middleware will pass it along.
  return hostname; // Let backend figure it out
}
