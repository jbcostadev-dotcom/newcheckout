"use client";

import React, { useState, useEffect } from "react";
import type { SocialProofItem } from "@/types";

function StarRating({ count }: { count: number }) {
  return (
    <span className="review-stars" style={{ display: "flex", gap: "2px", color: "#f5a623", fontSize: "0.85rem", marginBottom: "4px" }}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i}>{i < count ? "★" : "☆"}</span>
      ))}
    </span>
  );
}

interface SocialProofsProps {
  className?: string;
  reviews?: SocialProofItem[];
}

export default function SocialProofs({ className, reviews }: SocialProofsProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const items = reviews && reviews.length > 0 ? reviews : [];

  useEffect(() => {
    if (items.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [items.length]);

  if (items.length === 0) return null;

  return (
    <div className={className} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ position: "relative", overflow: "hidden", borderRadius: 10 }}>
        <div 
          style={{ 
            display: "flex", 
            transition: "transform 0.5s ease-in-out",
            transform: `translateX(-${currentIndex * 100}%)`
          }}
        >
          {items.map((review, idx) => (
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
                  {review.photo_url ? (
                    <img
                      src={review.photo_url}
                      alt={review.name}
                      className="review-avatar"
                      style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover" }}
                    />
                  ) : (
                    <div
                      className="review-avatar"
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: "50%",
                        background: "var(--border-color, #e0e0e0)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "1.1rem",
                        fontWeight: 700,
                        color: "var(--text-secondary, #666)",
                      }}
                    >
                      {review.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="review-text" style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>
                  {review.testimonial}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {items.length > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 4 }}>
          {items.map((_, idx) => (
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
      )}
    </div>
  );
}
