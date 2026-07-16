"use client";

import { useEffect, useState } from "react";

interface ScarcityBarProps {
  type: "countdown" | "stock" | "visitors";
  text?: string | null;
  countdownMinutes?: number;
}

function formatTime(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function ScarcityBar({
  type,
  text,
  countdownMinutes = 15,
}: ScarcityBarProps) {
  const [secondsLeft, setSecondsLeft] = useState(countdownMinutes * 60);
  const [visitors] = useState(() => Math.floor(Math.random() * 30) + 15);

  useEffect(() => {
    if (type !== "countdown") return;
    setSecondsLeft(countdownMinutes * 60);
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 0) return 0;
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [type, countdownMinutes]);

  if (type === "countdown") {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          padding: "8px 16px",
          background: "linear-gradient(90deg, #ff6b35, #f7c948)",
          color: "#000",
          fontSize: "0.85rem",
          fontWeight: 600,
        }}
      >
        <span>⏰</span>
        {text && <span>{text}</span>}
        <span
          style={{
            fontVariantNumeric: "tabular-nums",
            fontWeight: 700,
            fontSize: "1rem",
          }}
        >
          {formatTime(secondsLeft)}
        </span>
      </div>
    );
  }

  if (type === "stock") {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          padding: "8px 16px",
          background: "linear-gradient(90deg, #ef4444, #f97316)",
          color: "#fff",
          fontSize: "0.85rem",
          fontWeight: 600,
        }}
      >
        <span>🔥</span>
        <span>{text || "Restam apenas poucas unidades!"}</span>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "8px 16px",
        background: "linear-gradient(90deg, #3b82f6, #06b6d4)",
        color: "#fff",
        fontSize: "0.85rem",
        fontWeight: 600,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: "#ef4444",
          display: "inline-block",
          animation: "pulse 1.5s infinite",
        }}
      />
      <span>{text || `${visitors} pessoas vendo agora`}</span>
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
    </div>
  );
}
