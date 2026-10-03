import type { Controls, Mood } from "@/lib/controlsApi";

/** Her mood numbers (0-1) in her words; only what stands out. */
export function moodWords(mood: Mood | null): string {
  if (!mood) return "I can't tell from here - the desktop's off.";
  const bits: string[] = [];
  const v = (k: keyof Mood) => mood[k] ?? 0.5;
  if (v("energy") < 0.3) bits.push("tired");
  else if (v("energy") > 0.7) bits.push("full of energy");
  if (v("happiness") > 0.7) bits.push("cheerful");
  else if (v("happiness") < 0.35) bits.push("a bit down");
  if (v("boredom") > 0.6) bits.push("bored");
  if ((mood.annoyance ?? 0) > 0.4) bits.push("annoyed with you");
  if (v("affection") > 0.75) bits.push("fond of you");
  if (bits.length === 0) return "I'm fine. nothing special.";
  const list = bits.length > 1 ? `${bits.slice(0, -1).join(", ")} and ${bits.at(-1)}` : bits[0];
  return `I'm ${list}.`;
}

/** The headline under "Controls". */
export function headline(c: Controls): string {
  if (c.quiet.on) return "quiet. I'll keep it to myself.";
  if (c.hide.on) return "hiding, still listening.";
  return "I'm here.";
}

/** What the desktop really says, if it's there. */
export function desktopLine(c: Controls): string {
  if (!c.desktop) return "the PC's off - I'll do it when it's back.";
  const where = c.desktop.presence === "visible" ? "on screen" : "off the screen";
  return `on the desktop: ${where}${c.desktop.hushed ? ", hushed" : ""}.`;
}

export const PART_NAMES: [keyof Controls["parts"], string][] = [
  ["brain", "brain"],
  ["model", "her model"],
  ["voice", "voice"],
  ["desktop", "desktop app"],
  ["animation", "animation"],
];
