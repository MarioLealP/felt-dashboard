import { afterEach, describe, expect, it, vi } from "vitest";

import { connect, forgetLogin, ntfyBase, parseAlerts, savedLogin } from "@/lib/ntfy";

afterEach(() => {
  vi.unstubAllGlobals();
  forgetLogin();
});

describe("ntfy", () => {
  it("lives next to the app", () => {
    expect(ntfyBase("felt.clockmost.com")).toBe("https://ntfy.clockmost.com");
  });

  it("reads ntfy's poll answer, newest first, messages only", () => {
    const text = [
      JSON.stringify({ id: "a", event: "message", time: 100, title: "old", priority: 3 }),
      JSON.stringify({ id: "k", event: "keepalive", time: 150 }),
      "not json",
      JSON.stringify({
        id: "b",
        event: "message",
        time: 200,
        title: "new",
        message: "m",
        priority: 5,
      }),
    ].join("\n");
    const alerts = parseAlerts(text);
    expect(alerts.map((a) => a.id)).toEqual(["b", "a"]);
    expect(alerts[0]?.priority).toBe(5);
  });

  it("keeps a login only if ntfy accepts it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("", { status: 401 }))),
    );
    await expect(connect({ user: "mario", password: "nope" })).rejects.toThrow("didn't accept");
    expect(savedLogin()).toBeNull();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(""))),
    );
    await connect({ user: "mario", password: "right" });
    expect(savedLogin()).toEqual({ user: "mario", password: "right" });
  });
});
