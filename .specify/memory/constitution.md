<!--
Sync Impact Report
- Version change: (none) → 1.0.0
- Rationale: initial ratification. This project (docs/00〜06) was already fully
  specified and implemented before spec-kit was adopted; this constitution
  codifies the principles that implementation was already built and reviewed
  against, so that future work done via /speckit-specify → /speckit-plan →
  /speckit-tasks → /speckit-implement stays consistent with it.
- Modified principles: n/a (initial)
- Added sections: Core Principles (I–VII), Technology Constraints,
  Development Workflow, Governance
- Removed sections: n/a
- Templates requiring follow-up: none — plan/spec/tasks templates reference
  "Constitution Check" generically and require no project-specific edits.
- Deferred TODOs: RATIFICATION_DATE set to the date this constitution was
  authored (2026-08-13), since no earlier formal ratification exists.
-->

# AIアバター自動マッチング Constitution

## Core Principles

### I. 匿名性は RLS で担保する(アプリ層を信頼しない)

実名・所属などの識別情報は、Postgres の Row Level Security によってのみ保護
される。Server Component・Server Action・middleware でのガード（未登録リダ
イレクトなど)は UX のためのものであり、**認可の最終防衛線として扱ってはなら
ない**。ある画面やAPIが実名を表示すべきでない状況で、アプリ層のバグにより
誤って表示要求が飛んだとしても、RLS が0行を返すことでデータは漏れない状態
を常に維持する。

- `identities` テーブルへの SELECT は、本人自身か、`is_revealed_partner()`
  が true を返す場合(=相互 `accept` が成立した相手)のみ許可する。
- 新しいテーブル・列を追加する際は、まず「この行は誰から読めるべきか」を
  RLS ポリシーとして定義してから、それを前提にアプリコードを書く。
- service_role(RLSを迂回するキー)を使うコードパスは、`docs/02-architecture.md`
  §3 に列挙された箇所に限定し、新規に追加する場合はその理由をコードコメント
  と `docs/` に明記する。

理由: 匿名性はこのプロダクトの提供価値そのものであり、UI上の見落としが実名
漏洩に直結してはならない。RLS は「アプリのどのコードパスを通っても越えられ
ない」唯一の境界である。

### II. 「未判断」と「辞退」は区別できない(NFR-2)

参加者の判断(`match_decisions`)は、相手からは一切参照できない。マッチが
辞退によって閉じられた場合も、そのことをマッチ自体の共有状態(`matches.status`
など、両者から見えるカラム)に反映してはならない。

- 辞退操作は、辞退した本人の `match_decisions` 行を作成するのみで、
  相手から見える `matches` の状態を変更しない。
- 「進行中のマッチ数」等の集計ロジックは、共有カラムではなく本人視点の
  判断テーブルを都度クエリして導出する。
- 新機能で「相手が反応した/しない」を表現する必要が生じた場合、まず
  この原則に抵触しないかを検討し、抵触するなら実装を見送るか設計を変更する。

理由: 「断られる体験」を発生させないことが、このプロダクトの中核体験。
共有状態が1ビットでも辞退を示唆すれば、その体験は壊れる。

### III. 人事・運営はマッチ内容を閲覧できない(NFR-3)

組織管理者ロール、マッチ閲覧用の管理画面、個人を特定できる集計 API は実装
しない。組織向けに何らかの利用状況を提供する場合も、個人のマッチを特定でき
ない匿名カウント(例: 組織単位の参加者数)に限定する。

理由: 「勤務先や運営に知られない」という保証が信頼の前提であり、これを
破る機能は、後からどれほど有用に見えても追加しない。

### IV. LLM はオプショナル(決定的フォールバック必須)

`ANTHROPIC_API_KEY` が未設定、または Claude API 呼び出しが失敗しても、
全ての画面・全てのバッチ処理が動作し続けなければならない。LLM 生成を伴う
機能を追加する場合、必ず対になる決定的フォールバック関数を同時に実装する。

- LLM の構造化出力は必ずスキーマ検証(zod 等)を通す。検証に失敗した出力を
  そのまま保存・表示してはならない。
- フォールバックは疑似乱数ではなく、入力から一意に決まる決定的なロジックで
  実装し、テスト可能にする。
- 生成結果には、実際に使用したモデル名(または `'fallback'`)を記録し、
  後から追跡できるようにする。

理由: デモ・開発・CI・API障害時のいずれでも、プロダクトの体験が損なわれない
ことを保証するため。

### V. 型安全とテスト可能性

TypeScript は strict モードを維持し、`any` 型と根拠のない non-null アサー
ション(`!`)を使わない。DB の型は `src/types/database.ts` をスキーマと一致
させて手書き、または Supabase から生成した型を使う。純粋なロジック(スコア
リング、フォールバック生成、候補選定など)は `src/lib/` に切り出し、
`tests/` で単体テストする。

- `npx tsc --noEmit` / `npx eslint .` / `npx vitest run` / `npm run build`
  の4つが通らない変更はマージしない。
- RLS のようにアプリの単体テストで検証できない振る舞いは、
  `supabase/tests/` に実データを用いた検証スクリプトを用意する。

理由: 匿名性・非対称性のような「一度も破ってはいけない」制約は、型とテスト
で継続的に検証できる形にしておかなければ、将来の変更で静かに壊れる。

### VI. 日本語UI・PoC由来の文言を尊重する

利用者向けの文言は日本語とし、PoC(`poc/`)で確立された言い回し・トーンを、
同等の画面がある限り踏襲する。文言はコンポーネントに直書きせず
`src/lib/constants.ts` の `COPY` にまとめる。

理由: PoC は展示・ユーザーテストを経て磨かれた文言であり、実装の都合で
トーンを変えると体験の一貫性が失われる。

### VII. 仕様 → 実装 → レビューの三層体制

新機能・大きな変更は、(1) 仕様・設計ドキュメントの作成、(2) 実装、
(3) 匿名性・認可・冪等性を主眼とする独立したコードレビュー、の三層を経る。
spec-kit を使う場合は `/speckit-specify` → `/speckit-plan` →
`/speckit-tasks` → `/speckit-implement` がこの三層のうち (1)(2) を担い、
(3) は実装後に別途、本 Constitution の各原則(特に I・II・III)を
チェックリストとして行う。

理由: 認可・匿名性のバグはレビューでしか捕まえられないことが多く、実装者
自身のセルフレビューだけでは見落としが残ることが、このプロジェクトの
過去のレビュー(13件の指摘、うち2件は認可の穴)で実証されている。

## Technology Constraints

- フレームワーク: Next.js (App Router) / React / TypeScript strict。
- データ: Supabase(Postgres + Auth + RLS)。3種のクライアント
  (anon ブラウザ用 / anon+Cookie サーバー用 / service_role)を用途ごとに
  分離し、service_role は `import 'server-only'` を先頭に置く。
- LLM: Anthropic Claude API。構造化出力は tool use + zod 検証。
- 秘匿情報(`SUPABASE_SERVICE_ROLE_KEY` / `ANTHROPIC_API_KEY` / `CRON_SECRET`)
  には `NEXT_PUBLIC_` を付与しない。
- `dangerouslySetInnerHTML` は使用しない。

## Development Workflow

- 新機能は spec-kit のワークフロー(`/speckit-specify` 等)、または
  `docs/` 配下への追記のいずれかで、実装前に要件・データモデルへの影響・
  RLS への影響を明文化する。
- マイグレーションは追記のみ(既存マイグレーションファイルの改変は、実DB
  未適用の開発初期を除き行わない)。
- コードレビューは本 Constitution の原則、特に I(RLS)・II(非対称性)・
  III(非閲覧)・IV(フォールバック)への抵触を最優先でチェックする。
- 全ての変更は `npx tsc --noEmit && npx eslint . && npx vitest run &&
  npm run build` を通してからコミットする。

## Governance

本 Constitution は `docs/` 配下の設計ドキュメントと矛盾しないことを前提と
し、矛盾が生じた場合は本ドキュメントを優先して `docs/` 側を更新する。

- 改定は `/speckit-constitution` を通じて行い、プレースホルダを残さない。
- バージョニングは semver に従う: 原則の削除・非互換な再定義は MAJOR、
  原則の追加や大幅な拡充は MINOR、文言修正は PATCH。
- 各 PR・レビューは、変更が本 Constitution の原則に抵触しないかを確認する。
  特に原則 I・II・III に抵触する変更は、レビューで明確な理由なく承認しない。

**Version**: 1.0.0 | **Ratified**: 2026-08-13 | **Last Amended**: 2026-08-13
