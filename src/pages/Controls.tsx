import { useEffect, useRef, useState } from "react";

import { Gutter } from "@/components/Page";
import {
  type ControlName,
  type Controls as Data,
  getControls,
  setControl,
} from "@/lib/controlsApi";
import { useNotices } from "@/lib/stream";
import { Tile } from "@/pages/controls/Tile";
import { PART_NAMES, desktopLine, headline, moodWords } from "@/pages/controls/words";

// the countdown on a timed tile
const TICK_MS = 30_000;

/** WP-42.5: the controls flag - hide (bell) and quiet (moon), HyperOS-style,
 * and how she is (Mario 10-03). The switches live in felt-core; the desktop
 * tray applies them and reports back. */
export function Controls() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, setTick] = useState(0);

  async function load() {
    try {
      setData(await getControls());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });
  useEffect(() => {
    void loadRef.current();
    const timer = setInterval(() => setTick((t) => t + 1), TICK_MS);
    return () => clearInterval(timer);
  }, []);
  useNotices((n) => {
    if (n.type === "hello" || n.type === "controls") void load();
  });

  async function set(name: ControlName, on: boolean, minutes: number | null) {
    try {
      setData(await setControl(name, on, minutes));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <>
      <header className="flex pt-10 pr-16 pb-4">
        <Gutter />
        <div className="flex flex-col gap-0.5 pl-3.5">
          <h1 className="m-0 text-xl font-black">Controls</h1>
          <p className="font-hand m-0 text-[15px] text-[#b9cdb5]">{data ? headline(data) : "…"}</p>
        </div>
      </header>
      <div className="thread flex min-h-0 flex-1 flex-col overflow-y-auto pr-16 pb-6">
        {data ? (
          <>
            <div className="flex gap-3 pl-[calc(var(--margin)+14px)]">
              <Tile
                name="hide"
                label="hide"
                note="off the screen, still talks"
                value={data.hide}
                timers={data.timers}
                onSet={(on, minutes) => void set("hide", on, minutes)}
              />
              <Tile
                name="quiet"
                label="quiet"
                note="off the screen, silent"
                value={data.quiet}
                timers={data.timers}
                onSet={(on, minutes) => void set("quiet", on, minutes)}
              />
            </div>
            <p className="font-hand text-pencil m-0 pt-2 pl-[calc(var(--margin)+14px)] text-xs">
              tap: until you turn it off · slide (or scroll): 15m · 30m · 1h · 8h
            </p>
            <p className="font-hand m-0 pt-3 pl-[calc(var(--margin)+14px)] text-[15px] text-[#cfc5cd]">
              {desktopLine(data)}
            </p>
            <section aria-label="How she is" className="flex flex-col gap-1 pt-5">
              {PART_NAMES.map(([key, name]) => {
                const up = data.parts[key];
                return (
                  <div key={key} className="flex items-center">
                    <Gutter>
                      <span
                        aria-hidden="true"
                        className={`mt-0.5 ml-auto block size-2 rounded-full ${up === null ? "bg-pencil" : up ? "bg-sage" : "bg-rasp"}`}
                      />
                    </Gutter>
                    <span className="flex min-h-7 items-baseline gap-3 pl-3.5">
                      <span className="w-24 text-[14px] font-black">{name}</span>
                      <span className="font-hand text-[14px] text-[#9a909c]">
                        {up === null ? "not set up" : up ? "up" : "down"}
                      </span>
                    </span>
                  </div>
                );
              })}
            </section>
            <p className="font-hand text-ink m-0 pt-4 pl-[calc(var(--margin)+14px)] text-[16px] leading-[30px]">
              {moodWords(data.mood)}
            </p>
          </>
        ) : null}
        {error ? (
          <p className="font-hand text-rasp m-0 pt-3 pl-[calc(var(--margin)+14px)] text-sm">
            {error}
          </p>
        ) : null}
      </div>
    </>
  );
}
