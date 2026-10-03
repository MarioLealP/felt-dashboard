import { Circled } from "@/components/Circled";
import { Gutter } from "@/components/Page";
import type { Area, Incident, SystemsPage } from "@/lib/systemsApi";

import { Actions } from "./Actions";
import { ACT, DOT, STATUS_WORDS, day, herWords, isQuiet, note, time } from "./words";

const open = (id: number) => {
  window.location.hash = `#systems/${id}`;
};

function AreaRow({
  area,
  circled,
  onHandled,
}: {
  area: Area;
  circled: Incident | null;
  onHandled: () => void;
}) {
  const words =
    area.status === "needs-you" && area.count > 1
      ? `${STATUS_WORDS[area.status]} (${area.count})`
      : STATUS_WORDS[area.status];
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center">
        <Gutter>
          <span
            aria-hidden="true"
            className={`mt-0.5 ml-auto block size-2 rounded-full ${DOT[area.status]}`}
          />
        </Gutter>
        <button
          type="button"
          disabled={area.incidentId === null}
          onClick={() => area.incidentId !== null && open(area.incidentId)}
          className="flex min-h-8 items-baseline gap-3 bg-transparent p-0 pl-3.5 text-left disabled:cursor-default"
        >
          <span className="w-20 text-[15px] font-black">{area.name}</span>
          <span
            className={`font-hand text-[15px] ${area.status === "fine" ? "text-[#9a909c]" : "text-salmon"}`}
          >
            {circled ? <Circled id={`incident-${circled.id}`}>{words}</Circled> : words}
          </span>
        </button>
      </div>
      {circled ? (
        <div className="flex flex-col gap-0.5 pt-2 pr-2 pl-[calc(var(--margin)+14px)]">
          <p className="font-hand text-ink m-0 text-[16px] leading-[30px] break-words">
            {herWords(circled)}
          </p>
          <Actions incident={circled} onHandled={onHandled} />
        </div>
      ) : null}
    </div>
  );
}

function HistoryRow({ incident }: { incident: Incident }) {
  const quiet = isQuiet(incident);
  const said = note(incident);
  return (
    <button
      type="button"
      onClick={() => open(incident.id)}
      className="flex bg-transparent p-0 text-left"
    >
      <Gutter>
        {time(incident.firstAt)}
        <span className="font-display text-sage block text-[10px] font-black">
          {incident.area.toUpperCase()}
        </span>
      </Gutter>
      <span className="flex min-w-0 flex-col gap-0.5 pl-3.5">
        <span
          className={`font-hand leading-[30px] break-words ${quiet ? "text-[15px] text-[#8f8592]" : "text-[16px] text-[#e2d7df]"}`}
        >
          {herWords(incident)}
        </span>
        {said ? <span className="font-mono text-pencil text-[10px]">{said}</span> : null}
      </span>
    </button>
  );
}

function headline(page: SystemsPage): string {
  const needing = page.areas.filter((a) => a.status === "needs-you").length;
  if (needing === 1) return "one thing needs you.";
  if (needing > 1) return `${needing} things need you.`;
  if (page.areas.some((a) => a.status === "looking")) return "Claude's looking at something.";
  if (page.areas.some((a) => a.status === "watching")) return "keeping an eye on something.";
  return "all quiet.";
}

/** How things are (an area each, the one real problem circled) and what
 * happened, newest first (Mario 10-03: "sounds good"). */
export function Overview({
  page,
  olderDone,
  onOlder,
  onHandled,
}: {
  page: SystemsPage;
  olderDone: boolean;
  onOlder: () => void;
  onHandled: () => void;
}) {
  const circled = page.incidents.find((i) => i.id === page.circled) ?? null;
  return (
    <>
      <header className="flex pt-10 pr-16 pb-3">
        <Gutter>
          <span className="text-[10px] leading-normal">{day(new Date())}</span>
        </Gutter>
        <div className="flex flex-col gap-0.5 pl-3.5">
          <h1 className="m-0 text-xl font-black">Systems</h1>
          <p className="font-hand m-0 text-[15px] text-[#b9cdb5]">{headline(page)}</p>
        </div>
      </header>
      <div className="thread flex min-h-0 flex-1 flex-col overflow-y-auto pr-16 pb-6">
        <section aria-label="How things are" className="flex flex-col gap-1">
          {page.areas.map((area) => (
            <AreaRow
              key={area.name}
              area={area}
              circled={circled && circled.area === area.name ? circled : null}
              onHandled={onHandled}
            />
          ))}
        </section>
        <div
          aria-hidden="true"
          className="mt-5 mb-2 ml-[calc(var(--margin)+14px)] h-px bg-[#3a3440]"
        />
        <section aria-label="What happened" className="flex flex-col gap-3">
          {page.incidents.length === 0 ? (
            <p className="font-hand text-pencil m-0 pl-[calc(var(--margin)+14px)] text-sm">
              nothing has happened yet.
            </p>
          ) : null}
          {page.incidents.map((incident, i) => {
            const d = day(incident.firstAt);
            const prev = page.incidents[i - 1];
            const newDay = !prev || day(prev.firstAt) !== d;
            return (
              <div key={incident.id} className="flex flex-col gap-1">
                {newDay ? (
                  <Gutter>
                    <span className="text-[10px]">{d}</span>
                  </Gutter>
                ) : null}
                <HistoryRow incident={incident} />
              </div>
            );
          })}
          {!olderDone && page.incidents.length >= 30 ? (
            <button
              type="button"
              onClick={onOlder}
              className={`font-hand text-pencil ml-[calc(var(--margin)+14px)] self-start text-sm ${ACT}`}
            >
              earlier pages
            </button>
          ) : null}
        </section>
      </div>
    </>
  );
}
