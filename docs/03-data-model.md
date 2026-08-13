# 03. データモデルと RLS

匿名性（NFR-1〜3）はこのドキュメントの設計で担保する。**アプリ層のバグでは破れないこと**が目標。

## 1. ER 概要

```
organizations ──< invite_codes
      │
      └──< profiles ──1:1── identities        （実名。相互acceptまで非公開）
              │
              ├──1:1── personas
              ├──< interview_answers >── interview_questions
              ├──< notifications
              └──< match_participants >── matches
                                             ├──1:1── avatar_conversations
                                             ├──1:1── compatibility_reports
                                             ├──< match_decisions
                                             ├──< meeting_slots
                                             └──< slot_selections
```

`matches` は「2名の組」だが、`profile_a_id` / `profile_b_id` の2カラム方式を採る（結合が単純で、RLS が書きやすいため）。正規化のための `match_participants` は作らず、上図の表現は概念上のもの。

## 2. テーブル定義

### 2.1 `organizations`

| カラム | 型 | 備考 |
|---|---|---|
| `id` | `uuid` PK | `gen_random_uuid()` |
| `name` | `text` NOT NULL | 例: 株式会社カリヤ精機 |
| `display_label` | `text` NOT NULL | 匿名表示用。例: 参加企業A |
| `anonymous_id_prefix` | `text` NOT NULL | 匿名ID接頭辞。例: `KRY` |
| `created_at` | `timestamptz` | `now()` |

### 2.2 `invite_codes`

| カラム | 型 | 備考 |
|---|---|---|
| `id` | `uuid` PK | |
| `organization_id` | `uuid` FK → organizations | |
| `code` | `text` NOT NULL UNIQUE | 大文字に正規化して保存 |
| `max_uses` | `integer` NOT NULL | 既定 100 |
| `used_count` | `integer` NOT NULL | 既定 0 |
| `expires_at` | `timestamptz` NULL | NULL は無期限 |
| `created_at` | `timestamptz` | |

> RLS は **全拒否**。検証は service_role を使う Server Action からのみ行う。コード総当たりの探索を防ぐため、クライアントには一切公開しない。

### 2.3 `profiles`

| カラム | 型 | 備考 |
|---|---|---|
| `id` | `uuid` PK FK → `auth.users(id)` ON DELETE CASCADE | |
| `organization_id` | `uuid` FK → organizations NOT NULL | |
| `anonymous_id` | `text` NOT NULL UNIQUE | `KRY-4821` 形式。トリガで自動採番 |
| `age_range` | `text` NULL | 例: 30代前半。開示時のみ表示 |
| `interview_completed_at` | `timestamptz` NULL | |
| `notifications_enabled` | `boolean` NOT NULL DEFAULT true | |
| `is_active` | `boolean` NOT NULL DEFAULT true | 退会・一時停止 |
| `created_at` | `timestamptz` | |

### 2.4 `identities` — 実名情報

| カラム | 型 | 備考 |
|---|---|---|
| `profile_id` | `uuid` PK FK → profiles ON DELETE CASCADE | |
| `full_name` | `text` NOT NULL | |
| `company_name` | `text` NOT NULL | |
| `department` | `text` NULL | |
| `message` | `text` NULL | 一言 |
| `updated_at` | `timestamptz` | |

**このテーブルの SELECT ポリシーが、匿名性の中核。** 後述 §4.2。

### 2.5 `interview_questions`

| カラム | 型 | 備考 |
|---|---|---|
| `id` | `uuid` PK | |
| `code` | `text` NOT NULL UNIQUE | `q1`..`q6` |
| `sort_order` | `integer` NOT NULL | |
| `kind` | `text` NOT NULL | `choice` \| `free` |
| `text` | `text` NOT NULL | |
| `options` | `jsonb` NOT NULL DEFAULT `'[]'` | `choice` のときのみ非空 |
| `is_active` | `boolean` NOT NULL DEFAULT true | |

CHECK: `kind = 'choice'` なら `jsonb_array_length(options) >= 2`、`kind = 'free'` なら `options = '[]'`。

### 2.6 `interview_answers`

| カラム | 型 | 備考 |
|---|---|---|
| `id` | `uuid` PK | |
| `profile_id` | `uuid` FK → profiles ON DELETE CASCADE | |
| `question_id` | `uuid` FK → interview_questions | |
| `answer` | `text` NOT NULL CHECK (`length(btrim(answer)) > 0`) | |
| `created_at` | `timestamptz` | |

UNIQUE (`profile_id`, `question_id`) — 1問1回答。

### 2.7 `personas`

| カラム | 型 | 備考 |
|---|---|---|
| `profile_id` | `uuid` PK FK → profiles ON DELETE CASCADE | |
| `summary` | `text` NOT NULL | アバターの自己像（3〜4文） |
| `traits` | `jsonb` NOT NULL | §5 のスキーマ |
| `speaking_style` | `text` NOT NULL | 口調・テンポ |
| `model` | `text` NOT NULL | 生成に使ったモデル or `fallback` |
| `generated_at` | `timestamptz` NOT NULL | |

### 2.8 `matches`

| カラム | 型 | 備考 |
|---|---|---|
| `id` | `uuid` PK | |
| `profile_a_id` | `uuid` FK → profiles ON DELETE CASCADE | |
| `profile_b_id` | `uuid` FK → profiles ON DELETE CASCADE | |
| `status` | `text` NOT NULL DEFAULT `'pending'` | `pending`/`conversed`/`evaluated`/`notified`/`mutual`/`closed`/`failed` |
| `overall_score` | `integer` NULL | 0–100 |
| `attempt_count` | `integer` NOT NULL DEFAULT 0 | 失敗リトライ用 |
| `last_error` | `text` NULL | |
| `notified_at` | `timestamptz` NULL | |
| `created_at` | `timestamptz` | |

制約:
- CHECK `profile_a_id < profile_b_id` — 順序を正規化し、(A,B) と (B,A) の重複を防ぐ
- UNIQUE (`profile_a_id`, `profile_b_id`)

### 2.9 `avatar_conversations`

| カラム | 型 | 備考 |
|---|---|---|
| `match_id` | `uuid` PK FK → matches ON DELETE CASCADE | |
| `turns` | `jsonb` NOT NULL | `[{ speaker: 'a'\|'b', text: string }]` |
| `time_label` | `text` NOT NULL | 例: 昨夜 2:14 – 2:17 の会話より抜粋 |
| `model` | `text` NOT NULL | |
| `generated_at` | `timestamptz` NOT NULL | |

> `speaker` は `'self'`/`'partner'` ではなく **`'a'`/`'b'`** で保存する。閲覧者によって「自分/相手」が入れ替わるため、保存時に固定してはいけない。表示側で `viewerProfileId === match.profile_a_id` を見て反転する。

### 2.10 `compatibility_reports`

| カラム | 型 | 備考 |
|---|---|---|
| `match_id` | `uuid` PK FK → matches ON DELETE CASCADE | |
| `overall_score` | `integer` NOT NULL | 0–100 |
| `axes` | `jsonb` NOT NULL | §5 のスキーマ |
| `summary` | `text` NOT NULL | 総評 |
| `model` | `text` NOT NULL | |
| `generated_at` | `timestamptz` NOT NULL | |

### 2.11 `match_decisions`

| カラム | 型 | 備考 |
|---|---|---|
| `id` | `uuid` PK | |
| `match_id` | `uuid` FK → matches ON DELETE CASCADE | |
| `profile_id` | `uuid` FK → profiles ON DELETE CASCADE | |
| `decision` | `text` NOT NULL CHECK (`decision IN ('accept','decline')`) | |
| `decided_at` | `timestamptz` NOT NULL | |

UNIQUE (`match_id`, `profile_id`) — 1マッチ1判断、変更不可（UPDATE/DELETE ポリシーを作らない）。

### 2.12 `meeting_slots`

| カラム | 型 | 備考 |
|---|---|---|
| `id` | `uuid` PK | |
| `match_id` | `uuid` FK → matches ON DELETE CASCADE | |
| `starts_at` | `timestamptz` NOT NULL | |
| `ends_at` | `timestamptz` NOT NULL | |
| `place` | `text` NOT NULL | |
| `sort_order` | `integer` NOT NULL | |

### 2.13 `slot_selections`

| カラム | 型 | 備考 |
|---|---|---|
| `id` | `uuid` PK | |
| `match_id` | `uuid` FK → matches ON DELETE CASCADE | |
| `profile_id` | `uuid` FK → profiles ON DELETE CASCADE | |
| `slot_id` | `uuid` FK → meeting_slots ON DELETE CASCADE | |
| `selected_at` | `timestamptz` NOT NULL | |

UNIQUE (`match_id`, `profile_id`)。相互accept後なので、相手の選択は参照してよい。

### 2.14 `notifications`

| カラム | 型 | 備考 |
|---|---|---|
| `id` | `uuid` PK | |
| `profile_id` | `uuid` FK → profiles ON DELETE CASCADE | |
| `kind` | `text` NOT NULL | `match_found` \| `report_ready` \| `schedule_confirmed` |
| `title` | `text` NOT NULL | |
| `body` | `text` NOT NULL | |
| `match_id` | `uuid` NULL FK → matches ON DELETE CASCADE | |
| `read_at` | `timestamptz` NULL | |
| `created_at` | `timestamptz` NOT NULL | |

## 3. ヘルパー関数

すべて `SECURITY DEFINER` / `SET search_path = public, pg_catalog` / `STABLE`。

```sql
-- 呼び出し元がこのマッチの当事者か
create function public.is_match_participant(p_match_id uuid) returns boolean

-- 相互accept が成立しているか（両者とも accept）
create function public.is_mutual_accept(p_match_id uuid) returns boolean

-- 呼び出し元から見て、この profile_id は「相互acceptした相手」か
create function public.is_revealed_partner(p_profile_id uuid) returns boolean
```

`is_revealed_partner` の実体:

```sql
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
```

> `SECURITY DEFINER` にする理由: この関数の内部では `match_decisions` の**相手の行**を読む必要があるが、`match_decisions` の RLS は自分の行しか許さない。関数の中だけで境界を越え、返す値は `boolean` 一つに絞ることで、相手の判断そのものは漏れない。
>
> 重要: **`accept` かどうかしか返さない。** 相手が `decline` した場合も、まだ判断していない場合も、同じ `false` が返る（NFR-2）。

## 4. RLS ポリシー

全テーブルで `alter table ... enable row level security;` を実行し、`anon`/`authenticated` からの `grant` は最小限にする。**ポリシーを書かないテーブルは全拒否**（`invite_codes`）。

### 4.1 参加者本人のデータ

| テーブル | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `profiles` | `id = auth.uid()` **または** `is_revealed_partner(id)` | なし（招待コード検証経由のみ） | `id = auth.uid()` （`organization_id`/`anonymous_id` は変更不可） | `id = auth.uid()` |
| `interview_answers` | `profile_id = auth.uid()` | `profile_id = auth.uid()` | なし | `profile_id = auth.uid()` |
| `personas` | `profile_id = auth.uid()` | なし | なし | なし |
| `notifications` | `profile_id = auth.uid()` | なし | `profile_id = auth.uid()`（`read_at` のみ） | `profile_id = auth.uid()` |
| `interview_questions` | `is_active = true`（全員） | なし | なし | なし |
| `organizations` | 認証済み全員（`display_label` のみ用途） | なし | なし | なし |
| `invite_codes` | **ポリシーなし = 全拒否** | | | |

`personas` に INSERT/UPDATE ポリシーを置かないのは、生成が service_role のバッチ専任だから。

### 4.2 `identities` — 匿名性の中核

```sql
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
```

これにより:
- 自分がacceptしただけ → `is_revealed_partner` が `false` → **0行**
- 相手がacceptしただけ → 同上 → **0行**
- 両者accept → 1行

`profiles` の SELECT にも `is_revealed_partner(id)` を足すのは、`age_range` を開示画面で出すため。`anonymous_id` は元々匿名なので問題ない。

### 4.3 マッチ関連

| テーブル | SELECT | 備考 |
|---|---|---|
| `matches` | `status IN ('notified','mutual','closed') AND (profile_a_id = auth.uid() OR profile_b_id = auth.uid())` | **`pending`/`conversed`/`evaluated`/`failed` は返さない**（FR-3.6: 閾値未満・処理中のマッチを隠す） |
| `avatar_conversations` | `is_match_participant(match_id)` | |
| `compatibility_reports` | `is_match_participant(match_id)` | |
| `match_decisions` | **`profile_id = auth.uid()`** のみ | 相手の判断は絶対に返さない（NFR-2） |
| `meeting_slots` | `is_match_participant(match_id) AND is_mutual_accept(match_id)` | |
| `slot_selections` | `is_match_participant(match_id) AND is_mutual_accept(match_id)` | 相互accept後は相手の選択も見せる（FR-6.5） |

`is_match_participant` も、内部で `matches` を読むため `SECURITY DEFINER` にし、`status` 条件を含める:

```sql
select exists (
  select 1 from public.matches m
  where m.id = p_match_id
    and m.status in ('notified','mutual','closed')
    and (m.profile_a_id = auth.uid() or m.profile_b_id = auth.uid())
);
```

INSERT ポリシー:

```sql
create policy decisions_insert_self on public.match_decisions
  for insert to authenticated
  with check (
    profile_id = auth.uid()
    and public.is_match_participant(match_id)
  );
-- UPDATE / DELETE ポリシーは作らない = 判断は変更不可 (FR-5.7)

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
```

### 4.4 人事・運営の非閲覧（NFR-3）

- 組織管理者ロールを**作らない**。管理者向けのマッチ閲覧ビュー・API を実装しない。
- Supabase の service_role キーはバッチと招待コード検証にのみ使用し、いかなるユーザー操作からも到達できないようにする。
- 将来的に組織向けの利用状況を出す場合も、`select count(*) from profiles where organization_id = $1` レベルの匿名カウントに限定する（本実装では未提供）。

## 5. JSONB スキーマ

### 5.1 `personas.traits`

```jsonc
{
  "social_energy":  "outgoing" | "reserved" | "balanced",  // q1, q2 由来
  "conversation_style": "initiator" | "listener" | "adaptive",
  "values_keywords": ["静かな週末", "文章を書く"],          // 自由記述から抽出、最大5語
  "comfort_preference": "humor" | "shared_values" | "new_perspectives",
  "future_orientation": "concrete" | "vague" | "open",
  "must_know": "相手に知っておいてほしいこと（原文の要約、80字以内）"
}
```

### 5.2 `compatibility_reports.axes`

```jsonc
[
  {
    "key": "flow",              // flow | values | humor | interest | conflict
    "label": "会話の弾み",
    "score": 88,                // 0-100 の整数
    "invertedGood": false,      // conflict のみ true
    "comment": "沈黙がなく、互いに話題を足し合っていました。",
    "quote": "「分かります。ちなみに、最近何かに夢中になったことはありますか。」"
  }
]
```

配列は必ず 5 要素、`key` は上記5種を過不足なく1回ずつ。`quote` は `avatar_conversations.turns` のいずれかの `text` の**部分文字列**であること（生成後に検証し、満たさなければその軸の `quote` を最も長いターンの先頭60字に差し替える）。

### 5.3 総合スコア

`overall_score` は5軸から決定的に算出する（LLM に総合点を出させない）:

```
overall = round(
  0.25 * flow +
  0.30 * values +
  0.15 * humor +
  0.20 * interest +
  0.10 * (100 - conflict)
)
```

`conflict` は「低いほど良い」ため反転して加える。重みは `lib/matching/scoring.ts` の定数に置き、テストで合計 1.0 を検証する。

## 6. トリガ・関数（DB側）

| 名前 | 内容 |
|---|---|
| `set_updated_at()` | `identities.updated_at` を自動更新 |
| `assign_anonymous_id()` | `profiles` INSERT 前に `{prefix}-{4桁}` を採番。衝突時は再試行（最大10回） |
| `consume_invite_code(p_code text, p_user_id uuid)` | `SECURITY DEFINER`。コード検証 → `used_count` を加算 → `profiles` を作成 → `organization_id` を返す。**行ロック (`for update`) を取り、`used_count < max_uses` と `expires_at` を同一トランザクションで検査する** |

`consume_invite_code` を DB 関数にすることで、招待コードの使用回数に競合が起きない。Server Action は service_role でこの関数を `rpc` 呼び出しするだけにする。

## 7. インデックス

```sql
create index on public.matches (status);
create index on public.matches (profile_a_id);
create index on public.matches (profile_b_id);
create index on public.notifications (profile_id, read_at);
create index on public.match_decisions (match_id);
create index on public.interview_answers (profile_id);
create index on public.profiles (organization_id);
```

## 8. RLS の検証方法

`tests/` の単体テストでは RLS を検証できない（Postgres が必要）。以下を `docs/` の手順として残し、ローカルの `supabase start` 上で実行する。

```sql
-- 片側だけ accept した状態で、相手の identities が見えないこと
select set_config('request.jwt.claims', json_build_object('sub', :user_a)::text, true);
select count(*) from identities where profile_id = :user_b;  -- 期待: 0

-- 相手の判断が見えないこと
select count(*) from match_decisions where profile_id = :user_b;  -- 期待: 0

-- 両者 accept 後
select count(*) from identities where profile_id = :user_b;  -- 期待: 1
```

このスクリプトは `supabase/tests/rls.sql` に置く。
