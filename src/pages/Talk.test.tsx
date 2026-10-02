import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Talk } from "@/pages/Talk";

vi.mock("rough-notation", () => ({
  annotate: () => ({ show: vi.fn(), remove: vi.fn() }),
}));

const history = [
  { id: 1, role: "user", content: "add bin bags", created_at: "2026-10-02T18:31:00Z" },
  { id: 2, role: "assistant", content: "On the list.", created_at: "2026-10-02T18:31:05Z" },
];

function stubFetch(handler: (url: string, init?: RequestInit) => unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) =>
      Promise.resolve(new Response(JSON.stringify(handler(url, init)))),
    ),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete window.pywebview;
});

describe("Talk", () => {
  it("shows the conversation as a transcript", async () => {
    stubFetch(() => history);
    render(<Talk />);
    expect(await screen.findByText("On the list.")).toBeInTheDocument();
    expect(screen.getByText("YOU")).toBeInTheDocument();
    expect(screen.getByText("FELT")).toBeInTheDocument();
  });

  it("sends through /v1/app on the phone", async () => {
    stubFetch((url) =>
      url.endsWith("/chat")
        ? {
            messages: [
              { id: 3, role: "user", content: "hi", created_at: "2026-10-02T18:40:00Z" },
              { id: 4, role: "assistant", content: "Hey.", created_at: "2026-10-02T18:40:02Z" },
            ],
          }
        : history,
    );
    render(<Talk />);
    await screen.findByText("On the list.");
    await userEvent.type(screen.getByLabelText("Write to Felt"), "hi{Enter}");
    expect(await screen.findByText("Hey.")).toBeInTheDocument();
  });

  it("goes through the tray when it's the desktop window", async () => {
    const textChat = vi.fn().mockResolvedValue({ ok: true });
    window.pywebview = { api: { text_chat: textChat } };
    stubFetch(() => history);
    render(<Talk />);
    await screen.findByText("On the list.");
    await userEvent.type(screen.getByLabelText("Write to Felt"), "hello{Enter}");
    await waitFor(() => expect(textChat).toHaveBeenCalledWith("hello"));
  });
});
