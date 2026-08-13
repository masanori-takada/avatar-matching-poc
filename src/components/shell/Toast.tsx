"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/IconSprite";

export interface ToastProps {
  text: string | null;
  onTap?: () => void;
  onClose: () => void;
  durationMs?: number;
}

/**
 * poc/index.html の .toast を移植した通知バナー。
 * role="status" aria-live="polite"、4秒で自動的に非表示になる。
 * 表示/非表示のタイマーを内部で持つため 'use client'。
 */
export function Toast({ text, onTap, onClose, durationMs = 4000 }: ToastProps) {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!text) {
      setVisible(false);
      return;
    }

    setMounted(true);
    const showFrame = requestAnimationFrame(() => setVisible(true));
    const hideTimer = setTimeout(() => setVisible(false), durationMs);

    return () => {
      cancelAnimationFrame(showFrame);
      clearTimeout(hideTimer);
    };
  }, [text, durationMs]);

  useEffect(() => {
    if (visible || !mounted) return;
    const unmountTimer = setTimeout(() => {
      setMounted(false);
      onClose();
    }, 300);
    return () => clearTimeout(unmountTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!mounted || !text) {
    return null;
  }

  return (
    <div className={visible ? "toast is-visible" : "toast"} role="status" aria-live="polite">
      <button
        type="button"
        className="toast__btn"
        onClick={() => {
          setVisible(false);
          onTap?.();
        }}
      >
        <span className="icon-circle icon-circle--sm">
          <Icon name="i-bell" />
        </span>
        <span className="toast__text">{text}</span>
      </button>
    </div>
  );
}
