import { describe, expect, it } from "vitest";
import { buildCandidatePairs, normalizePair, type CandidateProfile } from "@/lib/matching/candidates";

describe("normalizePair", () => {
  it("orders ids so profileAId < profileBId", () => {
    expect(normalizePair("b", "a")).toEqual({ profileAId: "a", profileBId: "b" });
    expect(normalizePair("a", "b")).toEqual({ profileAId: "a", profileBId: "b" });
  });
});

describe("buildCandidatePairs", () => {
  const profiles: CandidateProfile[] = [
    { id: "p1", organizationId: "org-a", openMatchCount: 0 },
    { id: "p2", organizationId: "org-a", openMatchCount: 0 },
    { id: "p3", organizationId: "org-b", openMatchCount: 0 },
    { id: "p4", organizationId: "org-b", openMatchCount: 0 },
  ];

  it("only pairs profiles from different organizations", () => {
    const pairs = buildCandidatePairs(profiles, [], 10, 100);
    for (const pair of pairs) {
      const a = profiles.find((p) => p.id === pair.profileAId);
      const b = profiles.find((p) => p.id === pair.profileBId);
      expect(a?.organizationId).not.toBe(b?.organizationId);
    }
    // p1-p3, p1-p4, p2-p3, p2-p4 の4組(同一組織どうしの p1-p2 / p3-p4 は含まれない)
    expect(pairs).toHaveLength(4);
  });

  it("normalizes profile_a_id < profile_b_id for every pair", () => {
    const pairs = buildCandidatePairs(profiles, [], 10, 100);
    for (const pair of pairs) {
      expect(pair.profileAId < pair.profileBId).toBe(true);
    }
  });

  it("excludes pairs that already exist in matches", () => {
    const existing = [{ profileAId: "p1", profileBId: "p3" }];
    const pairs = buildCandidatePairs(profiles, existing, 10, 100);
    const hasExisting = pairs.some((p) => p.profileAId === "p1" && p.profileBId === "p3");
    expect(hasExisting).toBe(false);
    expect(pairs).toHaveLength(3);
  });

  it("never produces duplicate pairs within a single run", () => {
    const pairs = buildCandidatePairs(profiles, [], 10, 100);
    const keys = pairs.map((p) => `${p.profileAId}:${p.profileBId}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("respects MAX_OPEN_MATCHES_PER_PROFILE", () => {
    const busyProfiles: CandidateProfile[] = [
      { id: "p1", organizationId: "org-a", openMatchCount: 1 },
      { id: "p2", organizationId: "org-a", openMatchCount: 0 },
      { id: "p3", organizationId: "org-b", openMatchCount: 0 },
      { id: "p4", organizationId: "org-b", openMatchCount: 0 },
    ];
    const pairs = buildCandidatePairs(busyProfiles, [], 1, 100);
    const p1Pairs = pairs.filter((p) => p.profileAId === "p1" || p.profileBId === "p1");
    expect(p1Pairs).toHaveLength(0);
  });

  it("stops once the batch limit is reached", () => {
    const pairs = buildCandidatePairs(profiles, [], 10, 2);
    expect(pairs).toHaveLength(2);
  });
});
