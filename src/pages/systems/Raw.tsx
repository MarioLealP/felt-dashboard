import { Gutter } from "@/components/Page";
import type { RawAlert } from "@/lib/ntfy";

import { day, time } from "./words";

/** Systems while felt-core doesn't answer (Mario 10-03: "system tab should
 * always be up, since its from ntfy itself"): the last 48 hours straight
 * from ntfy, no lines from her and no reports from Claude. */
export function Raw({ alerts }: { alerts: RawAlert[] | null }) {
  return (
    <>
      <header className="flex pt-10 pr-16 pb-3">
        <Gutter>
          <span className="text-[10px] leading-normal">{day(new Date())}</span>
        </Gutter>
        <div className="flex flex-col gap-0.5 pl-3.5">
          <h1 className="m-0 text-xl font-black">Systems</h1>
          <p className="font-hand text-rasp m-0 text-[15px]">
            straight from the server - Felt isn't answering.
          </p>
        </div>
      </header>
      <div className="thread flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-16 pb-6">
        {alerts === null ? (
          <p className="font-hand text-pencil m-0 pl-[calc(var(--margin)+14px)] text-sm">
            connect this device to ntfy in settings to see the alerts here while I'm down.
          </p>
        ) : alerts.length === 0 ? (
          <p className="font-hand text-pencil m-0 pl-[calc(var(--margin)+14px)] text-sm">
            no alerts in the last two days.
          </p>
        ) : (
          alerts.map((a) => (
            <div key={a.id} className="flex">
              <Gutter>
                {time(a.at)}
                <span className="block text-[9px]">{day(a.at)}</span>
              </Gutter>
              <div className="flex min-w-0 flex-col gap-0.5 pl-3.5">
                <span
                  className={`text-[14px] leading-snug break-words ${a.priority >= 5 ? "text-rasp font-black" : "text-ink"}`}
                >
                  {a.title}
                </span>
                {a.message ? (
                  <span className="font-mono text-[10px] break-words whitespace-pre-wrap text-[#a99fab]">
                    {a.message}
                  </span>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
