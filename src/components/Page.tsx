import type { ReactNode } from "react";

import type { PageName } from "@/lib/route";

interface FlagSpec {
  page: PageName;
  label: string;
  bg: string;
  fg: string;
  tilt: string;
}

// colours and tilts from the approved design (canvas round 7/8)
const FLAGS: FlagSpec[] = [
  { page: "talk", label: "talk", bg: "#da4167", fg: "#ffffff", tilt: "-1.5deg" },
  { page: "margins", label: "margins", bg: "#e48b72", fg: "#2a1512", tilt: "1deg" },
  { page: "diary", label: "diary", bg: "#8aa886", fg: "#10170f", tilt: "-0.8deg" },
  { page: "lists", label: "lists", bg: "#e9d48c", fg: "#2a2210", tilt: "0.6deg" },
  { page: "systems", label: "systems", bg: "#d8cfdc", fg: "#241c26", tilt: "1.4deg" },
];

const RINGS = Array.from({ length: 11 }, (_, i) => i);
const NO_BADGES: Partial<Record<PageName, number>> = {};

/** The notebook page every section is written on: rings across the top,
 * the margin line, sticky flags on the right edge. */
export function Page({
  current,
  badges = NO_BADGES,
  children,
}: {
  current: PageName;
  /** small counts on the flags, e.g. unread lines in the margins */
  badges?: Partial<Record<PageName, number>>;
  children: ReactNode;
}) {
  return (
    <div className="relative mx-auto flex h-full max-w-[560px] flex-col">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1.5 right-[26px] left-[26px] flex justify-between"
      >
        {RINGS.map((i) => (
          <span key={i} className="ring" />
        ))}
      </div>
      <div
        aria-hidden="true"
        className="bg-rasp pointer-events-none absolute top-0 bottom-0 left-[var(--margin)] w-[1.5px] opacity-60"
      />
      <nav
        aria-label="Sections"
        className="absolute top-24 right-0 z-10 flex flex-col items-end gap-[7px]"
      >
        {FLAGS.map((flag, i) => {
          const active = flag.page === current;
          return (
            <a
              key={flag.page}
              href={`#${flag.page}`}
              aria-current={active ? "page" : undefined}
              className={`flag font-hand flex h-[34px] items-center rounded-l-[3px] pr-[13px] pl-[11px] text-sm font-semibold ${active ? "" : "-mr-2 opacity-90"}`}
              style={
                {
                  background: flag.bg,
                  color: flag.fg,
                  transform: `rotate(${flag.tilt})`,
                  "--tilt": flag.tilt,
                  animationDelay: `${0.05 + i * 0.05}s`,
                } as React.CSSProperties
              }
            >
              {flag.label}
              {badges[flag.page] ? (
                <span
                  className="ml-1 font-mono text-[10px]"
                  aria-label={`${badges[flag.page]} new`}
                >
                  {badges[flag.page]}
                </span>
              ) : null}
            </a>
          );
        })}
      </nav>
      {children}
    </div>
  );
}

/** The left margin column: speaker, time or a note, right-aligned. */
export function Gutter({ children }: { children?: ReactNode }) {
  return (
    <div className="font-mono text-pencil w-[var(--margin)] shrink-0 pt-1.5 pr-2.5 text-right text-[9px] leading-[1.4]">
      {children}
    </div>
  );
}
