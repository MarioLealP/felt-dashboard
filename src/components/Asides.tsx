import { Gutter } from "@/components/Page";
import type { Remark } from "@/lib/appApi";

const time = (d: Date) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/** WP-42.2: her remarks since his last message, waiting under the transcript
 * (at most two, her pick; the rest are counted). Compact handwriting off the
 * ruled lines, unlike the conversation (Mario 10-03: "its like a note so
 * doesnt sit nicely on the lines"). Tapping one answers it. */
export function Asides({
  asides,
  more,
  answering,
  onAnswer,
}: {
  asides: Remark[];
  more: number;
  answering: number | null;
  onAnswer: (remark: Remark) => void;
}) {
  if (asides.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 pt-1">
      {more > 0 ? (
        <a
          href="#margins"
          className="font-hand text-pencil ml-[calc(var(--margin)+14px)] flex min-h-9 items-center self-start text-sm underline decoration-wavy underline-offset-4"
        >
          +{more} earlier in the margins
        </a>
      ) : null}
      {asides.map((remark) => (
        <div key={remark.id} className="flex">
          <Gutter>
            {time(remark.createdAt)}
            <span aria-hidden="true" className="bg-salmon mt-1 ml-auto block size-1.5 rotate-45" />
          </Gutter>
          <button
            type="button"
            onClick={() => onAnswer(remark)}
            aria-label={`Answer her: ${remark.content}`}
            aria-pressed={answering === remark.id}
            className={`font-hand text-salmon ml-3.5 min-w-0 bg-transparent p-0 text-left text-sm leading-[21px] break-words ${answering === remark.id ? "underline decoration-[rgba(255,181,158,0.5)] underline-offset-[5px]" : ""}`}
          >
            {remark.content}
          </button>
        </div>
      ))}
    </div>
  );
}
