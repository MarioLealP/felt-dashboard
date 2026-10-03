import type { Remark } from "@/lib/appApi";

/** "answer her" on a Margins line: the line is handed to Talk, which opens
 * with "↳ re: …" set. A module variable, not the URL: the app never reloads
 * between the two pages, and the line's text has no place in a hash. */
let pending: Remark | null = null;

export function answerInTalk(remark: Remark) {
  pending = remark;
  window.location.hash = "#talk";
}

/** The line to answer, if one was handed over (Talk's initial state). */
export function pendingAnswer(): Remark | null {
  return pending;
}

/** Talk took it: don't hand it over again on the next visit. */
export function clearPendingAnswer() {
  pending = null;
}
