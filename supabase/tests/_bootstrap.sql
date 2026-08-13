-- =============================================================================
-- RLS 検証用のローカルブートストラップ
--
-- Supabase のマネージド環境が用意している部分（ロール、auth スキーマ、
-- auth.uid()、PostgREST のロール切替）を素の PostgreSQL 上で最小限に再現する。
-- 本番のマイグレーションはこのファイルの後に、無改変で適用する。
--
--   使い方:
--     psql -f supabase/tests/_bootstrap.sql
--     psql -f supabase/migrations/20260813000001_schema.sql
--     psql -f supabase/migrations/20260813000002_rls.sql
--     psql -f supabase/migrations/20260813000003_seed_questions.sql
--     psql -f supabase/tests/rls.sql
-- =============================================================================

create extension if not exists pgcrypto;

-- Supabase が用意しているロール
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end $$;

grant anon, authenticated, service_role to postgres;

create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;

-- GoTrue の users テーブルのうち、本アプリが外部キーで参照する部分だけ
create table if not exists auth.users (
  id    uuid primary key default gen_random_uuid(),
  email text unique
);

-- Supabase 本番と同じく、リクエストのJWTクレームから sub を取り出す。
-- PostgREST は request.jwt.claims をセットしてからクエリを実行する。
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(
    coalesce(
      current_setting('request.jwt.claim.sub', true),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    ),
    ''
  )::uuid;
$$;

grant execute on function auth.uid() to anon, authenticated, service_role;

-- テストから「そのユーザーとしてリクエストする」を再現するためのヘルパー。
-- PostgREST が行っていること（ロール切替 + クレーム設定）と等価。
create or replace function public.test_login(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user_id)::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function public.test_logout()
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', '', true);
  execute 'reset role';
end $$;
