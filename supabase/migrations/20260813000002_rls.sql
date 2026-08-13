-- =============================================================================
-- AIアバター自動マッチング — RLS ポリシー
-- docs/03-data-model.md §3, §4 に対応
-- =============================================================================

-- =============================================================================
-- RLS を全テーブルで有効化
-- =============================================================================

alter table public.organizations         enable row level security;
alter table public.invite_codes          enable row level security;
alter table public.profiles              enable row level security;
alter table public.identities            enable row level security;
alter table public.interview_questions   enable row level security;
alter table public.interview_answers     enable row level security;
alter table public.personas              enable row level security;
alter table public.matches               enable row level security;
alter table public.avatar_conversations  enable row level security;
alter table public.compatibility_reports enable row level security;
alter table public.match_decisions       enable row level security;
alter table public.meeting_slots         enable row level security;
alter table public.slot_selections       enable row level security;
alter table public.notifications         enable row level security;

-- =============================================================================
-- グラントを最小限に絞る
-- Supabase は既定で anon/authenticated に広い grant を与えるため、明示的に
-- revoke してから必要な権限のみ与える。RLS はテーブルに grant があって初めて
-- 意味を持つため、grant 自体は必要(ゼロにはしない)。
-- invite_codes には一切 grant しない(全拒否)。
-- =============================================================================

revoke all on all tables in schema public from anon, authenticated;

grant usage on schema public to anon, authenticated;

grant select on public.organizations to authenticated;
grant select on public.interview_questions to authenticated;

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update on public.identities to authenticated;
grant select, insert, delete on public.interview_answers to authenticated;
grant select on public.personas to authenticated;
grant select on public.matches to authenticated;
grant select on public.avatar_conversations to authenticated;
grant select on public.compatibility_reports to authenticated;
grant select, insert on public.match_decisions to authenticated;
grant select on public.meeting_slots to authenticated;
grant select, insert, update on public.slot_selections to authenticated;
grant select, update, delete on public.notifications to authenticated;

-- =============================================================================
-- SECURITY DEFINER ヘルパー(docs/03-data-model.md §3)
-- すべて SECURITY DEFINER / SET search_path = public, pg_catalog / STABLE
-- =============================================================================

-- is_match_participant: 呼び出し元がこのマッチの当事者か。
-- status が notified/mutual/closed のマッチのみを対象とする(FR-3.6)
create function public.is_match_participant(p_match_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_catalog
as $$
  select exists (
    select 1 from public.matches m
    where m.id = p_match_id
      and m.status in ('notified', 'mutual', 'closed')
      and (m.profile_a_id = auth.uid() or m.profile_b_id = auth.uid())
  );
$$;

-- is_mutual_accept: 相互accept が成立しているか(両者とも accept)
create function public.is_mutual_accept(p_match_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_catalog
as $$
  select coalesce(
    (select count(*) = 2
     from public.match_decisions
     where match_id = p_match_id and decision = 'accept'),
    false
  );
$$;

-- is_revealed_partner: 呼び出し元から見て、この profile_id は
-- 「相互acceptした相手」か。accept かどうかしか返さない(NFR-2)。
-- decline / 未判断はどちらも false になる。
create function public.is_revealed_partner(p_profile_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_catalog
as $$
  select exists (
    select 1
    from public.matches m
    join public.match_decisions da
      on da.match_id = m.id and da.profile_id = auth.uid()   and da.decision = 'accept'
    join public.match_decisions db
      on db.match_id = m.id and db.profile_id = p_profile_id and db.decision = 'accept'
    where (m.profile_a_id = auth.uid() and m.profile_b_id = p_profile_id)
       or (m.profile_b_id = auth.uid() and m.profile_a_id = p_profile_id)
  );
$$;

-- =============================================================================
-- 4.1 参加者本人のデータ
-- =============================================================================

-- organizations: 認証済み全員が読める(display_label のみ用途)
create policy organizations_select_all on public.organizations
  for select to authenticated
  using (true);

-- interview_questions: is_active = true のもののみ、全員
create policy interview_questions_select_active on public.interview_questions
  for select to authenticated
  using (is_active = true);

-- profiles: 自分 または 相互acceptした相手
create policy profiles_select_self_or_revealed on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_revealed_partner(id));

-- INSERT ポリシーなし(招待コード検証経由=service_roleのみ)

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy profiles_delete_self on public.profiles
  for delete to authenticated
  using (id = auth.uid());

-- interview_answers
create policy interview_answers_select_self on public.interview_answers
  for select to authenticated
  using (profile_id = auth.uid());

create policy interview_answers_insert_self on public.interview_answers
  for insert to authenticated
  with check (profile_id = auth.uid());

create policy interview_answers_delete_self on public.interview_answers
  for delete to authenticated
  using (profile_id = auth.uid());

-- personas: SELECT のみ(生成は service_role のバッチ専任)
create policy personas_select_self on public.personas
  for select to authenticated
  using (profile_id = auth.uid());

-- notifications
create policy notifications_select_self on public.notifications
  for select to authenticated
  using (profile_id = auth.uid());

create policy notifications_update_self on public.notifications
  for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

create policy notifications_delete_self on public.notifications
  for delete to authenticated
  using (profile_id = auth.uid());

-- invite_codes: ポリシーなし = 全拒否

-- =============================================================================
-- 4.2 identities — 匿名性の中核
-- =============================================================================

create policy identities_select_self on public.identities
  for select to authenticated
  using (profile_id = auth.uid());

create policy identities_select_revealed on public.identities
  for select to authenticated
  using (public.is_revealed_partner(profile_id));

create policy identities_insert_self on public.identities
  for insert to authenticated with check (profile_id = auth.uid());

create policy identities_update_self on public.identities
  for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- =============================================================================
-- 4.3 マッチ関連
-- =============================================================================

-- matches: pending/conversed/evaluated/failed は返さない(FR-3.6)
create policy matches_select_participant on public.matches
  for select to authenticated
  using (
    status in ('notified', 'mutual', 'closed')
    and (profile_a_id = auth.uid() or profile_b_id = auth.uid())
  );

create policy avatar_conversations_select_participant on public.avatar_conversations
  for select to authenticated
  using (public.is_match_participant(match_id));

create policy compatibility_reports_select_participant on public.compatibility_reports
  for select to authenticated
  using (public.is_match_participant(match_id));

-- match_decisions: 自分の判断のみ。相手の判断は絶対に返さない(NFR-2)
create policy match_decisions_select_self on public.match_decisions
  for select to authenticated
  using (profile_id = auth.uid());

create policy decisions_insert_self on public.match_decisions
  for insert to authenticated
  with check (
    profile_id = auth.uid()
    and public.is_match_participant(match_id)
  );
-- UPDATE / DELETE ポリシーは作らない = 判断は変更不可 (FR-5.7)

-- meeting_slots: 相互accept後のみ
create policy meeting_slots_select_mutual on public.meeting_slots
  for select to authenticated
  using (
    public.is_match_participant(match_id)
    and public.is_mutual_accept(match_id)
  );

-- slot_selections: 相互accept後は相手の選択も見せる(FR-6.5)
create policy slot_selections_select_mutual on public.slot_selections
  for select to authenticated
  using (
    public.is_match_participant(match_id)
    and public.is_mutual_accept(match_id)
  );

create policy slot_selections_upsert_self on public.slot_selections
  for insert to authenticated
  with check (
    profile_id = auth.uid()
    and public.is_mutual_accept(match_id)
    and exists (select 1 from public.meeting_slots s
                where s.id = slot_id and s.match_id = slot_selections.match_id)
  );

create policy slot_selections_update_self on public.slot_selections
  for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
