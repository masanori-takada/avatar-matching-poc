-- =============================================================================
-- AIアバター自動マッチング — RLS 検証スクリプト
-- docs/03-data-model.md §8 に対応。
--
-- 自前でフィクスチャを作り、各ケースを assert する。失敗した時点で
-- 例外を投げて中断するので、最後まで流れて "ALL RLS CHECKS PASSED" が
-- 出れば全ケース合格。データは最後にロールバックされる。
--
--   ローカルの素の PostgreSQL で流す場合:
--     psql -f supabase/tests/_bootstrap.sql
--     psql -f supabase/migrations/20260813000001_schema.sql
--     psql -f supabase/migrations/20260813000002_rls.sql
--     psql -f supabase/migrations/20260813000003_seed_questions.sql
--     psql -f supabase/tests/rls.sql
--
--   `supabase start` のローカルスタックで流す場合:
--     psql "$(supabase status -o env | grep DB_URL | cut -d= -f2)" \
--       -f supabase/tests/_bootstrap.sql -f supabase/tests/rls.sql
--     (_bootstrap は test_login/test_logout ヘルパーのみ使う。
--      auth スキーマと各ロールは Supabase 側に既にあるため create は skip される)
-- =============================================================================

\set ON_ERROR_STOP on

begin;

-- -----------------------------------------------------------------------------
-- assert ヘルパー
-- -----------------------------------------------------------------------------
create or replace function pg_temp.assert_eq(
  p_actual bigint, p_expected bigint, p_label text
) returns void language plpgsql as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'FAIL: % — 期待 %, 実際 %', p_label, p_expected, p_actual;
  end if;
  raise notice 'ok: % (= %)', p_label, p_actual;
end $$;

create or replace function pg_temp.assert_raises(p_sql text, p_label text)
returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    raise notice 'ok: % (拒否された: %)', p_label, sqlerrm;
    return;
  end;
  raise exception 'FAIL: % — 拒否されるべき操作が成功した', p_label;
end $$;

-- -----------------------------------------------------------------------------
-- フィクスチャ: 別組織の参加者 A / B と、通知済みのマッチ 1件
-- -----------------------------------------------------------------------------
\set user_a '11111111-1111-1111-1111-111111111111'
\set user_b '22222222-2222-2222-2222-222222222222'
\set user_c '33333333-3333-3333-3333-333333333333'

insert into auth.users (id, email) values
  (:'user_a', 'a@example.test'),
  (:'user_b', 'b@example.test'),
  (:'user_c', 'c@example.test');

insert into public.organizations (id, name, display_label, anonymous_id_prefix) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '株式会社カリヤ精機', '参加企業A', 'KRY'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '株式会社トヨダ工業', '参加企業B', 'TYT');

insert into public.profiles (id, organization_id, age_range, interview_completed_at) values
  (:'user_a', 'aaaaaaaa-0000-0000-0000-000000000001', '30代前半', now()),
  (:'user_b', 'aaaaaaaa-0000-0000-0000-000000000002', '30代後半', now()),
  (:'user_c', 'aaaaaaaa-0000-0000-0000-000000000002', '40代前半', now());

insert into public.identities (profile_id, full_name, company_name, department, message) values
  (:'user_a', '山田 太郎', '株式会社カリヤ精機', '製造部',   'よろしくお願いします。'),
  (:'user_b', '山田 花子', '株式会社トヨダ工業', '品質保証部', '文章を書くのが好きです。'),
  (:'user_c', '鈴木 一郎', '株式会社トヨダ工業', '営業部',   'はじめまして。');

-- profile_a_id < profile_b_id の制約に合わせる
insert into public.matches (id, profile_a_id, profile_b_id, status, overall_score, notified_at)
values ('bbbbbbbb-0000-0000-0000-000000000001', :'user_a', :'user_b', 'notified', 82, now());

-- 通知閾値未満で、まだ参加者に見せてはいけないマッチ
insert into public.matches (id, profile_a_id, profile_b_id, status, overall_score)
values ('bbbbbbbb-0000-0000-0000-000000000002', :'user_a', :'user_c', 'evaluated', 41);

insert into public.avatar_conversations (match_id, turns, time_label, model, generated_at)
values ('bbbbbbbb-0000-0000-0000-000000000001',
        '[{"speaker":"a","text":"こんばんは。"},{"speaker":"b","text":"こんばんは。"}]'::jsonb,
        '昨夜 2:14 – 2:17 の会話より抜粋', 'fallback', now());

insert into public.compatibility_reports (match_id, overall_score, axes, summary, model, generated_at)
values ('bbbbbbbb-0000-0000-0000-000000000001', 82, '[]'::jsonb, '総評テキスト。', 'fallback', now());

-- =============================================================================
-- ケース1: 誰も判断していない状態
-- =============================================================================
\echo ''
\echo '--- ケース1: 未判断 ---'
select public.test_login(:'user_a');

select pg_temp.assert_eq(count(*), 1,
  'A は自分の identities を読める')
  from public.identities where profile_id = :'user_a'::uuid;

select pg_temp.assert_eq(count(*), 0,
  'A は B の実名を読めない(未判断)')
  from public.identities where profile_id = :'user_b'::uuid;

select pg_temp.assert_eq(count(*), 1,
  'A は通知済みのマッチを読める')
  from public.matches where id = 'bbbbbbbb-0000-0000-0000-000000000001';

select pg_temp.assert_eq(count(*), 0,
  'A は閾値未満(evaluated)のマッチを読めない')
  from public.matches where id = 'bbbbbbbb-0000-0000-0000-000000000002';

select pg_temp.assert_eq(count(*), 1,
  'A は当事者のマッチの会話ログを読める')
  from public.avatar_conversations where match_id = 'bbbbbbbb-0000-0000-0000-000000000001';

select pg_temp.assert_eq(count(*), 0,
  'A は相互accept前に面談枠を読めない')
  from public.meeting_slots where match_id = 'bbbbbbbb-0000-0000-0000-000000000001';

select public.test_logout();

-- =============================================================================
-- ケース2: A だけが accept した状態
-- =============================================================================
\echo ''
\echo '--- ケース2: A のみ accept ---'
select public.test_login(:'user_a');

insert into public.match_decisions (match_id, profile_id, decision, decided_at)
values ('bbbbbbbb-0000-0000-0000-000000000001', :'user_a', 'accept', now());

select pg_temp.assert_eq(count(*), 1,
  'A は自分の判断を読める')
  from public.match_decisions where profile_id = :'user_a'::uuid;

select pg_temp.assert_eq(count(*), 0,
  'A は B の実名を読めない(片側acceptのみ)')
  from public.identities where profile_id = :'user_b'::uuid;

select pg_temp.assert_eq(count(*), 0,
  'A が finalize を呼んでも相互未成立なので何も起きない')
  from (select public.finalize_match_if_mutual('bbbbbbbb-0000-0000-0000-000000000001') as r) t
  where t.r is true;

select public.test_logout();

-- =============================================================================
-- ケース3: B が decline した状態 — A から辞退が見えないこと (NFR-2)
-- =============================================================================
\echo ''
\echo '--- ケース3: B が decline (A から見えてはいけない) ---'
select public.test_login(:'user_b');
insert into public.match_decisions (match_id, profile_id, decision, decided_at)
values ('bbbbbbbb-0000-0000-0000-000000000001', :'user_b', 'decline', now());
select public.test_logout();

select public.test_login(:'user_a');

select pg_temp.assert_eq(count(*), 0,
  'A は B の判断行を読めない(辞退したことが分からない)')
  from public.match_decisions where profile_id = :'user_b'::uuid;

select pg_temp.assert_eq(count(*), 1,
  'A から見た match_decisions は自分の1行だけ')
  from public.match_decisions;

select pg_temp.assert_eq(count(*), 0,
  'A は B の実名を読めない(B は辞退している)')
  from public.identities where profile_id = :'user_b'::uuid;

select pg_temp.assert_eq(count(*), 1,
  'マッチの status は notified のまま変わっていない(辞退が推測できない)')
  from public.matches
  where id = 'bbbbbbbb-0000-0000-0000-000000000001' and status = 'notified';

select public.test_logout();

-- =============================================================================
-- ケース4: 両者 accept — 相互開示が成立すること
-- =============================================================================
\echo ''
\echo '--- ケース4: 両者 accept ---'
-- ケース3 の decline を取り消して accept に差し替える(テスト都合。
-- 本番では UPDATE/DELETE ポリシーが無いため利用者にはできない)
delete from public.match_decisions
where match_id = 'bbbbbbbb-0000-0000-0000-000000000001' and profile_id = :'user_b'::uuid;

select public.test_login(:'user_b');
insert into public.match_decisions (match_id, profile_id, decision, decided_at)
values ('bbbbbbbb-0000-0000-0000-000000000001', :'user_b', 'accept', now());

select pg_temp.assert_eq(count(*), 1,
  'B が finalize を呼ぶと相互成立する')
  from (select public.finalize_match_if_mutual('bbbbbbbb-0000-0000-0000-000000000001') as r) t
  where t.r is true;

select public.test_logout();
select public.test_login(:'user_a');

select pg_temp.assert_eq(count(*), 1,
  'A は B の実名を読める(相互accept成立)')
  from public.identities where profile_id = :'user_b'::uuid;

select pg_temp.assert_eq(count(*), 1,
  'A は B の profiles(年代)を読める')
  from public.profiles where id = :'user_b'::uuid;

select pg_temp.assert_eq(count(*), 3,
  '面談候補日時が3件見える')
  from public.meeting_slots where match_id = 'bbbbbbbb-0000-0000-0000-000000000001';

select pg_temp.assert_eq(count(*), 0,
  '相互accept後も B の判断行そのものは読めない')
  from public.match_decisions where profile_id = :'user_b'::uuid;

select public.test_logout();

-- =============================================================================
-- ケース5: finalize の冪等性 — 二重呼び出しで枠と通知が重複しないこと
-- =============================================================================
\echo ''
\echo '--- ケース5: finalize の冪等性 ---'
select public.test_login(:'user_a');
select public.finalize_match_if_mutual('bbbbbbbb-0000-0000-0000-000000000001');
select public.finalize_match_if_mutual('bbbbbbbb-0000-0000-0000-000000000001');

select pg_temp.assert_eq(count(*), 3,
  '二重呼び出し後も面談枠は3件のまま')
  from public.meeting_slots where match_id = 'bbbbbbbb-0000-0000-0000-000000000001';

select public.test_logout();

select pg_temp.assert_eq(count(*), 2,
  '二重呼び出し後も schedule_confirmed 通知は2件のまま')
  from public.notifications
  where match_id = 'bbbbbbbb-0000-0000-0000-000000000001'
    and kind = 'schedule_confirmed';

-- =============================================================================
-- ケース6: 第三者からの遮断
-- =============================================================================
\echo ''
\echo '--- ケース6: 無関係な参加者 C からの遮断 ---'
select public.test_login(:'user_c');

select pg_temp.assert_eq(count(*), 0,
  'C は他人のマッチを読めない')
  from public.matches where id = 'bbbbbbbb-0000-0000-0000-000000000001';

select pg_temp.assert_eq(count(*), 0,
  'C は他人の会話ログを読めない')
  from public.avatar_conversations;

select pg_temp.assert_eq(count(*), 0,
  'C は他人の相性レポートを読めない')
  from public.compatibility_reports;

select pg_temp.assert_eq(count(*), 0,
  'C は A / B の実名を読めない')
  from public.identities where profile_id <> :'user_c'::uuid;

select pg_temp.assert_eq(count(*), 0,
  'C は他人の面談枠を読めない')
  from public.meeting_slots;

select pg_temp.assert_eq(count(*), 0,
  'C は他人の通知を読めない')
  from public.notifications where profile_id <> :'user_c'::uuid;

-- invite_codes は grant 自体を与えていないため、RLS で0行が返るのではなく
-- テーブルレベルの権限エラーになる。0行返却よりも強い遮断。
select pg_temp.assert_raises(
  $$select count(*) from public.invite_codes$$,
  'C は招待コードを一切読めない(全拒否)');

select public.test_logout();

-- =============================================================================
-- ケース7: 書き込みの遮断
-- =============================================================================
\echo ''
\echo '--- ケース7: 書き込みの遮断 ---'
select public.test_login(:'user_c');

select pg_temp.assert_raises(
  $$insert into public.match_decisions (match_id, profile_id, decision, decided_at)
    values ('bbbbbbbb-0000-0000-0000-000000000001',
            '33333333-3333-3333-3333-333333333333', 'accept', now())$$,
  'C は他人のマッチに判断を書き込めない');

select pg_temp.assert_raises(
  $$update public.match_decisions set decision = 'decline'
    where profile_id = '33333333-3333-3333-3333-333333333333'$$,
  '判断は UPDATE できない(ポリシーなし)');

select pg_temp.assert_raises(
  $$update public.profiles set interview_completed_at = now()
    where id = '33333333-3333-3333-3333-333333333333'$$,
  'interview_completed_at は利用者から更新できない(列限定 grant)');

select pg_temp.assert_raises(
  $$update public.profiles set organization_id = 'aaaaaaaa-0000-0000-0000-000000000001'
    where id = '33333333-3333-3333-3333-333333333333'$$,
  'organization_id は利用者から更新できない');

select pg_temp.assert_raises(
  $$select public.consume_invite_code('KARIYA-2026',
      '33333333-3333-3333-3333-333333333333', 'x', 'y', 'z', 'w')$$,
  'consume_invite_code は authenticated から実行できない');

select pg_temp.assert_raises(
  $$insert into public.identities (profile_id, full_name, company_name)
    values ('11111111-1111-1111-1111-111111111111', 'なりすまし', 'x')$$,
  '他人の identities は作れない');

-- 自分の許可された列は更新できること(遮断しすぎていないことの確認)
update public.profiles set notifications_enabled = false
where id = '33333333-3333-3333-3333-333333333333';
select pg_temp.assert_eq(count(*), 1,
  '自分の notifications_enabled は更新できる')
  from public.profiles
  where id = :'user_c'::uuid and notifications_enabled = false;

select public.test_logout();

-- =============================================================================
-- ケース8: 未認証(anon)からの遮断
-- =============================================================================
\echo ''
\echo '--- ケース8: 未認証からの遮断 ---'
-- anon には各テーブルの grant を与えていないため、RLS の評価に到達する前に
-- テーブルレベルの権限エラーで弾かれる。0行返却よりも強い遮断。
set local role anon;

select pg_temp.assert_raises($$select count(*) from public.profiles$$,
  'anon は profiles を読めない');
select pg_temp.assert_raises($$select count(*) from public.identities$$,
  'anon は identities を読めない');
select pg_temp.assert_raises($$select count(*) from public.matches$$,
  'anon は matches を読めない');
select pg_temp.assert_raises($$select count(*) from public.match_decisions$$,
  'anon は match_decisions を読めない');

reset role;

\echo ''
\echo '============================================'
\echo ' ALL RLS CHECKS PASSED'
\echo '============================================'

rollback;
