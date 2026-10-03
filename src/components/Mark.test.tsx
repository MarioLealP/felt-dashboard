import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Mark } from "@/components/Mark";

const annotate = vi.hoisted(() => vi.fn());
vi.mock("rough-notation", () => ({ annotate }));

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  annotate.mockReset();
  localStorage.clear();
});

function setup() {
  annotate.mockReturnValue({ show: vi.fn(), remove: vi.fn() });
  const posted: unknown[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((_url: string, init?: RequestInit) => {
      posted.push(JSON.parse(String(init?.body)));
      return Promise.resolve(new Response(JSON.stringify({ changed: 1 })));
    }),
  );
  return posted;
}

describe("her ink", () => {
  it("plays once, then tells the server so no other screen replays it", async () => {
    vi.useFakeTimers();
    const posted = setup();
    render(<Mark mark={{ id: "mk-new", type: "circle", quote: "bin bags" }}>bin bags</Mark>);
    expect(annotate.mock.calls[0]?.[1].animate).toBe(true);
    await act(() => vi.advanceTimersByTimeAsync(1500));
    expect(posted).toEqual([{ ids: ["mk-new"] }]);
  });

  it("a mark seen on another device is drawn without animating", async () => {
    vi.useFakeTimers();
    const posted = setup();
    render(<Mark mark={{ id: "mk-old", type: "underline", quote: "bin", seen: true }}>bin</Mark>);
    expect(annotate.mock.calls[0]?.[1].animate).toBe(false);
    await act(() => vi.advanceTimersByTimeAsync(1500));
    expect(posted).toEqual([]);
  });
});
