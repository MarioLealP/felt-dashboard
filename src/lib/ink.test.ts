import { describe, expect, it } from "vitest";

import { inkDuration, seedOf, seenMarks, splitByMarks, withSeed } from "@/lib/ink";

describe("seeded ink", () => {
  it("draws the same randomness for the same mark, every time", () => {
    const a = withSeed("m1-circle", () => [Math.random(), Math.random()]);
    const b = withSeed("m1-circle", () => [Math.random(), Math.random()]);
    const c = withSeed("m2-circle", () => [Math.random(), Math.random()]);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it("restores Math.random afterwards", () => {
    const real = Math.random;
    withSeed("x", () => Math.random());
    expect(Math.random).toBe(real);
  });

  it("gives different ids different seeds", () => {
    expect(seedOf("a")).not.toBe(seedOf("b"));
  });
});

describe("plays once", () => {
  it("remembers a seen mark", () => {
    localStorage.clear();
    expect(seenMarks.has("m9")).toBe(false);
    seenMarks.add("m9");
    expect(seenMarks.has("m9")).toBe(true);
  });
});

describe("pen speed", () => {
  it("is slower for longer marks, within 0.9 to 2.4 s", () => {
    const small = inkDuration(40, 20, "circle");
    const long = inkDuration(300, 24, "underline");
    expect(small).toBeGreaterThanOrEqual(900);
    expect(long).toBeLessThanOrEqual(2400);
    expect(long).toBeGreaterThan(small);
  });
});

describe("splitByMarks", () => {
  it("wraps the quoted words and keeps the rest", () => {
    const mark = { id: "a", quote: "bin bags" };
    expect(splitByMarks("add milk and bin bags please", [mark])).toEqual([
      { text: "add milk and " },
      { text: "bin bags", mark },
      { text: " please" },
    ]);
  });

  it("drops a mark whose quote isn't in the text", () => {
    expect(splitByMarks("hello", [{ id: "a", quote: "nope" }])).toEqual([{ text: "hello" }]);
  });
});
