import { describe, expect, it } from "vitest";
import { truncateUtf8 } from "../src/bot/telegram-limits";

const byteLength = (value: string): number =>
  new TextEncoder().encode(value).byteLength;

describe("truncateUtf8", () => {
  it("leaves text within the byte limit unchanged", () => {
    expect(truncateUtf8("سلام", byteLength("سلام"))).toBe("سلام");
  });

  it("truncates to the requested UTF-8 byte limit", () => {
    const result = truncateUtf8("سلام دنیا", 12);

    expect(result.endsWith("…")).toBe(true);
    expect(byteLength(result)).toBeLessThanOrEqual(12);
  });

  it("does not split surrogate-pair emoji", () => {
    const result = truncateUtf8("پیام 🙂🙂🙂", 18);

    expect(result).not.toContain("\uFFFD");
    expect(byteLength(result)).toBeLessThanOrEqual(18);
  });

  it("returns an empty string when even the ellipsis cannot fit", () => {
    expect(truncateUtf8("hello", 2)).toBe("");
  });
});
