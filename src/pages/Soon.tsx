import { Gutter } from "@/components/Page";
import type { PageName } from "@/lib/route";

const NEXT: Record<Exclude<PageName, "talk">, { title: string; ticket: string; line: string }> = {
  margins: {
    title: "In the margins",
    ticket: "WP-42.3",
    line: "everything I say on my own lands here. not yet, though.",
  },
  diary: {
    title: "Our diary",
    ticket: "WP-42.4",
    line: "your morning brief on top, my note below. soon.",
  },
  lists: {
    title: "Lists",
    ticket: "WP-42.5",
    line: "the shopping list moves in here. the old page still works meanwhile.",
  },
  systems: {
    title: "Systems",
    ticket: "WP-42.5",
    line: "server, backups, network. I'll tell you when something needs you.",
  },
};

/** A page whose section isn't built yet, written in her hand. */
export function Soon({ page }: { page: Exclude<PageName, "talk"> }) {
  const next = NEXT[page];
  return (
    <header className="flex pt-10 pr-16">
      <Gutter>{next.ticket}</Gutter>
      <div className="flex flex-col gap-1 pl-3.5">
        <h1 className="m-0 text-xl font-black">{next.title}</h1>
        <p className="font-hand m-0 text-[15px] leading-[30px] text-[#b9cdb5]">{next.line}</p>
      </div>
    </header>
  );
}
