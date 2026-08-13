"use client";

import { useId, type InputHTMLAttributes } from "react";

export interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  error?: string | null;
  hideLabel?: boolean;
}

/**
 * poc/style.css の .field__label / .field__input / .field__error を移植した
 * ラベル付き入力欄。エラー状態の切り替えがあるため 'use client'。
 */
export function Field({ label, error, hideLabel = false, className, ...rest }: FieldProps) {
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const inputClasses = ["field__input", error ? "is-error" : "", className ?? ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div>
      <label className={hideLabel ? "sr-only" : "field__label"} htmlFor={inputId}>
        {label}
      </label>
      <input
        id={inputId}
        className={inputClasses}
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? true : undefined}
        {...rest}
      />
      {error ? (
        <p className="field__error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
