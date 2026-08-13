"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/IconSprite";
import { COPY } from "@/lib/constants";

interface TabDefinition {
  key: string;
  href: string;
  icon: IconName;
  label: string;
}

const TABS: readonly TabDefinition[] = [
  { key: "home", href: "/home", icon: "i-home", label: COPY.nav.home },
  { key: "mypage", href: "/mypage", icon: "i-doc", label: COPY.nav.mypage },
  { key: "messages", href: "/notifications", icon: "i-chat", label: COPY.nav.messages },
  { key: "profile", href: "/profile", icon: "i-user", label: COPY.nav.profile },
];

/**
 * poc/index.html の .tab-bar を移植した下部ナビゲーション(4タブ)。
 * 現在地の判定に usePathname を使うため 'use client'。
 */
export function TabBar() {
  const pathname = usePathname();

  return (
    <nav className="tab-bar" aria-label="メインナビゲーション">
      {TABS.map((tab) => {
        const isActive = pathname?.startsWith(tab.href) ?? false;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            className={isActive ? "tab is-active" : "tab"}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon name={tab.icon} />
            <span className="tab__label">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
