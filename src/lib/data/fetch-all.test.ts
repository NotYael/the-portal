import { describe, expect, it } from "vitest";
import { fetchAllPages } from "./fetch-all";

/** A fake table of `total` rows served `size` at a time, recording each range asked for. */
function table(total: number) {
  const rows = Array.from({ length: total }, (_, i) => i);
  const ranges: [number, number][] = [];
  const page = async (from: number, to: number) => {
    ranges.push([from, to]);
    return { data: rows.slice(from, to + 1), error: null };
  };
  return { page, ranges };
}

describe("fetchAllPages", () => {
  it("returns every row across pages", async () => {
    const { page, ranges } = table(25);
    expect(await fetchAllPages(page, 10)).toEqual(Array.from({ length: 25 }, (_, i) => i));
    expect(ranges).toEqual([
      [0, 9],
      [10, 19],
      [20, 29],
    ]);
  });

  it("asks once more when the last page is exactly full", async () => {
    const { page, ranges } = table(20);
    expect(await fetchAllPages(page, 10)).toHaveLength(20);
    expect(ranges).toHaveLength(3);
  });

  it("returns an empty list for an empty table", async () => {
    const { page } = table(0);
    expect(await fetchAllPages(page, 10)).toEqual([]);
  });

  it("returns null when any page fails", async () => {
    let calls = 0;
    const page = async (from: number, to: number) => {
      calls += 1;
      return calls === 2 ? { data: null, error: new Error("boom") } : { data: Array.from({ length: to - from + 1 }, () => 1), error: null };
    };
    expect(await fetchAllPages(page, 10)).toBeNull();
  });
});
