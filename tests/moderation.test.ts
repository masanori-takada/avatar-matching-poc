import { describe, expect, it } from "vitest";
import { containsForbiddenContent } from "@/lib/ai/moderation";

describe("containsForbiddenContent", () => {
  it("does not flag ordinary Japanese words that merely contain 部/課/様", () => {
    expect(containsForbiddenContent("会話の内容を全部覚えています。")).toBe(false);
    expect(containsForbiddenContent("そのうち一部だけ好きだそうです。")).toBe(false);
    expect(containsForbiddenContent("うちの人も同様のことを言っていました。")).toBe(false);
    expect(containsForbiddenContent("少し様子を見てみたいそうです。")).toBe(false);
  });

  it("flags company legal-entity names", () => {
    expect(containsForbiddenContent("株式会社カリヤ精機で働いているそうです。")).toBe(true);
    expect(containsForbiddenContent("有限会社の話が出ました。")).toBe(true);
  });

  it("flags department-like kanji runs ending in 部/課", () => {
    expect(containsForbiddenContent("品質保証部の話をしていました。")).toBe(true);
  });

  it("flags branch office mentions", () => {
    expect(containsForbiddenContent("支店に配属されたと聞きました。")).toBe(true);
  });

  it("flags honorifics preceded by a katakana name-like token", () => {
    expect(containsForbiddenContent("カリヤさんによろしくと伝えてください。")).toBe(true);
    expect(containsForbiddenContent("タナカ様からの伝言です。")).toBe(true);
  });
});
