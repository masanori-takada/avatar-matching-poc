/**
 * マッチ候補の選定(docs/05-ai-pipeline.md §6 手順2)。
 * DB非依存の純粋関数として実装し、テスト容易性を確保する。
 */

export interface CandidateProfile {
  id: string;
  organizationId: string;
  /** クローズ/失敗以外の状態にあるマッチの件数(このprofileが当事者) */
  openMatchCount: number;
}

export interface ProfilePair {
  profileAId: string;
  profileBId: string;
}

/** profile_a_id < profile_b_id に正規化する(docs/03-data-model.md §2.8) */
export function normalizePair(idX: string, idY: string): ProfilePair {
  return idX < idY ? { profileAId: idX, profileBId: idY } : { profileAId: idY, profileBId: idX };
}

function pairKey(pair: ProfilePair): string {
  return `${pair.profileAId}:${pair.profileBId}`;
}

/**
 * 異なる organization_id どうしの全組み合わせのうち、既存の matches に存在しない
 * ものを候補化する。1人あたりの未判断(open)マッチ数が maxOpenPerProfile を超えない
 * よう制限し、バッチ全体の候補数を limit で打ち切る。
 *
 * 同一組(A,B)は入力の重複有無に関わらず1度しか返さない(FR-3.2)。
 */
export function buildCandidatePairs(
  profiles: readonly CandidateProfile[],
  existingPairs: readonly ProfilePair[],
  maxOpenPerProfile: number,
  limit: number,
): ProfilePair[] {
  const existingKeys = new Set(existingPairs.map(pairKey));
  const openCounts = new Map(profiles.map((p) => [p.id, p.openMatchCount]));
  const seenThisRun = new Set<string>();
  const results: ProfilePair[] = [];

  for (let i = 0; i < profiles.length; i += 1) {
    for (let j = i + 1; j < profiles.length; j += 1) {
      if (results.length >= limit) {
        return results;
      }

      const a = profiles[i];
      const b = profiles[j];
      if (!a || !b) continue;
      if (a.organizationId === b.organizationId) continue;

      const pair = normalizePair(a.id, b.id);
      const key = pairKey(pair);
      if (existingKeys.has(key) || seenThisRun.has(key)) continue;

      const aCount = openCounts.get(a.id) ?? 0;
      const bCount = openCounts.get(b.id) ?? 0;
      if (aCount >= maxOpenPerProfile || bCount >= maxOpenPerProfile) continue;

      results.push(pair);
      seenThisRun.add(key);
      openCounts.set(a.id, aCount + 1);
      openCounts.set(b.id, bCount + 1);
    }
  }

  return results;
}
