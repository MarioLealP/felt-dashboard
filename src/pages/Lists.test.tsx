import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { parseItems } from "@/lib/listsApi";
import { Lists } from "@/pages/Lists";

let items = [
  { id: 1, text: "milk", checked: 0 },
  { id: 2, text: "coffee", checked: 1 },
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
    { id: 1, text: "milk", checked: 0 },
    { id: 2, text: "coffee", checked: 1 },
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
        "PATCH /v1/shopping-list/1?checked=true",
        "DELETE /v1/shopping-list/2",
        "DELETE /v1/shopping-list/checked",
      ]),
    );
  });

  it("parses felt-core's rows", () => {
    expect(parseItems([{ id: 3, text: "x", checked: 1 }, { nope: 1 }])).toEqual([
      { id: 3, text: "x", checked: true },
    ]);
  });
});
