# 06. 実装計画

## 1. 体制

| フェーズ | 担当モデル | 成果物 |
|---|---|---|
| 仕様・設計 | **claude-opus-5** | `docs/00`–`06`（本書一式） |
| 実装 | **claude-sonnet-5** | `src/`, `supabase/`, `tests/`, 設定ファイル |
| コードレビュー | **claude-opus-5** | 指摘と修正 |

## 2. フェーズ分割

実装は5つのフェーズに分け、各フェーズを sonnet-5 のサブエージェント1体が担当する。フェーズ1〜2は依存がないため並行、3以降は直列。

### フェーズ1: 基盤とDB

- `package.json` / `tsconfig.json`（strict）/ `next.config.ts` / `tailwind.config.ts` / `vitest.config.ts` / `.env.example` / `.gitignore` / `eslint.config.mjs`
- `supabase/config.toml`
- `supabase/migrations/20260813000001_schema.sql` — `03-data-model.md` §2 の全テーブル・制約・インデックス・トリガ・DB関数
- `supabase/migrations/20260813000002_rls.sql` — §4 の全ポリシーと `SECURITY DEFINER` ヘルパー
- `supabase/migrations/20260813000003_seed_questions.sql` — 20問の設問
- `supabase/seed.sql` — ローカル用のダミー組織2件と招待コード
- `supabase/tests/rls.sql` — §8 の検証SQL
- `src/types/database.ts` — 手書き（Supabaseプロジェクト未作成のため生成できない）。`Database` 型を上記スキーマに一致させる
- `src/lib/supabase/{client,server,admin,middleware}.ts`
- `src/middleware.ts`

**受け入れ**: `npx tsc --noEmit` が通る。マイグレーションSQLが `psql` の構文として妥当（`supabase db lint` 相当を目視で確認）。

### フェーズ2: デザインシステム移植

- `src/app/globals.css` — `poc/style.css` のトークン（色・角丸・影・spacing・タイポ）を CSS 変数として移植。`.phone` 枠とスケーリングは廃止し `max-width:480px` の中央寄せに置換
- `src/components/ui/` — `IconSprite`（`poc/index.html` の `<symbol>` を全て移植）, `Button`, `Card`, `Field`, `Bubble`, `Bar`, `Steps`, `Badge`, `EmptyState`
- `src/components/shell/` — `AppHeader`（ベル+未読バッジ）, `TabBar`, `Toast`, `ConfirmSheet`（`window.confirm` は使わない）, `LoadingOverlay`
- `src/lib/constants.ts` — `STEPS`(5段階), `AXIS_DEFINITIONS`(5軸のlabel/invertedGood/weight), `AGE_RANGES`, 表示文言

**受け入れ**: Storybook等は作らないが、各コンポーネントが props だけで描画でき、`'use client'` の付与が最小限であること。

### フェーズ3: 認証・登録・インタビュー

- `src/lib/auth/guards.ts`
- `src/app/login/page.tsx` + メールOTPフォーム
- `src/app/api/auth/callback/route.ts`（`next` の相対パス検証を含む）
- `src/app/invite/page.tsx` + `actions/invite.ts`
- `src/app/interview/page.tsx` + `actions/interview.ts` + `components/feature/InterviewChat.tsx`
  - PoC の演出（タイピングバブル600ms、progress バー、選択肢ボタン、IME中の Enter 無視）を維持
- `src/app/page.tsx` の振り分け（`04-api-contract.md` §8）
- `src/lib/ai/{client,schema,persona,fallback}.ts`

**受け入れ**: `ANTHROPIC_API_KEY` なしでインタビュー完了 → `personas` に `model='fallback'` の行ができる。

### フェーズ4: マッチングとレポート

- `src/lib/ai/{conversation,compatibility}.ts`
- `src/lib/matching/{candidates,scoring,pipeline}.ts`
- `src/app/api/cron/matching/route.ts`
- `src/app/waiting/page.tsx`, `src/app/home/page.tsx`, `src/app/notifications/page.tsx` + `actions/notifications.ts`
- `src/app/matches/[matchId]/page.tsx` + `components/feature/{ConversationLog,ReportAxes}.tsx` + `actions/decisions.ts`
- `src/app/matches/[matchId]/declined/page.tsx`
- `tests/{scoring,fallback,candidates}.test.ts`

**受け入れ**: `npm test` が通る。`quote` 検証（会話ログの部分文字列であること）のテストを含む。

### フェーズ5: 開示・日程・補助画面

- `src/app/matches/[matchId]/reveal/page.tsx` + `components/feature/SlotPicker.tsx` + `actions/schedule.ts`
  - 相手待ち状態（accept 済みだが相互未成立）の表示を含む
- `src/app/matches/[matchId]/done/page.tsx`
- `src/app/{mypage,profile,privacy,faq,settings}/page.tsx` + `actions/settings.ts`
  - `privacy` / `faq` は `poc/index.html` の文言をそのまま移植
- `README.md` — セットアップ手順（Supabaseリンク、マイグレーション適用、環境変数、cron 設定）
- `scripts/push-to-new-repo.sh`

**受け入れ**: `npm run build` / `npm run lint` / `npm run typecheck` / `npm test` が全て通る。

## 3. コードレビューの観点（opus-5）

優先度順。

1. **匿名性の破れ**
   - `identities` / `match_decisions` が意図しない経路で読めないか
   - Server Component が service_role クライアントを使っていないか
   - `matches` の RLS が `evaluated` 以前の status を漏らしていないか
   - `decline` が `matches.status` を変えていないか（相手から推測可能になる）
   - 会話ログ・レポートのプロンプトに実名が入っていないか
2. **認可**
   - 全 Server Action が `requireProfile()` を通っているか
   - `matchId` を URL から受け取る箇所で、当事者チェックを RLS に委ねきれているか
3. **冪等性・競合**
   - `consume_invite_code` の行ロック
   - `finalize_match_if_mutual` の二重実行で slot / notification が重複生成されないか
   - バッチの再実行で会話・レポートが重複しないか（UPSERT になっているか）
4. **型安全**
   - `any` / 非nullアサーション `!` の乱用がないか
   - `database.ts` の型がマイグレーションと一致しているか
5. **フォールバック**
   - `ANTHROPIC_API_KEY` 未設定で全経路が動くか
   - LLM 出力のスキーマ違反で例外が漏れないか
6. **PoC体験の再現**
   - 5段階ステップ、5軸レポート、辞退の非通知、`prefers-reduced-motion`、`aria-live`

## 4. スコープ外（明示）

以下は実装しない。README に「未実装」として記載する。

- Web Push / メール通知の実配信
- 組織管理者向け画面
- 会話ログの再生成・レポートの再評価をユーザーが要求する機能
- 複数マッチの同時進行UI（データモデルは対応済み。UIは最新1件を主に扱う）
- E2E テスト（Playwright）
- i18n（日本語のみ）
