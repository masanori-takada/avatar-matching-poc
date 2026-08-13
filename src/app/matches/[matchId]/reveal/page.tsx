import { redirect } from "next/navigation";
import { requireInterviewed } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { RevealCard } from "@/components/feature/RevealCard";
import { SlotPicker } from "@/components/feature/SlotPicker";
import { COPY } from "@/lib/constants";
import type { MeetingSlot } from "@/types/domain";

/**
 * 認証Cookieに依存するため、静的プリレンダリングの対象から外す。
 */
export const dynamic = "force-dynamic";

interface RevealPageProps {
  params: Promise<{ matchId: string }>;
}

/**
 * 実名開示・面談日程画面(docs/04-api-contract.md §5, docs/03-data-model.md §2.12〜2.13, FR-6)。
 *
 * 3つの状態:
 * 1. 自分が accept していない → /matches/[matchId] へリダイレクト
 * 2. accept済みだが相互未成立 → 待機表示(相手の判断状況は問い合わせない。NFR-2)
 * 3. mutual → identities/profiles(RLS越し)から開示情報、meeting_slots から候補日時
 */
export default async function RevealPage({ params }: RevealPageProps) {
  const { matchId } = await params;
  const profile = await requireInterviewed();
  const supabase = await createClient();

  const { count: unreadCount } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profile.id)
    .is("read_at", null);

  const { data: ownDecisionRow } = await supabase
    .from("match_decisions")
    .select("decision")
    .eq("match_id", matchId)
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (ownDecisionRow?.decision !== "accept") {
    redirect(`/matches/${matchId}`);
  }

  function renderWaiting() {
    return (
      <AppShell unreadCount={unreadCount ?? 0}>
        <h1 className="screen-title" tabIndex={-1}>
          {COPY.reveal.waitingPartnerTitle}
        </h1>
        <Card>
          <p className="text-body">{COPY.reveal.waitingPartnerBody}</p>
        </Card>
      </AppShell>
    );
  }

  // matches の SELECT ポリシーは notified/mutual/closed のみ返す
  // (自分の accept 行が既にあるため、少なくとも notified 以上のはず)。
  const { data: match } = await supabase
    .from("matches")
    .select("id, profile_a_id, profile_b_id, status")
    .eq("id", matchId)
    .maybeSingle();

  if (!match || match.status !== "mutual") {
    return renderWaiting();
  }

  const partnerId = match.profile_a_id === profile.id ? match.profile_b_id : match.profile_a_id;

  const [{ data: identity }, { data: partnerProfile }, { data: slotRows }, { data: ownSelection }] =
    await Promise.all([
      supabase
        .from("identities")
        .select("full_name, company_name, department, message")
        .eq("profile_id", partnerId)
        .maybeSingle(),
      supabase.from("profiles").select("age_range").eq("id", partnerId).maybeSingle(),
      supabase
        .from("meeting_slots")
        .select("id, match_id, starts_at, ends_at, place, sort_order")
        .eq("match_id", matchId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("slot_selections")
        .select("slot_id")
        .eq("match_id", matchId)
        .eq("profile_id", profile.id)
        .maybeSingle(),
    ]);

  // RLS 越しに 0 行が返るケース(競合等)はクラッシュさせず待機表示にする。
  if (!identity) {
    return renderWaiting();
  }

  const slots: MeetingSlot[] = (slotRows ?? []).map((row) => ({
    id: row.id,
    matchId: row.match_id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    place: row.place,
    sortOrder: row.sort_order,
  }));

  return (
    <AppShell unreadCount={unreadCount ?? 0}>
      <h1 className="screen-title" tabIndex={-1}>
        {COPY.reveal.title}
      </h1>

      <RevealCard>
        <dl className="reveal-list">
          <div className="reveal-row">
            <dt>{COPY.reveal.nameLabel}</dt>
            <dd>{identity.full_name}</dd>
          </div>
          <div className="reveal-row">
            <dt>{COPY.reveal.companyLabel}</dt>
            <dd>
              {identity.company_name}
              {identity.department ? ` / ${identity.department}` : ""}
            </dd>
          </div>
          <div className="reveal-row">
            <dt>{COPY.reveal.ageRangeLabel}</dt>
            <dd>{partnerProfile?.age_range ?? COPY.reveal.unknownValue}</dd>
          </div>
          <div className="reveal-row">
            <dt>{COPY.reveal.messageLabel}</dt>
            <dd>{identity.message ?? COPY.reveal.unknownValue}</dd>
          </div>
        </dl>
      </RevealCard>

      <SectionTitle>{COPY.reveal.slotsTitle}</SectionTitle>

      <SlotPicker
        matchId={matchId}
        slots={slots}
        initialSelectedSlotId={ownSelection?.slot_id ?? null}
      />

      <p className="text-note">{COPY.reveal.note}</p>
    </AppShell>
  );
}
