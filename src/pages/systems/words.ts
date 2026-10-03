import type { Incident, Status, Verdict } from "@/lib/systemsApi";

/** What an area's dot says, in her hand. */
export const STATUS_WORDS: Record<Status, string> = {
  "needs-you": "needs you",
  looking: "Claude's on it",
  watching: "waiting to see",
  fine: "fine",
};

export const DOT: Record<Status, string> = {
  "needs-you": "bg-rasp",
  looking: "bg-salmon",
  watching: "bg-kraft",
  fine: "bg-sage",
};

const VERDICT_WORDS: Record<Verdict, string> = {
  expected: "Claude: ours, expected",
  "fixed-itself": "Claude: fixed itself",
  "needs-mario": "Claude: needs you",
  unknown: "Claude: not sure",
};

/** The small note under an incident: who's on it and what they found. */
export function note(incident: Incident): string {
  if (incident.verdict) return VERDICT_WORDS[incident.verdict];
  if (incident.missed) return "Claude couldn't look";
  if (incident.state === "handled") return "handled";
  if (incident.status === "looking") return "Claude's on it";
  if (incident.status === "watching") return "waiting to see if it fixes itself";
  if (incident.expected) return "expected";
  return "";
}

/** Her newest words about it; the alert title until she's said anything. */
export function herWords(incident: Incident): string {
  return incident.backLine ?? incident.followup ?? incident.line ?? incident.title;
}

/** Quiet (grey) when it's over or was only ever news. */
export function isQuiet(incident: Incident): boolean {
  return incident.status === "fine";
}

export const time = (d: Date) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
export const day = (d: Date) =>
  d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" }).toUpperCase();

export const ACT =
  "min-h-8 bg-transparent p-0 underline decoration-wavy decoration-[rgba(203,191,200,0.45)] underline-offset-[5px] hover:text-ink disabled:opacity-40";
