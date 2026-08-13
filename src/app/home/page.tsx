import Link from "next/link";
import { requireInterviewed } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/IconSprite";
import { Steps } from "@/components/ui/Steps";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { COPY } from "@/lib/constants";
import {
  currentStepIndex,
  loadHomeState,
  statusActionLabel,
  statusTargetHref,
  statusText,
} from "@/lib/status";
import type { NotificationKind } from "@/types/domain";

/**
 * 認証Cookieに依存するため、静的プリレンダリングの対象から外す。
 */
export const dynamic = "force-dynamic";

const NOTICE_ICON: Record<NotificationKind, "i-bell" | "i-doc" | "i-calendar"> = {
  match_found: "i-bell",
  report_ready: "i-doc",
  schedule_confirmed: "i-calendar",
};

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMinutes < 60) return `${diffMinutes}分前`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}時間前`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}日前`;
}

/**
 * ホーム画面(docs/06-implementation-plan.md フェーズ4, FR-8.1)。
 */
export default async function HomePage() {
  const profile = await requireInterviewed();
  const supabase = await createClient();

  const [{ data: notifications }, { count: unreadCount }, state] = await Promise.all([
    supabase
      .from("notifications")
      .select("id, kind, title, body, match_id, read_at, created_at")
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(2),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", profile.id)
      .is("read_at", null),
    loadHomeState(supabase, profile.id),
  ]);

  const { hasVisibleMatch, latestMatchId } = state;
  const stepIndex = currentStepIndex(state);

  const homeMenu = [
    {
      icon: "i-doc" as const,
      label: "会話ログ・相性レポート",
      href: hasVisibleMatch && latestMatchId ? `/matches/${latestMatchId}` : "/notifications",
    },
    { icon: "i-shield" as const, label: "プライバシーについて", href: "/privacy" },
    { icon: "i-help" as const, label: "よくある質問", href: "/faq" },
    { icon: "i-gear" as const, label: "設定", href: "/settings" },
  ];

  return (
    <AppShell unreadCount={unreadCount ?? 0}>
      <div className="hero">
        <div className="hero__text">
          <h1 className="hero-title" tabIndex={-1}>
            {COPY.home.heroTitle}
          </h1>
          <p className="hero__lead">{COPY.home.heroLead}</p>
        </div>
        <div className="hero__art">
          <Icon name="i-avatar-pair" className="hero__icon" />
        </div>
      </div>

      <Card className="status-card">
        <div className="status-card__head">
          <span className="icon-circle">
            <Icon name="i-avatar-pair" />
          </span>
          <div>
            <p className="card-title">{COPY.home.statusCardTitle}</p>
            <p className="text-body">{statusText(state)}</p>
          </div>
        </div>
        <Steps currentIndex={stepIndex} />
        <Link href={statusTargetHref(state)} className="btn btn--secondary home__status-cta">
          {statusActionLabel(state)}
        </Link>
      </Card>

      <Card>
        <div className="card__head">
          <SectionTitle flush>{COPY.home.noticeTitle}</SectionTitle>
          <Link href="/notifications" className="btn-link">
            {COPY.home.noticeSeeAll}
          </Link>
        </div>
        {notifications && notifications.length > 0 ? (
          notifications.map((item) => (
            <Link
              key={item.id}
              href={item.match_id ? `/matches/${item.match_id}` : "/notifications"}
              className="notice-row"
            >
              <span className="icon-circle">
                <Icon name={NOTICE_ICON[item.kind]} />
              </span>
              <span className="notice-row__body">
                <span className="card-title">{item.title}</span>
                <span className="notice__time">{formatRelativeTime(item.created_at)}</span>
              </span>
              <Icon name="i-chevron" className="notice__chevron" />
            </Link>
          ))
        ) : (
          <p className="text-body">{COPY.home.noticeEmpty}</p>
        )}
      </Card>

      <div className="menu-grid">
        {homeMenu.map((item) => (
          <Link key={item.href} href={item.href} className="menu-item">
            <span className="icon-circle">
              <Icon name={item.icon} />
            </span>
            <span className="menu-item__label">{item.label}</span>
          </Link>
        ))}
      </div>

      <Link href="/privacy" className="card banner">
        <span className="icon-circle">
          <Icon name="i-lock" />
        </span>
        <span className="banner__body">
          <span className="card-title">{COPY.home.bannerTitle}</span>
          <span className="text-body">{COPY.home.bannerBody}</span>
        </span>
      </Link>
    </AppShell>
  );
}
