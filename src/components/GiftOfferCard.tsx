"use client";

import { formatCurrency } from "@/lib/utils";
import type { CheckoutProduct, GiftOffer } from "@/types";

interface GiftOfferCardProps {
  gift: GiftOffer;
  cartQuantity: number;
  cartSubtotal: number;
  selectedProductId?: number;
  onSelect: (productId: number) => void;
}

export function isGiftEligible(gift: GiftOffer, cartQuantity: number, cartSubtotal: number) {
  if (gift.rule_type === "min_quantity") return cartQuantity >= Number(gift.min_quantity ?? 0);
  if (gift.rule_type === "min_value") return cartSubtotal >= Number(gift.min_value ?? 0);
  return true;
}

const productAttributes = (product: CheckoutProduct) =>
  Object.fromEntries((product.attributes ?? []).map((attribute) => [attribute.name, attribute.value]));

export default function GiftOfferCard({
  gift,
  cartQuantity,
  cartSubtotal,
  selectedProductId,
  onSelect,
}: GiftOfferCardProps) {
  const eligible = isGiftEligible(gift, cartQuantity, cartSubtotal);
  const selectedProduct = gift.products.find((product) => product.id === selectedProductId) ?? gift.products[0];
  const selectedAttributes = selectedProduct ? productAttributes(selectedProduct) : {};
  const attributeNames = Array.from(
    new Set(gift.products.flatMap((product) => (product.attributes ?? []).map((attribute) => attribute.name)))
  );

  let progress = 100;
  let message = "Você ganhou um brinde";
  if (gift.rule_type === "min_quantity") {
    const target = Math.max(1, Number(gift.min_quantity ?? 1));
    progress = Math.min(100, (cartQuantity / target) * 100);
    const remaining = Math.max(0, target - cartQuantity);
    message = remaining > 0
      ? `Adicione mais ${remaining} ${remaining === 1 ? "produto" : "produtos"} para ganhar um brinde`
      : "Você ganhou um brinde";
  }
  if (gift.rule_type === "min_value") {
    const target = Math.max(0.01, Number(gift.min_value ?? 0.01));
    progress = Math.min(100, (cartSubtotal / target) * 100);
    const remaining = Math.max(0, target - cartSubtotal);
    message = remaining > 0
      ? `Falta só ${formatCurrency(remaining)} para ganhar um brinde`
      : "Você ganhou um brinde";
  }

  const changeAttribute = (attributeName: string, value: string) => {
    const nextAttributes = { ...selectedAttributes, [attributeName]: value };
    const exact = gift.products.find((product) => {
      const attributes = productAttributes(product);
      return Object.entries(nextAttributes).every(([name, selectedValue]) => attributes[name] === selectedValue);
    });
    const fallback = gift.products.find((product) => productAttributes(product)[attributeName] === value);
    const next = exact ?? fallback;
    if (next) onSelect(next.id);
  };

  return (
    <div style={{ marginTop: 4 }}>
      <p style={{ marginBottom: 8, fontSize: "0.82rem", color: eligible ? "var(--green-primary)" : "var(--text-secondary)" }}>
        {message}
      </p>
      {gift.rule_type !== "always" && (
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
          style={{ height: 7, marginBottom: 14, overflow: "hidden", borderRadius: 999, background: "var(--gift-progress-bg-color, #E5E7EB)" }}
        >
          <div style={{ width: `${progress}%`, height: "100%", borderRadius: 999, background: "var(--gift-progress-color, #10B981)", transition: "width 180ms ease" }} />
        </div>
      )}

      <fieldset
        disabled={!eligible}
        style={{
          display: "grid",
          gridTemplateColumns: "64px minmax(0, 1fr)",
          gap: 12,
          margin: 0,
          padding: 12,
          border: "1px dashed var(--gift-border-color, #A4DFC1)",
          borderRadius: 10,
          background: "var(--gift-bg-color, #F7FFFA)",
          opacity: eligible ? 1 : 0.58,
        }}
      >
        {selectedProduct?.image_url ? (
          <img src={selectedProduct.image_url} alt={selectedProduct.parent_title || selectedProduct.name} style={{ width: 64, height: 64, borderRadius: 8, objectFit: "cover" }} />
        ) : (
          <div style={{ display: "flex", width: 64, height: 64, alignItems: "center", justifyContent: "center", borderRadius: 8, background: "var(--card-bg)", color: "var(--text-muted)", fontSize: "0.7rem", fontWeight: 700 }}>
            BRINDE
          </div>
        )}

        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <strong style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "0.85rem" }}>
              {selectedProduct?.parent_title || selectedProduct?.name || gift.name}
            </strong>
            <span style={{ flexShrink: 0, borderRadius: 6, border: "1px solid var(--gift-badge-border-color, #6EE7B7)", background: "var(--gift-badge-bg-color, #FFFFFF)", color: "var(--gift-badge-text-color, #10B981)", padding: "3px 7px", fontSize: "0.68rem", fontWeight: 600 }}>
              Brinde
            </span>
          </div>

          {attributeNames.length > 0 ? (
            <div style={{ display: "grid", gap: 7, marginTop: 9 }}>
              {attributeNames.map((attributeName) => {
                const values = Array.from(new Set(gift.products.map((product) => productAttributes(product)[attributeName]).filter(Boolean)));
                return (
                  <label key={attributeName} style={{ display: "grid", gridTemplateColumns: "64px 1fr", alignItems: "center", gap: 8, fontSize: "0.7rem", color: "var(--text-muted)" }}>
                    <span>{attributeName}</span>
                    <select
                      value={selectedAttributes[attributeName] ?? ""}
                      onChange={(event) => changeAttribute(attributeName, event.target.value)}
                      style={{ minWidth: 0, width: "100%", border: "1px solid var(--border-color)", borderRadius: 7, background: "var(--input-bg)", color: "var(--text-primary)", padding: "6px 8px", fontSize: "0.75rem" }}
                    >
                      {values.map((value) => <option key={value} value={value}>{value}</option>)}
                    </select>
                  </label>
                );
              })}
            </div>
          ) : gift.products.length > 1 ? (
            <select
              value={selectedProduct?.id ?? ""}
              onChange={(event) => onSelect(Number(event.target.value))}
              style={{ width: "100%", marginTop: 9, border: "1px solid var(--border-color)", borderRadius: 7, background: "var(--input-bg)", color: "var(--text-primary)", padding: "6px 8px", fontSize: "0.75rem" }}
            >
              {gift.products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
            </select>
          ) : null}
        </div>
      </fieldset>
    </div>
  );
}
