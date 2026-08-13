# AIアバター自動マッチング

社員同士をAIアバター(あなたの代わりに会話するAI人格)でマッチングし、相性が高いペアにのみ実名を開示して面談を促すマッチングアプリの本番実装です。

## poc/ との関係

`poc/` ディレクトリには、`localStorage` のみで動く単一ページのモック(`index.html` + `app.js` + `style.css`)が入っています。本リポジトリの `src/` は、そのモックの画面構成・文言・デザインをそのまま踏襲しつつ、以下を本番相当に置き換えた実装です。

- データの保存先: `localStorage` → Supabase(Postgres + RLS)
- 認証: なし → メールOTP(Supabase Auth)
- 相手アバターの応答: 固定スクリプト → Claude API(未設定時は決定的フォールバック)
- 匿名性の担保: JS側のフラグ → Postgres の Row Level Security

`poc/` 配下のファイルは本実装からは変更していません。画面の文言や振る舞いのリファレンスとして参照してください。

設計ドキュメントは `docs/` 配下にあります。

- [`docs/00-overview.md`](docs/00-overview.md) — 全体概要
- [`docs/01-requirements.md`](docs/01-requirements.md) — 要件定義(FR/NFR/受け入れ基準)
- [`docs/02-architecture.md`](docs/02-architecture.md) — アーキテクチャ
- [`docs/03-data-model.md`](docs/03-data-model.md) — データモデルとRLS
- [`docs/04-api-contract.md`](docs/04-api-contract.md) — Server Action / Route Handler の契約
- [`docs/05-ai-pipeline.md`](docs/05-ai-pipeline.md) — AIパイプライン(ペルソナ生成・会話生成・相性評価)
- [`docs/06-implementation-plan.md`](docs/06-implementation-plan.md) — 実装計画・フェーズ分割・レビュー観点

## 今後の開発フロー(spec-kit)

`docs/00〜06` は本リポジトリの最初の実装を進めるために手動で書いた設計ドキュメントです。これ以降の機能追加・変更は、[GitHub spec-kit](https://github.com/github/spec-kit) の spec-driven workflow に沿って進めます。`specify init --here --integration claude` により `.specify/` と `.claude/skills/speckit-*` を導入済みです。

プロジェクト全体の不変の原則(匿名性はRLSで担保する、辞退は相手から推測できないようにする、人事・運営は閲覧できない、Claude API はオプショナル、等)は [`.specify/memory/constitution.md`](.specify/memory/constitution.md) に明文化されています。新機能を追加する際は、まずこの Constitution に抵触しないかを確認してください。

典型的な流れ:

```
/speckit-specify   新機能のベースライン仕様を作成
/speckit-clarify    (任意)曖昧な点を対話的に解消
/speckit-plan       実装計画を作成
/speckit-tasks      実行可能なタスクへ分解
/speckit-implement  実装を実行
```

実装後は、本 Constitution の原則(特に匿名性・非対称性・非閲覧)への抵触を主眼に、実装とは独立した観点でコードレビューを行ってください(`docs/06-implementation-plan.md` §3 の観点表を参照)。

## 技術スタック

- [Next.js](https://nextjs.org/) 15(App Router, Server Actions, Server Components)
- [React](https://react.dev/) 19
- [TypeScript](https://www.typescriptlang.org/) strict
- [Supabase](https://supabase.com/)(Postgres, Auth, Row Level Security)
- [Tailwind CSS](https://tailwindcss.com/) v4(`@tailwindcss/postcss`。ただし画面のスタイルは主に `src/app/globals.css` の PoC 移植トークン/クラスを使用)
- [Anthropic Claude API](https://docs.anthropic.com/)(`@anthropic-ai/sdk`)。未設定でも決定的フォールバックで全画面が動作します
- [Vitest](https://vitest.dev/)(単体テスト)、[ESLint](https://eslint.org/)

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. Supabase プロジェクトの用意

ローカルの Supabase CLI スタックを使う場合:

```bash
supabase start
```

既存のホスト型 Supabase プロジェクトにリンクする場合:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

いずれの場合も、`supabase/migrations/` の3本のマイグレーションが適用されます。

- `20260813000001_schema.sql` — 全テーブル・制約・インデックス・トリガ・DB関数
- `20260813000002_rls.sql` — RLSポリシーと `SECURITY DEFINER` ヘルパー関数
- `20260813000003_seed_questions.sql` — インタビュー設問6問

### 3. シードデータの投入

`supabase start`(ローカル)の場合は `supabase/seed.sql` が `db reset` 時に自動投入され、ダミー組織2件と招待コード(`KARIYA-2026` / `TOYOTA-2026`)が作成されます。

ホスト型プロジェクトにリンクした場合は、同じ内容を手動で流してください。

```bash
psql "$SUPABASE_DB_URL" -f supabase/seed.sql
```

### 4. 環境変数

`.env.example` を `.env.local` にコピーし、値を埋めてください。

```bash
cp .env.example .env.local
```

| 変数名 | 用途 | サーバー専用 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase プロジェクトURL | いいえ(ブラウザに公開) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon キー(RLSで保護される前提) | いいえ(ブラウザに公開) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role キー。RLSを迂回する | **はい**(`NEXT_PUBLIC_` を付けない) |
| `ANTHROPIC_API_KEY` | Claude APIキー。未設定なら決定的フォールバックで動作(NFR-4) | **はい** |
| `ANTHROPIC_MODEL_CONVERSATION` | アバター間会話生成に使うモデル。既定 `claude-sonnet-5` | **はい** |
| `ANTHROPIC_MODEL_EVALUATION` | 相性評価に使うモデル。既定 `claude-opus-5` | **はい** |
| `CRON_SECRET` | `/api/cron/matching` を保護するシークレット。未設定時は常に401 | **はい** |
| `MATCH_NOTIFY_THRESHOLD` | 通知を作成する総合スコアの閾値。既定 `75` | いいえ(サーバーのみで参照) |
| `MATCH_BATCH_LIMIT` | バッチ1回あたりの処理候補数上限。既定 `20` | いいえ(サーバーのみで参照) |
| `MAX_OPEN_MATCHES_PER_PROFILE` | 1参加者あたりの未判断マッチ数上限。既定 `3` | いいえ(サーバーのみで参照) |

`SUPABASE_SERVICE_ROLE_KEY` / `ANTHROPIC_API_KEY` / `CRON_SECRET` は、`src/lib/supabase/admin.ts` と一部の Server Action(`src/app/actions/invite.ts`、`src/lib/matching/pipeline.ts`、`src/app/actions/settings.ts` の `deleteAccount`)からのみ参照され、クライアントバンドルには含まれません(NFR-9)。

### 5. 開発サーバーの起動

```bash
npm run dev
```

`http://localhost:3000` を開くと、未ログインの場合は `/login` にリダイレクトされます。

## マッチングバッチの実行

マッチングバッチ(ペルソナ生成の再試行 → 候補生成 → アバター間会話 → 相性評価 → 閾値以上のマッチの通知)は `POST /api/cron/matching` で実行します。`CRON_SECRET` が未設定、または一致しない場合は常に `401` を返します(誤って公開状態で運用しないため)。

### ローカルでの手動実行

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/matching
```

成功時のレスポンス例:

```json
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

### 定期実行のスケジューリング(Vercel Cron の例)

`vercel.json` に以下を追加し、`CRON_SECRET` を Vercel の環境変数に設定してください(Vercel Cron からのリクエストには `Authorization` ヘッダーを付与できないため、実際にはヘッダー付与用のプロキシ関数を挟むか、`CRON_SECRET` をクエリ文字列やVercel側のCron Secretの仕組みで検証する構成に読み替えてください)。

```json
{
  "crons": [
    {
      "path": "/api/cron/matching",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

Vercel 以外(例: 汎用の cron / GitHub Actions)でスケジュールする場合は、上記の `curl` コマンドを好きな間隔で実行するだけで構いません。

## `ANTHROPIC_API_KEY` なしでの動作

`ANTHROPIC_API_KEY` を設定しなくても、アプリ全体が動作します(NFR-4)。

- ペルソナ生成: `src/lib/ai/fallback.ts` の決定的ルールでフォールバック生成(`personas.model = 'fallback'`)
- アバター間会話: `src/lib/ai/conversation.ts` がフォールバックの固定パターン会話を生成
- 相性評価: `src/lib/ai/compatibility.ts` がペルソナの `traits` から決定的にスコア・軸コメントを算出

いずれの場合も `model` カラムに `'fallback'` を記録し、LLM呼び出しの失敗が画面のクラッシュや待機状態の固着につながらないようにしています。

## RLS の検証

Postgres の Row Level Security はアプリの単体テスト(`npx vitest run`)では検証できないため、`supabase/tests/rls.sql` に**自動検証スイート(38項目)**を用意しています。フィクスチャの作成から後片付け(`rollback`)まで含まれており、1項目でも落ちればその場で例外を投げて中断します。最後まで流れて `ALL RLS CHECKS PASSED` が出れば全項目合格です。

Supabase のローカルスタック上で実行する場合:

```bash
supabase start
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -f supabase/tests/_bootstrap.sql \
  -f supabase/tests/rls.sql
```

Docker が使えない環境では、素の PostgreSQL 16 でも検証できます。`supabase/tests/_bootstrap.sql` が Supabase 側の前提(ロール `anon` / `authenticated` / `service_role`、`auth.users`、`auth.uid()`)を最小限に再現するため、マイグレーションは**無改変のまま**適用できます。

```bash
createdb rlstest
psql -d rlstest \
  -f supabase/tests/_bootstrap.sql \
  -f supabase/migrations/20260813000001_schema.sql \
  -f supabase/migrations/20260813000002_rls.sql \
  -f supabase/migrations/20260813000003_seed_questions.sql \
  -f supabase/tests/rls.sql
```

検証している内容(抜粋):

| ケース | 検証内容 |
|---|---|
| 1. 未判断 | 相手の `identities` が0行。閾値未満(`evaluated`)のマッチが見えない。相互accept前は面談枠が見えない |
| 2. 片側のみ accept | 相手の実名はまだ0行。`finalize_match_if_mutual` を呼んでも成立しない |
| 3. 相手が decline | **辞退した側の判断行が読めない。マッチの `status` も `notified` のまま変化しない**(NFR-2: 「未判断」と「辞退」が区別できない) |
| 4. 両者 accept | 実名・年代が1行返り、面談枠が3件見える。それでも相手の判断行そのものは読めない |
| 5. 冪等性 | `finalize_match_if_mutual` を二重に呼んでも面談枠3件・通知2件のまま増えない |
| 6. 第三者 | 無関係な参加者から、他人のマッチ・会話ログ・レポート・実名・面談枠・通知がすべて0行。`invite_codes` は権限エラーで拒否 |
| 7. 書き込み | 他人のマッチへの判断書き込み、判断の `UPDATE`、`interview_completed_at` / `organization_id` の改竄、`consume_invite_code` の直接実行、他人の `identities` 作成 — すべて拒否。自分の `notifications_enabled` の更新のみ通る |
| 8. 未認証 | `anon` から `profiles` / `identities` / `matches` / `match_decisions` がすべて権限エラーで拒否 |

なお `invite_codes` と `anon` からの各テーブルは、RLS で0行が返るのではなく **`grant` を与えていないためテーブルレベルの権限エラーで弾かれます**。0行返却より強い遮断です。

## 未実装(スコープ外)

`docs/06-implementation-plan.md` §4 で明示されているとおり、以下は本実装のスコープ外です。

- Web Push / メール通知の実配信(アプリ内の `notifications` テーブルへの記録のみ)
- 組織管理者向け画面(NFR-3: 人事非閲覧の方針により、意図的に実装しない)
- 会話ログの再生成・相性レポートの再評価をユーザーが要求する機能
- 複数マッチの同時進行UI(データモデルは複数マッチに対応済みだが、UIは最新1件を主に扱う)
- E2Eテスト(Playwright)
- 日本語以外の言語対応(i18n)

## テスト・検証コマンド

```bash
npx tsc --noEmit   # 型チェック
npx eslint .        # Lint
npx vitest run       # 単体テスト
npm run build         # 本番ビルド
```
