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

  describe("her asides", () => {
    const asides = {
      asides: [
        { id: 20, content: "I have standards, Mario.", created_at: "2026-10-03T09:00:00Z" },
        { id: 21, content: "A glorified secretary?", created_at: "2026-10-03T09:05:00Z" },
      ],
      more: 3,
    };
    const answered = {
      messages: [
        {
          id: 22,
          role: "user",
          content: "you do",
          created_at: "2026-10-03T09:10:00Z",
          answering: asides.asides[0],
        },
        { id: 23, role: "assistant", content: "Good.", created_at: "2026-10-03T09:10:02Z" },
      ],
    };

    it("wait under the transcript with the rest counted", async () => {
      stubFetch((url) => (url.endsWith("/asides") ? asides : history));
      render(<Talk />);
      expect(await screen.findByText("I have standards, Mario.")).toBeInTheDocument();
      expect(screen.getByText("+3 earlier in the margins")).toHaveAttribute("href", "#margins");
    });

    it("answering one sends its id, shows it above the line, and can be dropped", async () => {
      const posted: unknown[] = [];
      stubFetch((url, init) => {
        if (url.endsWith("/chat")) {
          posted.push(JSON.parse(String(init?.body)));
          return answered;
        }
        return url.endsWith("/asides") ? asides : history;
      });
      render(<Talk />);
      await userEvent.click(await screen.findByLabelText("Answer her: A glorified secretary?"));
      expect(screen.getByText("↳ re: A glorified secretary?")).toBeInTheDocument();
      await userEvent.click(screen.getByLabelText("Don't answer this"));
      expect(screen.queryByText(/↳ re:/)).toBeNull();

      await userEvent.click(screen.getByLabelText("Answer her: I have standards, Mario."));
      expect(screen.getByPlaceholderText("answer her…")).toHaveFocus();
      await userEvent.type(screen.getByLabelText("Write to Felt"), "you do{Enter}");
      expect(await screen.findByText("Good.")).toBeInTheDocument();
      expect(posted).toEqual([{ message: "you do", answering: 20 }]);
      expect(screen.getByText("↳ I have standards, Mario.")).toBeInTheDocument();
      expect(screen.queryByText(/↳ re:/)).toBeNull();
    });

    it("answering skips the tray, which can't carry it yet", async () => {
      const textChat = vi.fn().mockResolvedValue({ ok: true });
      window.pywebview = { api: { text_chat: textChat } };
      stubFetch((url) => {
        if (url.endsWith("/chat")) return answered;
        return url.endsWith("/asides") ? asides : history;
      });
      render(<Talk />);
      await userEvent.click(await screen.findByLabelText("Answer her: I have standards, Mario."));
      await userEvent.type(screen.getByLabelText("Write to Felt"), "you do{Enter}");
      expect(await screen.findByText("Good.")).toBeInTheDocument();
      expect(textChat).not.toHaveBeenCalled();
    });
  });
});
