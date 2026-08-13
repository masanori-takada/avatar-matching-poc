-- =============================================================================
-- AIアバター自動マッチング — RLS 検証スクリプト
-- docs/03-data-model.md §8 に対応。
--
-- 使い方: `supabase start` でローカルスタックを起動した後、
-- psql または Supabase Studio の SQL Editor から手動で実行する。
-- :user_a / :user_b は実在する auth.users.id (= profiles.id) の uuid に置き換える。
--
--   psql "$(supabase status -o env | grep DB_URL | cut -d= -f2)" \
--     -v user_a='11111111-1111-1111-1111-111111111111' \
--     -v user_b='22222222-2222-2222-2222-222222222222' \
--     -f supabase/tests/rls.sql
-- =============================================================================

-- ケース1: 片側だけ accept した状態で、相手の identities が見えないこと
select set_config('request.jwt.claims', json_build_object('sub', :'user_a')::text, true);
select set_config('role', 'authenticated', true);

select count(*) as expect_zero_identities
from identities
where profile_id = :'user_b'::uuid;
-- 期待: 0

-- ケース2: 相手の判断(match_decisions)が見えないこと
select count(*) as expect_zero_decisions
from match_decisions
where profile_id = :'user_b'::uuid;
-- 期待: 0

-- ケース3: 両者 accept 後、identities が1行見えること
-- (事前に match_decisions へ両者の accept 行を INSERT しておくこと)
select count(*) as expect_one_identity
from identities
where profile_id = :'user_b'::uuid;
-- 期待: 1 (両者acceptが成立している場合のみ)
