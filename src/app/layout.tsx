import type { Metadata } from "next";
import type { ReactNode } from "react";
import { IconSprite } from "@/components/ui/IconSprite";
import "./globals.css";

export const metadata: Metadata = {
  title: "AIアバター自動マッチング",
  description: "AIが代わりに会っている。",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <IconSprite />
        <div className="app-shell">{children}</div>
      </body>
    </html>
  );
}
