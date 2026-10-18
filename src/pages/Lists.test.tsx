import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { parseItems } from "@/lib/listsApi";
import { Lists } from "@/pages/Lists";

let items = [
  { id: "0e2d6f2e8b764d4ebcef36de5d99d0ab", text: "milk", checked: false },
  { id: "1f3e7a3f9c875e5fcdf047ef6eaae1bc", text: "coffee", checked: true },
];

function stubFetch(calls: string[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? "GET"} ${url}${init?.body ? ` ${String(init.body)}` : ""}`);
      return Promise.resolve(new Response(JSON.stringify(init?.method ? { ok: true } : items)));
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  items = [
    { id: "0e2d6f2e8b764d4ebcef36de5d99d0ab", text: "milk", checked: false },
    { id: "1f3e7a3f9c875e5fcdf047ef6eaae1bc", text: "coffee", checked: true },
  ];
});

describe("Lists", () => {
  it("shows what's left to buy, crossed-off ones last", async () => {
    stubFetch([]);
    render(<Lists />);
    expect(await screen.findByText("one thing to buy.")).toBeTruthy();
    const names = screen.getAllByRole("button", { pressed: false }).map((b) => b.textContent);
    expect(names).toContain("milk");
    expect(screen.getByRole("button", { pressed: true }).textContent).toBe("coffee");
  });

  it("adds, crosses off, removes and clears", async () => {
    const calls: string[] = [];
    stubFetch(calls);
    render(<Lists />);
    await userEvent.type(await screen.findByLabelText("Add to the shopping list"), "eggs{enter}");
    await userEvent.click(screen.getByRole("button", { name: "milk" }));
    await userEvent.click(screen.getByRole("button", { name: "remove coffee" }));
    await userEvent.click(screen.getByRole("button", { name: "clear crossed off" }));
    await waitFor(() =>
      expect(calls.filter((c) => !c.startsWith("GET"))).toEqual([
        'POST /v1/shopping-list {"text":"eggs"}',
        "PATCH /v1/shopping-list/0e2d6f2e8b764d4ebcef36de5d99d0ab?checked=true",
        "DELETE /v1/shopping-list/1f3e7a3f9c875e5fcdf047ef6eaae1bc",
        "DELETE /v1/shopping-list/checked",
      ]),
    );
  });

  it("parses felt-core's rows: HA uids, and old numeric ids", () => {
    expect(
      parseItems([
        { id: "ab12", text: "x", checked: true },
        { id: 3, text: "y", checked: 1 },
        { nope: 1 },
      ]),
    ).toEqual([
      { id: "ab12", text: "x", checked: true },
      { id: "3", text: "y", checked: true },
    ]);
  });
});
