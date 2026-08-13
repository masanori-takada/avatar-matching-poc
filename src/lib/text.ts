/**
 * テキスト整形の共通ユーティリティ。
 */

/**
 * `text` が `maxLength` を超える場合のみ切り詰め、末尾に "…" を付ける
 * (呼び出し元が puts the result within `maxLength` 文字に収める)。
 * 短い場合はそのまま返す — パディングは行わない。
 *
 * finding #11: 以前の実装は `padEnd(60, "。")` で短い総評を句点で埋めていて、
 * 「。。。。」のような不自然な連続が 総評カードに表示されていた。
 * 決定的フォールバックの総評はテンプレート文なので十分な長さがあり、
 * 実際に切り詰めが必要になるのは長い場合だけ — 短い場合にパディングする
 * 理由はそもそも無い。
 */
export function truncateWithEllipsis(text: string, maxLength: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  if (maxLength <= 1) {
    return trimmed.slice(0, maxLength);
  }
  return `${trimmed.slice(0, maxLength - 1)}…`;
}
