import { describe, expect, it } from "vitest";

const sources = import.meta.glob("./**/*.{ts,tsx,css}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

describe("widget portability", () => {
  it("does not import the harness", () => {
    const offenders = Object.entries(sources)
      .filter(([file]) => !file.includes(".test."))
      .filter(([, source]) => source.includes("/harness/") || source.includes('from "../harness'))
      .map(([file]) => file);
    expect(offenders).toEqual([]);
  });
});
