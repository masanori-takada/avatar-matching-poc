import type { ReactNode } from "react";

export interface SectionTitleProps {
  children: ReactNode;
  flush?: boolean;
}

/** poc/style.css の .section-title を移植したセクション見出し */
export function SectionTitle({ children, flush = false }: SectionTitleProps) {
  const classes = flush ? "section-title section-title--flush" : "section-title";
  return <h2 className={classes}>{children}</h2>;
}
