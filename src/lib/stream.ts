import { useEffect, useRef } from "react";

/** WP-42.3: live notices from felt-core (GET /v1/app/stream, server-sent
 * events). Notices only, never data: the page refetches what changed, so a
 * missed notice or a reconnect can't leave it wrong. One EventSource is
 * shared by every listener and closed when the last one goes. */

export type Notice =
  | { type: "line"; id: number; role: "user" | "assistant"; kind: string }
  | { type: "asides" }
  | { type: "marks" }
  | { type: "lists" }
  | { type: "systems" }
  | { type: "hello" };

type Listener = (notice: Notice) => void;

const listeners = new Set<Listener>();
let source: EventSource | null = null;

function emit(notice: Notice) {
  for (const listener of listeners) listener(notice);
}

function open() {
  if (source || typeof EventSource === "undefined") return;
  source = new EventSource("/v1/app/stream", { withCredentials: true });
  // a (re)connect may have missed notices: listeners refetch on hello
  source.addEventListener("hello", () => emit({ type: "hello" }));
  source.addEventListener("line", (e) => {
    const data = JSON.parse((e as MessageEvent<string>).data) as Omit<
      Extract<Notice, { type: "line" }>,
      "type"
    >;
    emit({ type: "line", ...data });
  });
  source.addEventListener("asides", () => emit({ type: "asides" }));
  source.addEventListener("marks", () => emit({ type: "marks" }));
  source.addEventListener("lists", () => emit({ type: "lists" }));
  source.addEventListener("systems", () => emit({ type: "systems" }));
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  open();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && source) {
      source.close();
      source = null;
    }
  };
}

/** Calls the latest `onNotice` for every notice while mounted. */
export function useNotices(onNotice: Listener) {
  const latest = useRef(onNotice);
  useEffect(() => {
    latest.current = onNotice;
  });
  useEffect(() => subscribe((n) => latest.current(n)), []);
}
