# 02. アーキテクチャ

## 1. 技術構成

| レイヤ | 採用技術 |
|---|---|
| フレームワーク | Next.js 15 (App Router) / React 19 / TypeScript strict |
| スタイル | Tailwind CSS v4（PoCのデザイントークンをCSS変数として移植） |
| DB / 認証 | Supabase（Postgres + Auth + RLS） |
| Supabaseクライアント | `@supabase/ssr`（Cookieベースのセッション） |
| LLM | Anthropic Claude API（`@anthropic-ai/sdk`） |
| テスト | Vitest（単体） |
| バッチ | Route Handler `/api/cron/matching` を Vercel Cron などから叩く |
| デプロイ | Vercel を想定（他PaaSでも可） |

## 2. ディレクトリ構成

```
.
├── docs/                        # 設計ドキュメント（本書一式）
├── poc/                         # 元のPoCデモ（保存用・改変しない）
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   │   ├── 20260813000001_schema.sql
│   │   ├── 20260813000002_rls.sql
│   │   └── 20260813000003_seed_questions.sql
│   └── seed.sql                 # ローカル開発用のダミー組織・招待コード
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   ├── page.tsx                     # ルート: 状態に応じて振り分け
│   │   ├── login/page.tsx               # メールOTP
│   │   ├── invite/page.tsx              # [1] 招待コード + 実名登録
│   │   ├── interview/page.tsx           # [2] AIインタビュー
│   │   ├── waiting/page.tsx             # [3] アバターが会話中
│   │   ├── home/page.tsx                # [H] ホーム
│   │   ├── notifications/page.tsx       # [4] お知らせ
│   │   ├── matches/[matchId]/
│   │   │   ├── page.tsx                 # [5] 会話ログ・相性レポート
│   │   │   ├── declined/page.tsx        # [5b] 辞退完了
│   │   │   ├── reveal/page.tsx          # [6] 実名開示 + 日程選択
│   │   │   └── done/page.tsx            # [7] 送信完了
│   │   ├── mypage/page.tsx
│   │   ├── profile/page.tsx
│   │   ├── privacy/page.tsx
│   │   ├── faq/page.tsx
│   │   ├── settings/page.tsx
│   │   ├── api/
│   │   │   ├── cron/matching/route.ts   # バッチ
│   │   │   └── auth/callback/route.ts   # OTPコールバック
│   │   └── actions/                     # Server Actions
│   │       ├── invite.ts
│   │       ├── interview.ts
│   │       ├── notifications.ts
│   │       ├── decisions.ts
│   │       ├── schedule.ts
│   │       └── settings.ts
│   ├── components/                      # PoCのUIをReactコンポーネント化
│   │   ├── shell/  (PhoneFrame, AppHeader, TabBar, Toast, Sheet, Loading)
│   │   ├── ui/     (Button, Card, Field, Bubble, Bar, Steps, IconSprite)
│   │   └── feature/(InterviewChat, ReportAxes, ConversationLog, SlotPicker, ...)
│   ├── lib/
│   │   ├── supabase/  (server.ts, client.ts, admin.ts, middleware.ts)
│   │   ├── ai/        (client.ts, persona.ts, conversation.ts, compatibility.ts, fallback.ts, schema.ts)
│   │   ├── matching/  (candidates.ts, pipeline.ts, scoring.ts)
│   │   ├── auth/      (guards.ts)
│   │   └── constants.ts                 # 表示文言・ステップ定義・軸定義
│   ├── types/
│   │   ├── database.ts                  # supabase gen types で生成
│   │   └── domain.ts
│   └── middleware.ts                    # セッション更新 + 未登録者のリダイレクト
├── tests/
│   ├── scoring.test.ts
│   ├── fallback.test.ts
│   └── candidates.test.ts
├── scripts/
│   └── push-to-new-repo.sh
├── .env.example
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── vitest.config.ts
└── package.json
```

## 3. 3つのSupabaseクライアント

| ファイル | キー | 用途 | 使ってよい場所 |
|---|---|---|---|
| `lib/supabase/client.ts` | anon | ブラウザ | Client Component |
| `lib/supabase/server.ts` | anon + ユーザーCookie | RLS適用の読み書き | Server Component / Server Action |
| `lib/supabase/admin.ts` | **service_role** | RLSを迂回するバッチ処理 | `api/cron/*` と招待コード検証のみ |

> **`admin.ts` は `import 'server-only'` を先頭に置き、誤ってクライアントへ混入した時点でビルドを失敗させる。**

## 4. 認可の階層

匿名性は3層で守る。上位が破れても下位で止まる設計にする。

1. **middleware**: 未ログイン → `/login`、未登録 → `/invite`、インタビュー未完了 → `/interview`
2. **Server Component / Action のガード**: `requireProfile()` が profile を返せなければ `redirect()`
3. **RLS**: 上記2つを迂回されても、Postgres が行を返さない（最終防衛線）

**3 が唯一の信頼できる境界**であり、1・2 は UX のためのものと位置づける。

## 5. リクエストフロー

### 5.1 通常の画面表示

```
ブラウザ → middleware(セッション更新/リダイレクト)
        → Server Component
        → createServerClient(anon + Cookie) → Postgres (RLS適用)
        → HTML
```

### 5.2 マッチングバッチ

```
Cron → POST /api/cron/matching  (Authorization: Bearer CRON_SECRET)
     → createAdminClient(service_role)
     → 1. ペルソナ未生成の参加者を処理     (Claude / fallback)
       2. 新規マッチ候補を選定
       3. 候補ごとに会話生成               (Claude / fallback)
       4. 相性レポート生成                 (Claude / fallback)
       5. 閾値以上なら notifications を両者に作成
     → 処理件数のサマリを返す
```

各ステップは独立して冪等。途中で失敗しても、状態カラム (`matches.status`) を見て次回の実行が続きから再開する。

### 5.3 マッチのステータス遷移

```
pending ──会話生成成功──▶ conversed ──評価成功──▶ evaluated
   │                                                  │
   └──────────── failed（3回失敗で停止） ◀────────────┘
                                                       │
                              閾値以上 ─────────────────┤
                                                       ▼
                                                    notified
                                                       │
                                          両者accept ──▶ mutual
                                          片方decline ─▶ closed
```

`closed` は辞退者の側にだけ意味を持つ。相手の画面は `notified` のまま変化しない（NFR-2）。

## 6. 環境変数

| 変数 | 公開 | 用途 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase プロジェクトURL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | anon キー |
| `SUPABASE_SERVICE_ROLE_KEY` | ❌ | バッチ・招待コード検証 |
| `ANTHROPIC_API_KEY` | ❌ | Claude API。**未設定ならフォールバック動作** |
| `ANTHROPIC_MODEL_CONVERSATION` | ❌ | 既定 `claude-sonnet-5` |
| `ANTHROPIC_MODEL_EVALUATION` | ❌ | 既定 `claude-opus-5` |
| `CRON_SECRET` | ❌ | バッチの認証 |
| `MATCH_NOTIFY_THRESHOLD` | ❌ | 既定 `75` |
| `MATCH_BATCH_LIMIT` | ❌ | 1回の実行で処理する候補上限。既定 `20` |

## 7. デザインの移植方針

PoC の `style.css` は「iPhone枠の中に収まるモバイルUI」を前提としている。本番実装では：

- **`.phone` の固定枠とスケーリングは廃止**し、通常のレスポンシブなモバイルWebにする（`max-width: 480px` で中央寄せ）。
- 色・角丸・影・タイポグラフィのトークンは `globals.css` の CSS 変数として維持する。
- SVGスプライトは `components/ui/IconSprite.tsx` として1回だけレンダリングし、`<use href="#i-...">` の使い方はそのまま継承する。
- アニメーション（バーの伸長・開示カードのフェードイン・タイピング演出）は `prefers-reduced-motion` を尊重する。
- 端末ステータスバー（9:41 / 電波・Wi-Fi・電池）はデモ用装飾なので**移植しない**。
