"use client";

import React from "react";

export type StepId = "dados" | "entrega" | "pagamento";

interface StepperProps {
  current: StepId;
  completed: StepId[];
  onJump: (step: StepId) => void;
  primary: string;
  textColor: string;
  mutedText: string;
  borderColor: string;
}

const STEPS: { id: StepId; label: string }[] = [
  { id: "dados", label: "Dados" },
  { id: "entrega", label: "Entrega" },
  { id: "pagamento", label: "Pagamento" },
];

export default function Stepper({
  current,
  completed,
  onJump,
  primary,
  textColor,
  mutedText,
  borderColor,
}: StepperProps) {
  const currentIndex = STEPS.findIndex((s) => s.id === current);

  return (
    <div className="mb-6 flex items-center">
      {STEPS.map((step, idx) => {
        const isCurrent = step.id === current;
        const isCompleted = completed.includes(step.id);
        const isDisabled = !isCurrent && !isCompleted;
        const clickable = isCompleted || isCurrent;
        const number = idx + 1;

        const bg = isCurrent || isCompleted ? primary : "transparent";
        const fg = isCurrent || isCompleted ? "#fff" : textColor;
        const border = isCurrent || isCompleted ? primary : borderColor;

        const line = idx < STEPS.length - 1;
        const lineDone = idx < currentIndex;

        return (
          <React.Fragment key={step.id}>
            <button
              type="button"
              disabled={isDisabled}
              onClick={() => clickable && onJump(step.id)}
              className="flex items-center gap-2"
              style={{
                cursor: isDisabled ? "not-allowed" : "pointer",
                opacity: isDisabled ? 0.55 : 1,
                background: "transparent",
                border: "none",
                padding: 0,
              }}
            >
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold"
                style={{ background: bg, color: fg, border: `2px solid ${border}` }}
              >
                {isCompleted ? (
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  number
                )}
              </span>
              <span
                className="hidden text-sm font-medium sm:inline"
                style={{ color: isCurrent ? textColor : mutedText }}
              >
                {step.label}
              </span>
            </button>
            {line && (
              <div
                className="mx-2 h-0.5 flex-1"
                style={{ background: lineDone ? primary : borderColor }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}