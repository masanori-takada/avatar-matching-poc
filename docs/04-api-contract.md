# 04. API コントラクト

原則として **Server Actions** を使い、Route Handler は外部から叩かれるもの（cron・認証コールバック）に限る。

すべての Server Action は次の戻り値型に統一する。

```ts
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; field?: string };
```

例外を投げてクライアントに伝播させない（本番ビルドではメッセージが握りつぶされるため）。`redirect()` は例外機構を使うので `try/catch` の外で呼ぶ。

## 1. `actions/invite.ts`

### `registerWithInviteCode(input)`

| 入力 | 型 | 検証 |
|---|---|---|
| `code` | `string` | 必須。trim後に空でない。大文字化して照合 |
| `fullName` | `string` | 必須。1–60字 |
| `companyName` | `string` | 必須。1–100字 |
| `department` | `string?` | 0–100字 |
| `ageRange` | `string?` | 定数リストのいずれか |
| `message` | `string?` | 0–100字 |

処理:
1. `requireUser()` — 未ログインなら `/login` へ
2. 既に `profiles` があれば `{ ok:false, error:'すでに登録済みです' }`
3. **service_role** で `rpc('consume_invite_code', { p_code, p_user_id })`
   - 該当なし → `{ ok:false, error:'招待コードが正しくありません', field:'code' }`
   - 期限切れ → `'この招待コードは有効期限が切れています'`
   - 上限超過 → `'この招待コードは利用上限に達しています'`
4. `identities` を INSERT（ユーザーセッション + RLS で）
5. `revalidatePath('/')` → 呼び出し側で `redirect('/interview')`

戻り値: `ActionResult<{ organizationId: string }>`

## 2. `actions/interview.ts`

### `submitAnswer(input)`

| 入力 | 型 |
|---|---|
| `questionId` | `string` (uuid) |
| `answer` | `string` |

検証:
- `answer.trim()` が空 → `{ ok:false, error:'回答を入力してください' }`
- 200字超 → 切り詰めではなくエラー
- 対象設問が `kind='choice'` の場合、`answer` が `options` に含まれること
- **回答順の強制**: 未回答の設問のうち `sort_order` が最小のものと一致しない `questionId` は拒否

処理: `interview_answers` に UPSERT（`onConflict: 'profile_id,question_id'`）。
戻り値: `ActionResult<{ answeredCount: number; totalCount: number; done: boolean }>`

### `completeInterview()`

処理:
1. 全 `is_active` 設問に回答済みか確認。未完了なら `{ ok:false, error:'まだ回答していない質問があります' }`
2. `profiles.interview_completed_at = now()`
3. ペルソナ生成を**同期で試行**（タイムアウト10秒）。失敗しても握りつぶす（バッチが拾う）
4. `redirect('/waiting')` は呼び出し側

戻り値: `ActionResult`

### `resetInterview()`（開発・展示用、`NODE_ENV !== 'production'` のみ有効）

自分の `interview_answers` と `personas` を削除し、`interview_completed_at` を NULL に戻す。

## 3. `actions/notifications.ts`

### `markNotificationRead(notificationId)`

`notifications.read_at = now()`（RLS により自分の行のみ）。戻り値: `ActionResult`

### `markAllNotificationsRead()`

戻り値: `ActionResult<{ updated: number }>`

## 4. `actions/decisions.ts`

### `decideMatch(input)`

| 入力 | 型 |
|---|---|
| `matchId` | `string` (uuid) |
| `decision` | `'accept' \| 'decline'` |

処理:
1. `requireProfile()`
2. `match_decisions` に INSERT。RLS の `with check` が当事者チェックを行う
   - UNIQUE 違反（23505）→ `{ ok:false, error:'すでに判断済みです' }`
3. **`decision === 'accept'` の場合のみ**、`rpc('finalize_match_if_mutual', { p_match_id })` を呼ぶ
   - この関数は `SECURITY DEFINER` で、両者 accept なら `matches.status = 'mutual'` にし、`meeting_slots` を3件生成し、両者に `schedule_confirmed` 通知を作る。**冪等**（既に `mutual` なら何もしない）
   - 戻り値 `boolean`（相互成立したか）
4. `decision === 'decline'` の場合、`matches.status` は**変更しない**
   - 変更すると、相手側から `status` の変化を通じて辞退が推測できてしまう（NFR-2）
   - 辞退者の画面からマッチを隠すのは、`match_decisions` に自分の `decline` 行があるかで判定する（アプリ層）

戻り値: `ActionResult<{ mutual: boolean }>`
- `accept` して相互成立 → `{ mutual: true }` → 呼び出し側で `/matches/[id]/reveal`
- `accept` したが相手待ち → `{ mutual: false }` → **待機表示**（「お相手の回答をお待ちしています」）
- `decline` → `{ mutual: false }` → `/matches/[id]/declined`

> **PoCとの差異**: PoC は accept すると必ず開示画面へ進んだ（相手は固定NPCで常にaccept）。本番では相手の判断が未確定な状態が存在するため、待機状態を1つ追加する。

### `finalize_match_if_mutual` の SQL 概略

```sql
create function public.finalize_match_if_mutual(p_match_id uuid)
returns boolean language plpgsql security definer set search_path = public, pg_catalog as $$
declare v_a uuid; v_b uuid; v_ok boolean;
begin
  select profile_a_id, profile_b_id into v_a, v_b from matches where id = p_match_id for update;
  if v_a is null then return false; end if;

  select count(*) = 2 into v_ok
  from match_decisions
  where match_id = p_match_id and decision = 'accept';
  if not v_ok then return false; end if;

  update matches set status = 'mutual' where id = p_match_id and status <> 'mutual';
  if not found then return true; end if;   -- 既に確定済み: 二重生成しない

  insert into meeting_slots (match_id, starts_at, ends_at, place, sort_order)
  select p_match_id, s.starts_at, s.ends_at, s.place, s.ord from generate_slots() s;

  insert into notifications (profile_id, kind, title, body, match_id)
  values (v_a, 'schedule_confirmed', 'お互いが「会う」を選びました', '面談候補日時を選んでください。', p_match_id),
         (v_b, 'schedule_confirmed', 'お互いが「会う」を選びました', '面談候補日時を選んでください。', p_match_id);
  return true;
end $$;
```

## 5. `actions/schedule.ts`

### `selectSlot(input)`

| 入力 | 型 |
|---|---|
| `matchId` | `string` |
| `slotId` | `string` |

処理: `slot_selections` を UPSERT（`onConflict: 'match_id,profile_id'`）。RLS が相互accept と slot の所属を検査する。
戻り値: `ActionResult<{ bothSelected: boolean; agreed: boolean }>`
- `bothSelected` — 両者が選択済み
- `agreed` — 両者が**同じ枠**を選択

## 6. `actions/settings.ts`

### `updateNotificationSetting(enabled: boolean)`
`profiles.notifications_enabled` を更新。戻り値: `ActionResult`

### `deleteAccount()`
1. service_role で `auth.admin.deleteUser(userId)` を実行
2. `profiles` 以下は ON DELETE CASCADE で全削除される
3. サインアウトして `/login` へ

戻り値: `ActionResult`

## 7. Route Handlers

### `POST /api/cron/matching`

| ヘッダ | 値 |
|---|---|
| `Authorization` | `Bearer ${CRON_SECRET}` |

`CRON_SECRET` が未設定、または不一致なら `401`。`CRON_SECRET` が未設定の場合は**常に401**（誤って公開状態にしない）。

レスポンス `200`:

```jsonc
{
  "personasGenerated": 3,
  "candidatesCreated": 7,
  "conversationsGenerated": 7,
  "reportsGenerated": 7,
  "notified": 2,
  "failed": 0,
  "durationMs": 18432
}
```

処理の詳細は `05-ai-pipeline.md` §5。

### `GET /api/auth/callback`

Supabase のメールOTPリンクからのコールバック。`code` を `exchangeCodeForSession` し、`next` パラメータ（デフォルト `/`）へリダイレクトする。`next` は**先頭が `/` の相対パスのみ許可**（オープンリダイレクト防止）。

## 8. ページのガードと振り分け

`src/lib/auth/guards.ts`

```ts
requireUser():    Promise<User>     // 未ログイン → redirect('/login')
requireProfile(): Promise<Profile>  // profile なし → redirect('/invite')
requireInterviewed(): Promise<Profile> // 未完了 → redirect('/interview')
```

`/` の振り分け:

| 状態 | 遷移先 |
|---|---|
| 未ログイン | `/login` |
| profile なし | `/invite` |
| `interview_completed_at` が NULL | `/interview` |
| 通知可能なマッチが 0 件 | `/waiting` |
| それ以外 | `/home` |

`middleware.ts` はセッション Cookie の更新のみを行い、リダイレクト判定はページ側（`guards.ts`）に集約する。middleware で DB を引くとエッジでのレイテンシが増え、判定ロジックが二重化するため。
