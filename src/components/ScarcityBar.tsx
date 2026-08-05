"use client";

import { useEffect, useState } from "react";

interface ScarcityBarProps {
  type: "countdown" | "stock" | "visitors";
  text?: string | null;
  title?: string | null;
  countdownMinutes?: number;
}

function formatTime(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function ScarcityBar({ type, text, title, countdownMinutes = 20 }: ScarcityBarProps) {
  const [secondsLeft, setSecondsLeft] = useState(countdownMinutes * 60);
  const [visitors] = useState(() => Math.floor(Math.random() * 30) + 15);

  useEffect(() => {
    if (type !== "countdown") return;
    setSecondsLeft(countdownMinutes * 60);
    const interval = setInterval(() => setSecondsLeft((previous) => Math.max(0, previous - 1)), 1000);
    return () => clearInterval(interval);
  }, [type, countdownMinutes]);

  if (type === "countdown") {
    return (
      <div style={{ padding: "24px 16px 22px", background: "#fff", color: "#000", textAlign: "center" }}>
        <div style={{ fontSize: "1.45rem", fontWeight: 700, marginBottom: 12 }}>
          {title || "Frete grátis apenas hoje!"}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: "1rem" }}>
          <span>{text || "Você precisa finalizar seu pedido em até"}</span>
          <span style={{ background: "#000", borderRadius: 4, color: "#fff", fontVariantNumeric: "tabular-nums", fontWeight: 700, fontSize: "1rem", padding: "3px 7px" }}>
            {formatTime(secondsLeft)}
          </span>
        </div>
      </div>
    );
  }

  if (type === "stock") {
    return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "8px 16px", background: "linear-gradient(90deg, #ef4444, #f97316)", color: "#fff", fontSize: "0.85rem", fontWeight: 600 }}><span>🔥</span><span>{text || "Restam apenas poucas unidades!"}</span></div>;
  }

  return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "8px 16px", background: "linear-gradient(90deg, #3b82f6, #06b6d4)", color: "#fff", fontSize: "0.85rem", fontWeight: 600 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444", display: "inline-block", animation: "pulse 1.5s infinite" }} /><span>{text || `${visitors} pessoas vendo agora`}</span><style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style></div>;
}
