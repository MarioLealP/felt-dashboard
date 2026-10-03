import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Controls } from "@/pages/Controls";
import { stopAt, timeLeft, timerLabel } from "@/pages/controls/Tile";
import { moodWords } from "@/pages/controls/words";

const page = {
  version: 1,
  hide: { on: false, until: null },
  quiet: { on: true, until: "2026-10-03T21:30:00Z" },
  timers: [15, 30, 60, 480],
  parts: { brain: true, model: true, voice: null, desktop: true, animation: false },
  desktop: { presence: "hidden", hushed: true, mood: null },
  mood: { energy: 0.2, happiness: 0.8 },
};

function stubFetch(posted: unknown[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn((_url: string, init?: RequestInit) => {
      if (init?.method === "POST") posted.push(JSON.parse(String(init.body)));
      return Promise.resolve(new Response(JSON.stringify(page)));
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("Controls", () => {
  it("snaps a slide to the timer stops and counts down", () => {
    expect(stopAt(0, [15, 30, 60, 480])).toBe(15);
    expect(stopAt(0.6, [15, 30, 60, 480])).toBe(60);
    expect(stopAt(1, [15, 30, 60, 480])).toBe(480);
    expect(timerLabel(30)).toBe("30 min");
    expect(timerLabel(480)).toBe("8 h");
    const now = new Date("2026-10-03T21:00:00Z");
    expect(timeLeft(new Date("2026-10-03T21:30:00Z"), now)).toBe("30m left");
    expect(timeLeft(new Date("2026-10-03T22:45:00Z"), now)).toBe("1h 45m left");
  });

  it("puts her mood in words", () => {
    expect(moodWords({ energy: 0.2, happiness: 0.8 })).toBe("I'm tired and cheerful.");
    expect(moodWords({})).toBe("I'm fine. nothing special.");
    expect(moodWords(null)).toMatch(/desktop's off/);
  });

  it("shows the switches, the desktop and each part", async () => {
    stubFetch([]);
    render(<Controls />);
    expect(await screen.findByText("quiet. I'll keep it to myself.")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /^quiet: .*left$/ }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(screen.getByText("on the desktop: off the screen, hushed.")).toBeTruthy();
    expect(screen.getByText("not set up")).toBeTruthy();
    expect(screen.getByText("I'm tired and cheerful.")).toBeTruthy();
  });

  it("a tap turns hide on until turned off", async () => {
    const posted: unknown[] = [];
    stubFetch(posted);
    render(<Controls />);
    const hide = await screen.findByRole("button", { name: "hide: off" });
    fireEvent.pointerDown(hide, { clientX: 10, pointerId: 1 });
    fireEvent.pointerUp(hide, { clientX: 10, pointerId: 1 });
    await waitFor(() => expect(posted).toEqual([{ name: "hide", on: true }]));
  });
});
