import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { clearPendingAnswer, pendingAnswer } from "@/lib/answer";
import { idFromHash, pageFromHash } from "@/lib/route";
import { parseDetails } from "@/lib/systemsApi";
import { Systems } from "@/pages/Systems";

const honeypot = {
  id: 7,
  type: "honeypot",
  area: "security",
  tier: "urgent",
  state: "open",
  status: "needs-you",
  expected: false,
  title: "HONEYPOT: 192.168.10.201 banned",
  count: 1,
  first_at: "2026-10-03 21:27:53",
  last_at: "2026-10-03 21:27:53",
  line: "Someone poked the honeypot, Claude's on it.",
  followup: "Claude thinks it was your test - was it?",
  back_line: null,
  verdict: "needs-mario",
  missed: false,
  line_message_id: 41,
};
const deploy = {
  ...honeypot,
  id: 6,
  type: "update-deployed",
  area: "server",
  tier: "default",
  state: "noted",
  status: "fine",
  expected: true,
  title: "clockmost: update deployed",
  line: "Apps updated, all healthy.",
  followup: null,
  verdict: null,
  line_message_id: 40,
};
const page = {
  areas: [
    { name: "server", status: "fine", count: 0, incident_id: null },
    { name: "security", status: "needs-you", count: 1, incident_id: 7 },
  ],
  circled: 7,
  incidents: [honeypot, deploy],
};
const details = {
  ...honeypot,
  alerts: [
    { at: "2026-10-03 21:27:53", title: honeypot.title, message: "Telnet connect on port 23" },
  ],
  report: {
    verdict: "needs-mario",
    summary: "Touched 35 s after it went live; probably your test.",
    evidence: ["opencanary redeployed 21:27:18"],
    for_mario: "Was this you?",
    proposed_fix: "",
    confidence: "medium",
    couldnt_check: [],
    trail: [
      { said: "Checking the deploys first." },
      { tool: "Bash", input: "git log", output: "abc" },
    ],
  },
  session_id: "d768c434",
  handled_by: null,
  links: { zabbix: "https://zabbix.clockmost.com" },
};

function stubFetch(posted: string[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      if (init?.method === "POST") posted.push(url);
      const body = url.includes("/incidents/") ? (init?.method ? { ok: true } : details) : page;
      return Promise.resolve(new Response(JSON.stringify(body)));
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  clearPendingAnswer();
  window.location.hash = "";
});

describe("routing", () => {
  it("reads an incident id after the section", () => {
    expect(pageFromHash("#systems/12")).toBe("systems");
    expect(idFromHash("#systems/12")).toBe(12);
    expect(idFromHash("#systems")).toBeNull();
    expect(idFromHash("#systems/x")).toBeNull();
  });
});

describe("Systems", () => {
  it("shows the areas, circles what needs him, and the history", async () => {
    stubFetch([]);
    render(<Systems />);
    expect(await screen.findByText("one thing needs you.")).toBeTruthy();
    expect(screen.getByText("needs you")).toBeTruthy();
    expect(screen.getAllByText("Claude thinks it was your test - was it?").length).toBe(2);
    expect(screen.getByText("Apps updated, all healthy.")).toBeTruthy();
  });

  it("hands her line to Talk for ask Felt", async () => {
    stubFetch([]);
    render(<Systems />);
    await userEvent.click(await screen.findByRole("button", { name: "ask Felt" }));
    expect(pendingAnswer()?.id).toBe(41);
    expect(window.location.hash).toBe("#talk");
  });

  it("marks it handled", async () => {
    const posted: string[] = [];
    stubFetch(posted);
    render(<Systems />);
    await userEvent.click(await screen.findByRole("button", { name: "handled" }));
    await waitFor(() => expect(posted).toEqual(["/v1/app/incidents/7/handled"]));
  });

  it("opens one incident with Claude's report and his trail", async () => {
    stubFetch([]);
    window.location.hash = "#systems/7";
    render(<Systems />);
    expect(await screen.findByText(/probably your test/)).toBeTruthy();
    expect(screen.getByText("2 steps")).toBeTruthy();
    expect(screen.getByText("Telnet connect on port 23")).toBeTruthy();
    expect(screen.getByText("sudo felt-responder-join d768c434")).toBeTruthy();
  });

  it("parses felt-core's UTC times and drops a malformed report", () => {
    const d = parseDetails({ ...details, report: { verdict: "maybe" } });
    expect(d?.report).toBeNull();
    expect(d?.firstAt.toISOString()).toBe("2026-10-03T21:27:53.000Z");
  });
});
