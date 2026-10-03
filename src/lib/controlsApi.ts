/** WP-42.5: her hide and quiet switches and how she is (felt-core
 * /v1/app/controls, SSO). */

import { call } from "@/lib/appApi";

export type ControlName = "hide" | "quiet";

export interface Switch {
  on: boolean;
  /** when a timer ends; null = until turned off */
  until: Date | null;
}

export interface Mood {
  energy?: number;
  happiness?: number;
  boredom?: number;
  affection?: number;
  annoyance?: number;
}

export interface Controls {
  hide: Switch;
  quiet: Switch;
  timers: number[];
  parts: Record<"brain" | "model" | "voice" | "desktop" | "animation", boolean | null>;
  desktop: { presence: string | null; hushed: boolean } | null;
  mood: Mood | null;
}

const utc = (v: unknown): Date | null => (typeof v === "string" && v ? new Date(v) : null);

function parseSwitch(v: unknown): Switch {
  const r = (v ?? {}) as Record<string, unknown>;
  return { on: r.on === true, until: utc(r.until) };
}

export function parseControls(data: unknown): Controls {
  const r = (data ?? {}) as Record<string, unknown>;
  const parts = (r.parts ?? {}) as Record<string, unknown>;
  const part = (k: string) => (typeof parts[k] === "boolean" ? (parts[k] as boolean) : null);
  const desk = r.desktop as Record<string, unknown> | null;
  const mood = r.mood && typeof r.mood === "object" ? (r.mood as Mood) : null;
  return {
    hide: parseSwitch(r.hide),
    quiet: parseSwitch(r.quiet),
    timers: Array.isArray(r.timers)
      ? r.timers.filter((t): t is number => typeof t === "number")
      : [15, 30, 60, 480],
    parts: {
      brain: part("brain"),
      model: part("model"),
      voice: part("voice"),
      desktop: part("desktop"),
      animation: part("animation"),
    },
    desktop: desk
      ? {
          presence: typeof desk.presence === "string" ? desk.presence : null,
          hushed: desk.hushed === true,
        }
      : null,
    mood,
  };
}

export async function getControls(): Promise<Controls> {
  return parseControls(await call("/controls"));
}

/** minutes null = until turned off */
export async function setControl(
  name: ControlName,
  on: boolean,
  minutes: number | null = null,
): Promise<Controls> {
  return parseControls(
    await call("/controls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(minutes === null ? { name, on } : { name, on, minutes }),
    }),
  );
}
