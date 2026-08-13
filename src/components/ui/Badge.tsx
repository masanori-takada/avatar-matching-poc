import type { ReactNode } from "react";

export interface BadgeProps {
  children: ReactNode;
}

/** poc/style.css の .badge を移植したピル型バッジ */
export function Badge({ children }: BadgeProps) {
  return <span className="badge">{children}</span>;
}
