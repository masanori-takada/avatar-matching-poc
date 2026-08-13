-- =============================================================================
-- AIアバター自動マッチング — ローカル開発用シードデータ
-- 2つのダミー組織と招待コードを作成する(supabase start / db reset で自動投入)
-- =============================================================================

insert into public.organizations (id, name, display_label, anonymous_id_prefix) values
  ('00000000-0000-0000-0000-000000000001', '株式会社カリヤ精機', '参加企業A', 'KRY'),
  ('00000000-0000-0000-0000-000000000002', 'トヨタ物流株式会社', '参加企業B', 'TYT')
on conflict (id) do nothing;

insert into public.invite_codes (organization_id, code, max_uses, used_count, expires_at) values
  ('00000000-0000-0000-0000-000000000001', 'KARIYA-2026', 100, 0, null),
  ('00000000-0000-0000-0000-000000000002', 'TOYOTA-2026', 100, 0, null)
on conflict (code) do nothing;
