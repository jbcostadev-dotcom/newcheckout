"use client";

import React from "react";

interface FooterProps {
  mutedText: string;
  cardBg: string;
  borderColor: string;
}

export default function Footer({ mutedText, cardBg, borderColor }: FooterProps) {
  const badge = (label: string, color: string) => (
    <span
      className="rounded px-2 py-0.5 text-[11px] font-semibold"
      style={{
        background: "transparent",
        border: `1px solid ${color}`,
        color: mutedText,
      }}
    >
      {label}
    </span>
  );

  return (
    <footer
      className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 text-xs"
      style={{
        color: mutedText,
        background: cardBg,
        borderTop: `1px solid ${borderColor}`,
      }}
    >
      <span className="flex items-center gap-2">
        <span aria-hidden>🔒</span>
        <span>Ambiente Seguro · SSL Criptografado</span>
      </span>
      <span className="flex items-center gap-2">
        {badge("Pix", "rgb(34,197,94)")}
        {badge("Cartão", "rgb(59,130,246)")}
      </span>
    </footer>
  );
}