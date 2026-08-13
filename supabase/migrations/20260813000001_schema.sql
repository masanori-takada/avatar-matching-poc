-- =============================================================================
-- AIアバター自動マッチング — スキーマ定義
-- docs/03-data-model.md §2, §6, §7 / docs/04-api-contract.md §4 に対応
-- =============================================================================

create extension if not exists "pgcrypto";

-- =============================================================================
-- 2. テーブル定義
-- =============================================================================

-- 2.1 organizations ----------------------------------------------------------
create table public.organizations (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  display_label       text not null,
  anonymous_id_prefix text not null,
  created_at          timestamptz not null default now()
);

-- 2.2 invite_codes ------------------------------------------------------------
-- RLS は全拒否。ポリシーを一切作らない(migration 002 で RLS を有効化するのみ)。
create table public.invite_codes (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code            text not null unique,
  max_uses        integer not null default 100,
  used_count      integer not null default 0,
  expires_at      timestamptz null,
  created_at      timestamptz not null default now(),
  constraint invite_codes_used_count_nonnegative check (used_count >= 0),
  constraint invite_codes_max_uses_positive check (max_uses > 0)
);

-- 2.3 profiles -----------------------------------------------------------------
create table public.profiles (
  id                       uuid primary key references auth.users(id) on delete cascade,
  organization_id          uuid not null references public.organizations(id),
  anonymous_id             text not null unique,
  age_range                text null,
  interview_completed_at   timestamptz null,
  notifications_enabled    boolean not null default true,
  is_active                boolean not null default true,
  created_at               timestamptz not null default now()
);

create index on public.profiles (organization_id);

-- 2.4 identities — 実名情報 -----------------------------------------------------
create table public.identities (
  profile_id   uuid primary key references public.profiles(id) on delete cascade,
  full_name    text not null,
  company_name text not null,
  department   text null,
  message      text null,
  updated_at   timestamptz not null default now()
);

-- 2.5 interview_questions -------------------------------------------------------
create table public.interview_questions (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  sort_order integer not null,
  kind       text not null,
  text       text not null,
  options    jsonb not null default '[]'::jsonb,
  is_active  boolean not null default true,
  constraint interview_questions_kind_check check (kind in ('choice', 'free')),
  constraint interview_questions_options_check check (
    (kind = 'choice' and jsonb_array_length(options) >= 2)
    or
    (kind = 'free' and options = '[]'::jsonb)
  )
);

-- 2.6 interview_answers ----------------------------------------------------------
create table public.interview_answers (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  question_id uuid not null references public.interview_questions(id),
  answer      text not null,
  created_at  timestamptz not null default now(),
  constraint interview_answers_answer_not_blank check (length(btrim(answer)) > 0),
  constraint interview_answers_profile_question_unique unique (profile_id, question_id)
);

create index on public.interview_answers (profile_id);

-- 2.7 personas -----------------------------------------------------------------
create table public.personas (
  profile_id     uuid primary key references public.profiles(id) on delete cascade,
  summary        text not null,
  traits         jsonb not null,
  speaking_style text not null,
  model          text not null,
  generated_at   timestamptz not null default now()
);

-- 2.8 matches --------------------------------------------------------------------
create table public.matches (
  id             uuid primary key default gen_random_uuid(),
  profile_a_id   uuid not null references public.profiles(id) on delete cascade,
  profile_b_id   uuid not null references public.profiles(id) on delete cascade,
  status         text not null default 'pending',
  overall_score  integer null,
  attempt_count  integer not null default 0,
  last_error     text null,
  notified_at    timestamptz null,
  created_at     timestamptz not null default now(),
  constraint matches_status_check check (
    status in ('pending', 'conversed', 'evaluated', 'notified', 'mutual', 'closed', 'failed')
  ),
  constraint matches_overall_score_range check (
    overall_score is null or (overall_score >= 0 and overall_score <= 100)
  ),
  constraint matches_profile_order check (profile_a_id < profile_b_id),
  constraint matches_profile_pair_unique unique (profile_a_id, profile_b_id)
);

create index on public.matches (status);
create index on public.matches (profile_a_id);
create index on public.matches (profile_b_id);

-- 2.9 avatar_conversations ----------------------------------------------------
create table public.avatar_conversations (
  match_id     uuid primary key references public.matches(id) on delete cascade,
  turns        jsonb not null,
  time_label   text not null,
  model        text not null,
  generated_at timestamptz not null default now()
);

-- 2.10 compatibility_reports ---------------------------------------------------
create table public.compatibility_reports (
  match_id      uuid primary key references public.matches(id) on delete cascade,
  overall_score integer not null,
  axes          jsonb not null,
  summary       text not null,
  model         text not null,
  generated_at  timestamptz not null default now(),
  constraint compatibility_reports_overall_score_range check (
    overall_score >= 0 and overall_score <= 100
  )
);

-- 2.11 match_decisions -----------------------------------------------------------
create table public.match_decisions (
  id          uuid primary key default gen_random_uuid(),
  match_id    uuid not null references public.matches(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  decision    text not null,
  decided_at  timestamptz not null default now(),
  constraint match_decisions_decision_check check (decision in ('accept', 'decline')),
  constraint match_decisions_match_profile_unique unique (match_id, profile_id)
);

create index on public.match_decisions (match_id);

-- 2.12 meeting_slots ---------------------------------------------------------------
create table public.meeting_slots (
  id         uuid primary key default gen_random_uuid(),
  match_id   uuid not null references public.matches(id) on delete cascade,
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  place      text not null,
  sort_order integer not null
);

-- 2.13 slot_selections ---------------------------------------------------------------
create table public.slot_selections (
  id           uuid primary key default gen_random_uuid(),
  match_id     uuid not null references public.matches(id) on delete cascade,
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  slot_id      uuid not null references public.meeting_slots(id) on delete cascade,
  selected_at  timestamptz not null default now(),
  constraint slot_selections_match_profile_unique unique (match_id, profile_id)
);

-- 2.14 notifications -----------------------------------------------------------------
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  kind       text not null,
  title      text not null,
  body       text not null,
  match_id   uuid null references public.matches(id) on delete cascade,
  read_at    timestamptz null,
  created_at timestamptz not null default now(),
  constraint notifications_kind_check check (
    kind in ('match_found', 'report_ready', 'schedule_confirmed')
  )
);

create index on public.notifications (profile_id, read_at);

-- =============================================================================
-- 6. トリガ・関数(DB側)
-- =============================================================================

-- set_updated_at(): identities.updated_at を自動更新 -------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger identities_set_updated_at
  before update on public.identities
  for each row
  execute function public.set_updated_at();

-- assign_anonymous_id(): profiles INSERT 前に匿名IDを採番 --------------------
create function public.assign_anonymous_id()
returns trigger
language plpgsql
as $$
declare
  v_prefix text;
  v_candidate text;
  v_attempt integer := 0;
begin
  if new.anonymous_id is not null then
    return new;
  end if;

  select anonymous_id_prefix into v_prefix
  from public.organizations
  where id = new.organization_id;

  if v_prefix is null then
    v_prefix := 'USR';
  end if;

  loop
    v_attempt := v_attempt + 1;
    v_candidate := v_prefix || '-' || lpad(floor(random() * 10000)::text, 4, '0');

    if not exists (select 1 from public.profiles where anonymous_id = v_candidate) then
      new.anonymous_id := v_candidate;
      return new;
    end if;

    if v_attempt >= 10 then
      raise exception 'assign_anonymous_id: 匿名IDの採番に失敗しました(10回試行)';
    end if;
  end loop;
end;
$$;

create trigger profiles_assign_anonymous_id
  before insert on public.profiles
  for each row
  execute function public.assign_anonymous_id();

-- consume_invite_code(): 招待コードの検証と profiles 作成 --------------------
-- SECURITY DEFINER。行ロック(for update)を取り、used_count < max_uses と
-- expires_at を同一トランザクションで検査する。Server Action は service_role で
-- rpc 呼び出しするだけにする(docs/03-data-model.md §6, §4.1)
create function public.consume_invite_code(p_code text, p_user_id uuid)
returns table (organization_id uuid)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_code record;
  v_normalized text := upper(btrim(p_code));
begin
  if v_normalized = '' then
    raise exception 'INVALID_CODE' using errcode = 'P0001';
  end if;

  select * into v_code
  from public.invite_codes
  where code = v_normalized
  for update;

  if not found then
    raise exception 'INVALID_CODE' using errcode = 'P0001';
  end if;

  if v_code.expires_at is not null and v_code.expires_at < now() then
    raise exception 'EXPIRED_CODE' using errcode = 'P0002';
  end if;

  if v_code.used_count >= v_code.max_uses then
    raise exception 'EXHAUSTED_CODE' using errcode = 'P0003';
  end if;

  if exists (select 1 from public.profiles p where p.id = p_user_id) then
    raise exception 'ALREADY_REGISTERED' using errcode = 'P0004';
  end if;

  update public.invite_codes
  set used_count = used_count + 1
  where id = v_code.id;

  insert into public.profiles (id, organization_id)
  values (p_user_id, v_code.organization_id);

  return query select v_code.organization_id;
end;
$$;

-- generate_slots(): 直近3回の土日から3枠を返す --------------------------------
-- finalize_match_if_mutual から呼ばれるヘルパー。返り値は (starts_at, ends_at, place, ord)
create function public.generate_slots()
returns table (starts_at timestamptz, ends_at timestamptz, place text, ord integer)
language plpgsql
stable
as $$
declare
  v_day date := current_date;
  v_found date[] := array[]::date[];
  v_places text[] := array['刈谷市内 カフェ', '刈谷市内 カフェ', '刈谷駅前 ラウンジ'];
  v_hours integer[] := array[13, 11, 15];
  v_i integer := 0;
begin
  while array_length(v_found, 1) is null or array_length(v_found, 1) < 3 loop
    v_day := v_day + 1;
    if extract(dow from v_day) in (0, 6) then
      v_found := array_append(v_found, v_day);
    end if;
  end loop;

  for v_i in 1..3 loop
    starts_at := (v_found[v_i]::timestamp + make_interval(hours => v_hours[v_i])) at time zone 'Asia/Tokyo';
    ends_at := starts_at + interval '1 hour';
    place := v_places[v_i];
    ord := v_i;
    return next;
  end loop;
end;
$$;

-- finalize_match_if_mutual(): 相互accept時に mutual 確定 + 枠生成 + 通知作成 -----
-- SECURITY DEFINER・冪等。docs/04-api-contract.md §4 の SQL 概略に準拠
create function public.finalize_match_if_mutual(p_match_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_a uuid;
  v_b uuid;
  v_ok boolean;
begin
  select profile_a_id, profile_b_id into v_a, v_b
  from public.matches
  where id = p_match_id
  for update;

  if v_a is null then
    return false;
  end if;

  select count(*) = 2 into v_ok
  from public.match_decisions
  where match_id = p_match_id and decision = 'accept';

  if not v_ok then
    return false;
  end if;

  update public.matches set status = 'mutual' where id = p_match_id and status <> 'mutual';
  if not found then
    return true; -- 既に確定済み: 二重生成しない
  end if;

  insert into public.meeting_slots (match_id, starts_at, ends_at, place, sort_order)
  select p_match_id, s.starts_at, s.ends_at, s.place, s.ord from public.generate_slots() s;

  insert into public.notifications (profile_id, kind, title, body, match_id)
  values
    (v_a, 'schedule_confirmed', 'お互いが「会う」を選びました', '面談候補日時を選んでください。', p_match_id),
    (v_b, 'schedule_confirmed', 'お互いが「会う」を選びました', '面談候補日時を選んでください。', p_match_id);

  return true;
end;
$$;
