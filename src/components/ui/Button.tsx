import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger" | "link";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "btn btn--primary",
  secondary: "btn btn--secondary",
  danger: "btn btn--danger",
  link: "btn-link",
};

/** poc/style.css の .btn / .btn-link を移植したボタン */
export function Button({ variant = "primary", className, type = "button", ...rest }: ButtonProps) {
  const base = VARIANT_CLASS[variant];
  const classes = className ? `${base} ${className}` : base;
  return <button type={type} className={classes} {...rest} />;
}
