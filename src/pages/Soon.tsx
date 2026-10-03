import { Gutter } from "@/components/Page";
import type { PageName } from "@/lib/route";

type Unbuilt = Exclude<PageName, "talk" | "margins" | "systems" | "lists">;

const NEXT: Record<Unbuilt, { title: string; ticket: string; line: string; more?: string[] }> = {
  diary: {
    title: "Our diary",
    ticket: "WP-42.4",
    line: "your morning brief on top, my note below. soon.",
  },
  settings: {
    title: "Settings",
    ticket: "later",
    line: "things you tune about me once in a while.",
    more: [
      "the games I watch for news (WP-49)",
      "the senders I keep quiet about (WP-43)",
      "what I remember about you, yours to fix",
      "on the desktop: every keybind, in one place",
    ],
  },
  controls: {
    title: "Controls",
    ticket: "WP-42.5",
    line: "am I up, how I'm doing, quiet mode, hush. next.",
  },
};

/** A page whose section isn't built yet, written in her hand. */
export function Soon({ page }: { page: Unbuilt }) {
  const next = NEXT[page];
  return (
    <header className="flex pt-10 pr-16">
      <Gutter>{next.ticket}</Gutter>
      <div className="flex flex-col gap-1 pl-3.5">
        <h1 className="m-0 text-xl font-black">{next.title}</h1>
        <p className="font-hand m-0 text-[15px] leading-[30px] text-[#b9cdb5]">{next.line}</p>
        {next.more?.map((m) => (
          <p key={m} className="font-hand m-0 text-[14px] leading-[30px] text-[#6f6672]">
            – {m}
          </p>
        ))}
      </div>
    </header>
  );
}
