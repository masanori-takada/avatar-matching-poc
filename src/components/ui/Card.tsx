import type { HTMLAttributes, ReactNode } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

/** poc/style.css の .card を移植したカードコンテナ */
export function Card({ children, className, ...rest }: CardProps) {
  const classes = className ? `card ${className}` : "card";
  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  );
}
