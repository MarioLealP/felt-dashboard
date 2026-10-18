import { useEffect, useRef } from "react";

import { getTransport } from "@/lib/transport";

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
  | { type: "controls" }
  | { type: "hello" };

type Listener = (notice: Notice) => void;

const EVENTS = ["hello", "line", "asides", "marks", "lists", "systems", "controls"] as const;

const listeners = new Set<Listener>();
let close: (() => void) | null = null;

function emit(notice: Notice) {
  for (const listener of listeners) listener(notice);
}

// a (re)connect may have missed notices: listeners refetch on hello
function dispatch(event: string, data: unknown) {
  if (event === "line") {
    emit({ type: "line", ...(data as Omit<Extract<Notice, { type: "line" }>, "type">) });
  } else if ((EVENTS as readonly string[]).includes(event)) {
    emit({ type: event } as Notice);
  }
}

function open() {
  if (close) return;
  const transport = getTransport();
  if (transport) {
    close = transport.stream(dispatch);
    return;
  }
  if (typeof EventSource === "undefined") return;
  const source = new EventSource("/v1/app/stream", { withCredentials: true });
  for (const event of EVENTS) {
    source.addEventListener(event, (e) =>
      dispatch(event, JSON.parse((e as MessageEvent<string>).data || "{}")),
    );
  }
  close = () => source.close();
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  open();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && close) {
      close();
      close = null;
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
