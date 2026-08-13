"use client";

import { useEffect, useRef } from "react";
import { Icon } from "@/components/ui/IconSprite";
import type { ReactNode } from "react";

export interface RevealCardProps {
  children: ReactNode;
}

/**
 * 実名開示カード(poc/app.js renderers.reveal)。
 * マウント後に `.is-shown` を付与し、下からのフェードイン+スライドアップを再生する。
 * `prefers-reduced-motion` のときは即座に最終状態を適用する(NFR-5)。
 * マウント時アニメーションのため 'use client'。
 */
export function RevealCard({ children }: RevealCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      node.classList.add("is-shown");
      return;
    }

    const frame = requestAnimationFrame(() => {
      node.classList.add("is-shown");
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="card reveal-card" ref={ref}>
      <span className="icon-circle icon-circle--lg">
        <Icon name="i-user" className="icon--lg" />
      </span>
      {children}
    </div>
  );
}
