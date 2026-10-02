import { afterEach, describe, expect, it, vi } from "vitest";

import { getHistory, parseMessage, say } from "@/lib/appApi";

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
