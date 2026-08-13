#!/usr/bin/env bash
#
# このリポジトリの内容を、別名の新規リポジトリへ「別名保存」する。
#
#   使い方:
#     ./scripts/push-to-new-repo.sh [新リポジトリ名]
#
#   既定のリポジトリ名: 20260813-avatar-matching-poc-ver3
#
#   前提:
#     - gh CLI がインストール済みで `gh auth status` が通ること
#     - 現在のブランチに、push したい成果物がコミット済みであること
#
set -euo pipefail

NEW_REPO="${1:-20260813-avatar-matching-poc-ver3}"
OWNER="$(gh api user --jq .login)"
SRC_BRANCH="$(git rev-parse --abbrev-ref HEAD)"

echo "==> 移行元: $(git remote get-url origin) (${SRC_BRANCH})"
echo "==> 移行先: ${OWNER}/${NEW_REPO}"

if gh repo view "${OWNER}/${NEW_REPO}" >/dev/null 2>&1; then
  echo "==> リポジトリは既に存在します。そのまま push します。"
else
  echo "==> リポジトリを作成します（private）。"
  gh repo create "${OWNER}/${NEW_REPO}" \
    --private \
    --description "AIアバター自動マッチング — 本番実装 (Next.js + Supabase + Claude API)"
fi

# 既に new-origin があれば貼り替える
git remote remove new-origin 2>/dev/null || true
git remote add new-origin "https://github.com/${OWNER}/${NEW_REPO}.git"

# main（PoC ベースライン）を先に送り、続いて作業ブランチを送る
if git show-ref --verify --quiet refs/heads/main; then
  echo "==> main を push します（PoC ベースライン）。"
  git push -u new-origin main
fi

echo "==> ${SRC_BRANCH} を push します（本番実装）。"
git push -u new-origin "${SRC_BRANCH}"

echo
echo "完了: https://github.com/${OWNER}/${NEW_REPO}"
echo "本番実装は ${SRC_BRANCH} ブランチにあります。"
echo "main に取り込む場合:"
echo "  gh pr create --repo ${OWNER}/${NEW_REPO} --base main --head ${SRC_BRANCH} --fill"
