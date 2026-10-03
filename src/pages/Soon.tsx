import { Gutter } from "@/components/Page";
import type { PageName } from "@/lib/route";

type Unbuilt = Exclude<PageName, "talk" | "margins" | "systems" | "lists">;

const NEXT: Record<Unbuilt, { title: string; ticket: string; line: string }> = {
  diary: {
    title: "Our diary",
    ticket: "WP-42.4",
    line: "your morning brief on top, my note below. soon.",
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
      </div>
    </header>
  );
}
