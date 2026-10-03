import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Settings } from "@/pages/Settings";

let claude = true;

afterEach(() => {
  vi.unstubAllGlobals();
  claude = true;
});

describe("Settings", () => {
  it("turns Claude looking into alerts off and on", async () => {
    const posted: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) => {
        if (init?.method === "POST") {
          const body = JSON.parse(String(init.body)) as { claude_alerts: boolean };
          posted.push(body);
          claude = body.claude_alerts;
        }
        return Promise.resolve(new Response(JSON.stringify({ claude_alerts: claude })));
      }),
    );
    render(<Settings />);
    const toggle = await screen.findByRole("switch", { name: /Claude looks into alerts/ });
    await waitFor(() => expect(toggle.getAttribute("aria-checked")).toBe("true"));
    await userEvent.click(toggle);
    await waitFor(() => expect(toggle.getAttribute("aria-checked")).toBe("false"));
    expect(posted).toEqual([{ claude_alerts: false }]);
    expect(screen.getByText(/Never: secrets/)).toBeTruthy();
  });
});
