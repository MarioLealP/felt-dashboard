/* eslint-disable jsx-a11y/aria-role -- every render() below passes ChatMessage's
   own `role` prop ("user"|"assistant"), not a DOM/ARIA role attribute; oxlint
   can't tell them apart and a per-line disable keeps landing on the wrong
   line once oxfmt wraps the JSX attributes. */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ChatMessage } from "@/components/ChatMessage";

describe("ChatMessage", () => {
  it("renders plain text with no link when there's no URL", () => {
    render(<ChatMessage role="assistant" text="hello there" />);
    expect(screen.getByText("hello there")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders a URL in the reply as a clickable link", () => {
    render(
      <ChatMessage
        role="assistant"
        text="Image ready: https://comfy.clockmost.com/view?filename=x.png"
      />,
    );
    const link = screen.getByRole("link", {
      name: "https://comfy.clockmost.com/view?filename=x.png",
    });
    expect(link).toHaveAttribute("href", "https://comfy.clockmost.com/view?filename=x.png");
    expect(link).toHaveAttribute("target", "_blank");
    expect(screen.getByText(/Image ready:/)).toBeInTheDocument();
  });

  it("linkifies multiple URLs independently", () => {
    render(<ChatMessage role="assistant" text="see https://a.example/1 and https://b.example/2" />);
    expect(screen.getByRole("link", { name: "https://a.example/1" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "https://b.example/2" })).toBeInTheDocument();
  });

  it("shows YOU for the user role and FELT for the assistant role", () => {
    const { rerender } = render(<ChatMessage role="user" text="hi" />);
    expect(screen.getByText("YOU")).toBeInTheDocument();
    rerender(<ChatMessage role="assistant" text="hi" />);
    expect(screen.getByText("FELT")).toBeInTheDocument();
  });
});
