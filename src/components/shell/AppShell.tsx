import type { ReactNode } from "react";
import { AppHeader } from "@/components/shell/AppHeader";
import { TabBar } from "@/components/shell/TabBar";

export interface AppShellProps {
  unreadCount?: number;
  children: ReactNode;
}

/**
 * ヘッダー + ビューポート + タブバーを持つ、登録済み参加者向け画面の共通シェル
 * (poc/index.html の appHeader/viewport/tabBar 相当)。
 */
export function AppShell({ unreadCount = 0, children }: AppShellProps) {
  return (
    <>
      <AppHeader unreadCount={unreadCount} />
      <main className="app-viewport">{children}</main>
      <TabBar />
    </>
  );
}
