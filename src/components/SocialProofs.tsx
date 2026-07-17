"use client";

import React, { useState, useEffect } from "react";

const REVIEWS = [
  {
    name: "Cliente Satisfeita",
    stars: 5,
    text: "Atendimento excelente e compra rápida. Gostei muito do resultado!",
    avatar: "https://randomuser.me/api/portraits/women/44.jpg",
  },
  {
    name: "Cliente Verificada",
    stars: 4,
    text: "Produto chegou no prazo e a experiência foi incrível.",
    avatar: "https://randomuser.me/api/portraits/women/68.jpg",
  },
];

function StarRating({ count }: { count: number }) {
  return (
    <span className="review-stars" style={{ display: "flex", gap: "2px", color: "#f5a623", fontSize: "0.85rem", marginBottom: "4px" }}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i}>{i < count ? "★" : "☆"}</span>
      ))}
    </span>
  );
}

export default function SocialProofs({ className }: { className?: string }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % REVIEWS.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className={className} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <h2 style={{ fontSize: "1.1rem", fontWeight: 700 }}>Provas Sociais</h2>
      
      <div style={{ position: "relative", overflow: "hidden", borderRadius: 10 }}>
        <div 
          style={{ 
            display: "flex", 
            transition: "transform 0.5s ease-in-out",
            transform: `translateX(-${currentIndex * 100}%)`
          }}
        >
          {REVIEWS.map((review, idx) => (
            <div key={idx} style={{ minWidth: "100%", paddingRight: 4 }}>
              <div 
                className="review-card" 
                style={{ 
                  height: "100%", 
                  display: "flex", 
                  flexDirection: "column", 
                  gap: 12,
                  margin: 0,
                  boxSizing: "border-box"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", width: "100%" }}>
                  <div>
                    <StarRating count={review.stars} />
                    <div className="review-name" style={{ fontSize: "0.9rem", fontWeight: 700 }}>
                      {review.name}
                    </div>
                  </div>
                  <img
                    src={review.avatar}
                    alt={review.name}
                    className="review-avatar"
                    style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover" }}
                  />
                </div>
                <div className="review-text" style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>
                  {review.text}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 4 }}>
        {REVIEWS.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentIndex(idx)}
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              border: "none",
              background: idx === currentIndex ? "#4b5563" : "#cbd5e1",
              cursor: "pointer",
              padding: 0,
              transition: "background 0.2s ease"
            }}
            aria-label={`Ir para o depoimento ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
