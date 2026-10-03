import { type PointerEvent, type WheelEvent, useRef, useState } from "react";

import type { ControlName, Switch } from "@/lib/controlsApi";

// a drag this far counts as a slide, not a tap
const SLIDE_PX = 12;
const WHEEL_SETTLE_MS = 600;

export function timerLabel(minutes: number): string {
  return minutes < 60 ? `${minutes} min` : `${minutes / 60} h`;
}

export function timeLeft(until: Date, now = new Date()): string {
  const minutes = Math.max(1, Math.round((until.getTime() - now.getTime()) / 60000));
  if (minutes < 60) return `${minutes}m left`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m left` : `${h}h left`;
}

/** Which timer stop a point across the tile picks (left = shortest). */
export function stopAt(fraction: number, timers: number[]): number {
  const i = Math.min(timers.length - 1, Math.max(0, Math.floor(fraction * timers.length)));
  return timers[i] ?? 15;
}

function Icon({ name }: { name: ControlName }) {
  // bell for hide, moon for quiet (Mario 10-03: "the bell for notifications
  // and the moon for full dnd")
  return name === "hide" ? (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
    </svg>
  ) : (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
    </svg>
  );
}

/** One HyperOS-style tile (Mario 10-03): tap = on until turned off (or
 * off); slide across = a timer, snapping to the stops; on the desktop the
 * mouse wheel over it steps the timer too. */
export function Tile({
  name,
  label,
  note,
  value,
  timers,
  onSet,
}: {
  name: ControlName;
  label: string;
  note: string;
  value: Switch;
  timers: number[];
  onSet: (on: boolean, minutes: number | null) => void;
}) {
  const box = useRef<HTMLButtonElement>(null);
  const start = useRef<number | null>(null);
  const [preview, setPreview] = useState<number | null>(null);
  const wheelTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fraction = (clientX: number) => {
    const rect = box.current?.getBoundingClientRect();
    return rect && rect.width ? (clientX - rect.left) / rect.width : 0;
  };

  function down(e: PointerEvent<HTMLButtonElement>) {
    start.current = e.clientX;
    // keeps the slide tracking past the tile's edge (absent in the test DOM)
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }
  function move(e: PointerEvent<HTMLButtonElement>) {
    if (start.current === null || Math.abs(e.clientX - start.current) < SLIDE_PX) return;
    setPreview(stopAt(fraction(e.clientX), timers));
  }
  function up() {
    const picked = preview;
    start.current = null;
    setPreview(null);
    if (picked !== null) onSet(true, picked);
    else onSet(!value.on, null);
  }
  function wheel(e: WheelEvent<HTMLButtonElement>) {
    const i = preview === null ? -1 : timers.indexOf(preview);
    const next = e.deltaY < 0 ? Math.min(timers.length - 1, i + 1) : Math.max(0, i - 1);
    const picked = timers[next] ?? timers[0] ?? 15;
    setPreview(picked);
    if (wheelTimer.current) clearTimeout(wheelTimer.current);
    wheelTimer.current = setTimeout(() => {
      setPreview(null);
      onSet(true, picked);
    }, WHEEL_SETTLE_MS);
  }

  const fill = preview !== null ? (timers.indexOf(preview) + 1) / timers.length : value.on ? 1 : 0;
  const state =
    preview !== null
      ? timerLabel(preview)
      : value.on
        ? value.until
          ? timeLeft(value.until)
          : "on"
        : "off";
  return (
    <button
      ref={box}
      type="button"
      aria-pressed={value.on}
      aria-label={`${label}: ${state}`}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={() => {
        start.current = null;
        setPreview(null);
      }}
      onWheel={wheel}
      className={`relative flex h-24 w-full min-w-0 touch-none flex-col justify-between overflow-hidden rounded-[14px] p-3 text-left select-none ${value.on || preview !== null ? "text-[#2a2210]" : "text-ink bg-[#26232a]"}`}
      style={value.on || preview !== null ? { background: "#d6bf9f" } : undefined}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 bg-[#e9d48c] transition-[width] duration-150"
        style={{ width: `${preview !== null ? fill * 100 : 0}%`, opacity: 0.55 }}
      />
      <span className="relative flex items-center justify-between">
        <Icon name={name} />
        <span className="font-mono text-[10px]">{state}</span>
      </span>
      <span className="relative flex flex-col">
        <span className="text-base font-black">{label}</span>
        <span className="font-hand text-xs opacity-75">{note}</span>
      </span>
    </button>
  );
}
