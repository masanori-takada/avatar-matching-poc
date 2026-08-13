import type { ReactNode } from "react";

export type BubbleVariant = "ai" | "self" | "typing";

export interface BubbleProps {
  variant: BubbleVariant;
  children?: ReactNode;
  who?: string;
}

/** poc/style.css の .bubble を移植したチャット吹き出し */
export function Bubble({ variant, children, who }: BubbleProps) {
  if (variant === "typing") {
    return (
      <div className="bubble bubble--ai bubble--typing" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    );
  }

  return (
    <div className={`bubble bubble--${variant}`}>
      {who ? <span className="bubble__who">{who}</span> : null}
      {children}
    </div>
  );
}
