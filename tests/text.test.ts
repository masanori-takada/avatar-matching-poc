import { describe, expect, it } from "vitest";
import { truncateWithEllipsis } from "@/lib/text";

describe("truncateWithEllipsis", () => {
  it("returns short text unchanged (no padding)", () => {
    const text = "短い総評です。";
    expect(truncateWithEllipsis(text, 160)).toBe(text);
  });

  it("does not pad text that is under maxLength", () => {
    const text = "あ".repeat(10);
    const result = truncateWithEllipsis(text, 60);
    expect(result).toBe(text);
    expect(result).not.toMatch(/。{2,}/);
  });

  it("truncates text over maxLength and appends an ellipsis", () => {
    const text = "あ".repeat(200);
    const result = truncateWithEllipsis(text, 160);
    expect(result.length).toBe(160);
    expect(result.endsWith("…")).toBe(true);
    expect(result.startsWith("あ".repeat(159))).toBe(true);
  });

  it("trims surrounding whitespace before measuring length", () => {
    expect(truncateWithEllipsis("  hello  ", 20)).toBe("hello");
  });
});
