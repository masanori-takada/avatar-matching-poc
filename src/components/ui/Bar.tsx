"use client";

import { useEffect, useState } from "react";

export interface BarProps {
  score: number;
  label: string;
  neutral?: boolean;
}

/**
 * poc/style.css の .bar / .bar__fill を移植したスコアバー。
 * 表示時に width を 0 から目標値へトランジションさせる(poc/app.js animateBars 相当)。
 * 'use client': マウント後に data-score へアニメーションさせる必要があるため。
 */
export function Bar({ score, label, neutral = false }: BarProps) {
  const clamped = Math.max(0, Math.min(100, score));
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setWidth(clamped));
    return () => cancelAnimationFrame(frame);
  }, [clamped]);

  return (
    <div className="bar" role="img" aria-label={`${label} ${clamped} / 100`}>
      <div
        className={neutral ? "bar__fill bar__fill--neutral" : "bar__fill"}
        data-score={clamped}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}
