"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";

export interface ConfirmSheetProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * poc/index.html の .sheet を移植したボトムシート確認ダイアログ。
 * `window.confirm` は使わない(NFR-6)。role="dialog" aria-modal="true"、
 * 開いたときにタイトルへフォーカスを移し、Escape で閉じる。
 */
export function ConfirmSheet({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = "キャンセル",
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmSheetProps) {
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (open) {
      titleRef.current?.focus({ preventScroll: true });
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCancel();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onCancel]);

  if (!open) {
    return null;
  }

  return (
    <div className="sheet">
      <button type="button" className="sheet__backdrop" aria-label="閉じる" onClick={onCancel} />
      <div className="sheet__panel" role="dialog" aria-modal="true" aria-labelledby="sheetTitle">
        <h2 className="sheet__title" id="sheetTitle" tabIndex={-1} ref={titleRef}>
          {title}
        </h2>
        <p className="sheet__message">{message}</p>
        <Button
          variant="primary"
          className={danger ? "is-danger" : undefined}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          {cancelLabel}
        </Button>
      </div>
    </div>
  );
}
