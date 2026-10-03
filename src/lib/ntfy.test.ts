import { describe, expect, it } from "vitest";

import { parseAlerts } from "@/lib/ntfy";

describe("ntfy", () => {
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
});
