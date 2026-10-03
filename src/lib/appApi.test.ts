import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getHistory,
  markMargins,
  parseAsides,
  parseMarginLine,
  parseMessage,
  say,
} from "@/lib/appApi";

const row = {
  id: 7,
  role: "assistant",
  content: "Done.",
  created_at: "2026-10-02T18:31:00Z",
  marks: [
    { id: "m7", type: "circle", quote: "Done", note: "again?" },
    { id: "bad", type: "squiggle", quote: "x" },
  ],
};

afterEach(() => vi.unstubAllGlobals());

describe("parseMessage", () => {
  it("reads a row and keeps only valid marks", () => {
    const m = parseMessage(row);
    expect(m?.id).toBe(7);
    expect(m?.createdAt.toISOString()).toBe("2026-10-02T18:31:00.000Z");
    expect(m?.marks).toEqual([{ id: "m7", type: "circle", quote: "Done", note: "again?" }]);
  });

  it("drops malformed rows", () => {
    expect(parseMessage({ id: "7" })).toBeNull();
    expect(parseMessage(null)).toBeNull();
  });
});

describe("the API client", () => {
  it("pages history and sends the SSO cookie, never a token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([row])));
    vi.stubGlobal("fetch", fetchMock);
    const page = await getHistory(42);
    expect(page).toHaveLength(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/v1/app/history?before=42");
    expect(init.credentials).toBe("same-origin");
    expect(new Headers(init.headers).has("Authorization")).toBe(false);
  });

  it("explains an expired SSO session", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 401 })));
    await expect(say("hi")).rejects.toThrow(/SSO session/);
  });
});

describe("asides", () => {
  it("reads her picks and the count, tolerating junk", () => {
    const got = parseAsides({
      asides: [
        { id: 7, content: "I have standards.", created_at: "2026-10-03T09:00:00Z" },
        { id: "x" },
      ],
      more: 4,
    });
    expect(got.asides.map((a) => a.content)).toEqual(["I have standards."]);
    expect(got.more).toBe(4);
    expect(parseAsides([])).toEqual({ asides: [], more: 0 });
    expect(parseAsides({ asides: [], more: -1 }).more).toBe(0);
  });

  it("keeps the aside a line answers", () => {
    const m = parseMessage({
      id: 9,
      role: "user",
      content: "a bit",
      created_at: "2026-10-03T09:01:00Z",
      marks: [],
      answering: { id: 7, content: "Too specific?", created_at: "2026-10-03T09:00:00Z" },
    });
    expect(m?.answering?.content).toBe("Too specific?");
    const plain = { id: 10, role: "user", content: "hi", created_at: "2026-10-03T09:02:00Z" };
    expect(parseMessage({ ...plain, answering: null })?.answering).toBeUndefined();
  });

  it("sends the aside being answered", async () => {
    const bodies: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) => {
        bodies.push(JSON.parse(String(init?.body)));
        return Promise.resolve(new Response(JSON.stringify({ messages: [] })));
      }),
    );
    await say("a bit", 7);
    await say("hi");
    expect(bodies).toEqual([{ message: "a bit", answering: 7 }, { message: "hi" }]);
  });
});

describe("margins", () => {
  it("reads a line and drops malformed ones", () => {
    const line = parseMarginLine({
      id: 3,
      kind: "event",
      source: "song",
      content: "Good song.",
      created_at: "2026-10-03T09:00:00Z",
      read: false,
    });
    expect(line?.source).toBe("song");
    expect(line?.read).toBe(false);
    expect(parseMarginLine({ id: "3" })).toBeNull();
  });

  it("marks in one call, and skips an empty list", async () => {
    const bodies: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) => {
        bodies.push(JSON.parse(String(init?.body)));
        return Promise.resolve(new Response(JSON.stringify({ changed: 2 })));
      }),
    );
    expect(await markMargins([1, 2], "snooze", 3)).toBe(2);
    expect(await markMargins([], "read")).toBe(0);
    expect(bodies).toEqual([{ ids: [1, 2], action: "snooze", hours: 3 }]);
  });
});
