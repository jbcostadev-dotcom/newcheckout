import { NextRequest, NextResponse } from "next/server";

const BASE_DOMAIN =
  process.env.NEXT_PUBLIC_CHECKOUT_BASE_DOMAIN || "bersenker.shop";
const CHECKOUT_APP_DOMAIN =
  process.env.NEXT_PUBLIC_CHECKOUT_APP_DOMAIN || `checkout.${BASE_DOMAIN}`;
const ADMIN_DOMAIN =
  process.env.NEXT_PUBLIC_ADMIN_DOMAIN || `app.${BASE_DOMAIN}`;
const API_DOMAIN =
  process.env.NEXT_PUBLIC_API_DOMAIN || `api.${BASE_DOMAIN}`;

const RESERVED = new Set([
  BASE_DOMAIN,
  `www.${BASE_DOMAIN}`,
  CHECKOUT_APP_DOMAIN,
  `www.${CHECKOUT_APP_DOMAIN}`,
  ADMIN_DOMAIN,
  API_DOMAIN,
  "localhost",
]);

/**
 * Middleware: extracts the store identifier from:
 * 1. Path: /{store}/checkout/{id} → store from path
 * 2. Host: custom domain → store resolved by backend via custom_domain
 *
 * - checkout.example.com/nike/checkout/1 → store = "nike" (from path)
 * - www.lojanike.com.br/checkout/1 → store = "www.lojanike.com.br" (from host, backend resolves)
 */
export function middleware(request: NextRequest) {
  const hostname = request.headers.get("host")?.split(":")[0] ?? "";
  const pathname = request.nextUrl.pathname;

  if (RESERVED.has(hostname)) {
    return NextResponse.next();
  }

  const requestHeaders = new Headers(request.headers);

  // Case 1: checkout.bersenker.shop/{store}/checkout/{id} — extract store from path
  if (hostname === CHECKOUT_APP_DOMAIN || hostname === `www.${CHECKOUT_APP_DOMAIN}`) {
    const match = pathname.match(/^\/([^/]+)\/checkout\/.+/);
    if (match && match[1]) {
      requestHeaders.set("x-store-identifier", match[1]);
    }
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // Case 2: Custom domain / store subdomain — rewrite /checkout/{id} to /{store}/checkout/{id}
  let storeIdentifier: string | null = null;

  if (hostname.endsWith(`.${BASE_DOMAIN}`)) {
    const sub = hostname.replace(`.${BASE_DOMAIN}`, "");
    if (sub && sub.length > 0 && sub !== CHECKOUT_APP_DOMAIN.split(".")[0]) {
      storeIdentifier = sub;
    }
  } else {
    storeIdentifier = hostname;
  }

  if (storeIdentifier) {
    requestHeaders.set("x-store-identifier", storeIdentifier);

    // Domínios customizados e subdomínios de loja não têm o slug no path,
    // então reescrevemos internamente para a rota dinâmica existente.
    const checkoutMatch = pathname.match(/^\/checkout\/.+/);
    if (checkoutMatch) {
      const newUrl = new URL(request.url);
      newUrl.pathname = `/${storeIdentifier}${pathname}`;
      return NextResponse.rewrite(newUrl, { request: { headers: requestHeaders } });
    }
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"],
};
