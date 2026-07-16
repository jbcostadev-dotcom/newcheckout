"use client";

import React from "react";
import { formatCurrency } from "@/lib/utils";
import type { CheckoutProduct } from "@/types";

export interface GroupedItem {
  product: CheckoutProduct;
  qty: number;
}

interface OrderSummaryProps {
  items: GroupedItem[];
  total: number;
  primary: string;
  mutedText: string;
  borderColor: string;
  inputBg: string;
}

export default function OrderSummary({
  items,
  total,
  primary,
  mutedText,
  borderColor,
  inputBg,
}: OrderSummaryProps) {
  return (
    <div>
      <h2 className="mb-6 text-lg font-bold">Resumo do Pedido</h2>

      <div className="space-y-3">
        {items.map((g) => (
          <div
            key={g.product.id}
            className="flex items-center gap-3 pb-3"
            style={{ borderBottom: `1px solid ${borderColor}` }}
          >
            {g.product.image_url ? (
              <img
                src={g.product.image_url}
                alt={g.product.name}
                className="h-12 w-12 rounded-lg object-cover"
              />
            ) : (
              <div
                className="flex h-12 w-12 items-center justify-center rounded-lg"
                style={{ background: inputBg }}
              >
                <svg
                  className="h-5 w-5"
                  style={{ color: mutedText }}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                  />
                </svg>
              </div>
            )}
            <div className="flex-1">
              <h3 className="text-sm font-semibold">{g.product.name}</h3>
              <p style={{ color: mutedText }} className="text-xs">
                {g.qty > 1 ? `${g.qty}× ` : ""}
                {formatCurrency(Number(g.product.price))}
              </p>
            </div>
            <span className="text-sm font-medium">
              {formatCurrency(Number(g.product.price) * g.qty)}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-2" style={{ color: mutedText }}>
        <div className="flex justify-between text-sm">
          <span>Subtotal</span>
          <span>{formatCurrency(total)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>Frete</span>
          <span>Grátis</span>
        </div>
      </div>
      <div
        className="mt-4 flex justify-between text-lg font-bold"
        style={{ borderTop: `1px solid ${borderColor}`, paddingTop: 16 }}
      >
        <span>Total</span>
        <span style={{ color: primary }}>{formatCurrency(total)}</span>
      </div>
    </div>
  );
}