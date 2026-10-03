import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { pendingAnswer, clearPendingAnswer } from "@/lib/answer";
import { Margins, sourceLabel } from "@/pages/Margins";

const lines = [
  {
    id: 5,
    kind: "remark",
    source: "remark",
    content: "Spreadsheets again?",
    created_at: "2026-10-03T09:00:00Z",
    read: true,
  },
  {
    id: 6,
    kind: "event",
    source: "song",
    content: "Good song.",
    created_at: "2026-10-03T09:05:00Z",
    read: false,
  },
  {
    id: 7,
    kind: "alarm",
    source: "alarm",
    content: "Alarm: stretch",
    created_at: "2026-10-03T09:10:00Z",
    read: true,
  },
];

function stubFetch(posted: unknown[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      if (url.endsWith("/margins/mark")) posted.push(JSON.parse(String(init?.body)));
      const body = url.endsWith("/margins/mark") ? { changed: 1 } : lines;
      return Promise.resolve(new Response(JSON.stringify(body)));
    }),
  );
}

function nth(elements: HTMLElement[], i: number): HTMLElement {
  const el = elements[i];
  if (!el) throw new Error(`no element ${i}`);
  return el;
}

afterEach(() => {
  vi.unstubAllGlobals();
  clearPendingAnswer();
  window.location.hash = "";
});

describe("Margins", () => {
  it("labels where each line came from", () => {
    expect(sourceLabel("remark")).toBe("SCREEN");
    expect(sourceLabel("calendar_15")).toBe("CALENDAR");
    expect(sourceLabel("email")).toBe("MAIL");
    expect(sourceLabel("song")).toBe("SONG");
  });

  it("shows her lines, marks the new one read after a moment", async () => {
    const posted: unknown[] = [];
    const onUnreadChange = vi.fn();
    stubFetch(posted);
    render(<Margins onUnreadChange={onUnreadChange} />);
    expect(await screen.findByText("Good song.")).toBeInTheDocument();
    expect(screen.getByText("SCREEN")).toBeInTheDocument();
    expect(screen.getByText("1 new since you last looked.")).toBeInTheDocument();
    expect(screen.getByLabelText("new")).toBeInTheDocument();
    await waitFor(() => expect(posted).toEqual([{ ids: [6], action: "read" }]), {
      timeout: 3000,
    });
    expect(onUnreadChange).toHaveBeenCalled();
  });

  it("dismiss and later take the line away", async () => {
    const posted: unknown[] = [];
    stubFetch(posted);
    render(<Margins />);
    await screen.findByText("Spreadsheets again?");
    await userEvent.click(nth(screen.getAllByText("dismiss"), 0));
    expect(screen.queryByText("Spreadsheets again?")).toBeNull();
    await userEvent.click(nth(screen.getAllByText("later"), 0));
    await waitFor(() => expect(posted).toContainEqual({ ids: [6], action: "snooze", hours: 3 }));
    expect(posted).toContainEqual({ ids: [5], action: "dismiss" });
  });

  it("answer her hands the line to Talk; alarms can't be answered", async () => {
    stubFetch([]);
    render(<Margins />);
    await screen.findByText("Good song.");
    // two answerable lines, the alarm has no "answer her"
    expect(screen.getAllByText("answer her")).toHaveLength(2);
    await userEvent.click(nth(screen.getAllByText("answer her"), 1));
    expect(window.location.hash).toBe("#talk");
    expect(pendingAnswer()?.content).toBe("Good song.");
  });
});
