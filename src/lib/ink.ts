/** Her ink (WP-42.1 spike, Mario: "generally looks great"):
 * - every mark is seeded from its id, so it looks the same on every redraw;
 * - it animates only the first time it's seen ("Ink should only hit once");
 * - pen speed follows how much ink is laid down. */

export function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedOf(id: string): number {
  let h = 2166136261;
  for (const c of id) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Runs `fn` with Math.random replaced by the mark's own seeded generator:
 * rough.js draws with Math.random, so this pins the shape. */
export function withSeed<T>(id: string, fn: () => T): T {
  const real = Math.random;
  Math.random = mulberry32(seedOf(id));
  try {
    return fn();
  } finally {
    Math.random = real;
  }
}

const KEY = "felt-ink-seen";

function readSeen(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

/** Marks already seen on this device. (Moves server-side in WP-42.3 so it
 * holds across phone and desktop.) */
export const seenMarks = {
  has(id: string): boolean {
    return readSeen().has(id);
  },
  add(id: string): void {
    const seen = readSeen();
    seen.add(id);
    try {
      localStorage.setItem(KEY, JSON.stringify([...seen].slice(-2000)));
    } catch {
      // storage blocked: the mark just replays next time
    }
  },
};

/** Milliseconds to draw a mark at about 110 px per second, 0.9 to 2.4 s. */
export function inkDuration(width: number, height: number, type: string): number {
  const length =
    type === "circle"
      ? (Math.PI * (width + height)) / 2
      : type === "box"
        ? 2 * (width + height)
        : type === "bracket"
          ? 2 * height + 24
          : width * (type === "underline" ? 2 : 1.4);
  return Math.round(Math.min(2400, Math.max(900, length / 0.11)));
}

/** Splits `text` around the first occurrence of each mark's quote, so the
 * marked words can be wrapped. Marks whose quote isn't in the text are
 * dropped (she quoted something that isn't there). */
export function splitByMarks<M extends { quote: string }>(
  text: string,
  marks: M[],
): Array<{ text: string; mark?: M }> {
  const found = marks
    .map((mark) => ({ mark, at: mark.quote ? text.indexOf(mark.quote) : -1 }))
    .filter((f) => f.at >= 0)
    .toSorted((a, b) => a.at - b.at);
  const parts: Array<{ text: string; mark?: M }> = [];
  let pos = 0;
  for (const { mark, at } of found) {
    if (at < pos) continue; // overlaps an earlier mark
    if (at > pos) parts.push({ text: text.slice(pos, at) });
    parts.push({ text: mark.quote, mark });
    pos = at + mark.quote.length;
  }
  if (pos < text.length) parts.push({ text: text.slice(pos) });
  return parts;
}
