/** WP-42.2: felt-core's app API (/v1/app/*). Same origin as the app, behind
 * SSO, so requests carry the SSO cookie and nothing else: no token lives in
 * the built files. */

import { getTransport } from "@/lib/transport";

export type MarkType = "circle" | "underline" | "strike-through" | "box" | "bracket";

/** Something she marked on a message: `quote` is the exact text she marked. */
export interface Mark {
  id: string;
  type: MarkType;
  quote: string;
  note?: string;
  /** already drawn on some screen: show it inked, don't animate */
  seen?: boolean;
}

/** One of her unprompted remarks (an "aside"), waiting in Talk to be answered. */
export interface Remark {
  id: number;
  content: string;
  createdAt: Date;
}

export interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
  marks: Mark[];
  /** his line answering one of her asides: her remark */
  answering?: Remark;
}

/** Her picks of the remarks since his last message, plus how many others. */
export interface Asides {
  asides: Remark[];
  more: number;
}

const MARK_TYPES = new Set<string>(["circle", "underline", "strike-through", "box", "bracket"]);

function asMarks(value: unknown): Mark[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((m: Record<string, unknown>) =>
    typeof m?.id === "string" &&
    typeof m.quote === "string" &&
    typeof m.type === "string" &&
    MARK_TYPES.has(m.type)
      ? [
          {
            id: m.id,
            type: m.type as MarkType,
            quote: m.quote,
            ...(typeof m.note === "string" && m.note ? { note: m.note } : {}),
            ...(m.seen === true ? { seen: true } : {}),
          },
        ]
      : [],
  );
}

function parseRemark(row: unknown): Remark | null {
  const r = row as Record<string, unknown> | null;
  if (!r || typeof r.id !== "number" || typeof r.content !== "string") return null;
  if (typeof r.created_at !== "string") return null;
  return { id: r.id, content: r.content, createdAt: new Date(r.created_at) };
}

/** Validates one row from felt-core; drops anything malformed. */
export function parseMessage(row: unknown): Message | null {
  const r = row as Record<string, unknown> | null;
  if (
    !r ||
    typeof r.id !== "number" ||
    (r.role !== "user" && r.role !== "assistant") ||
    typeof r.content !== "string" ||
    typeof r.created_at !== "string"
  ) {
    return null;
  }
  const answering = parseRemark(r.answering);
  return {
    id: r.id,
    role: r.role,
    content: r.content,
    createdAt: new Date(r.created_at),
    marks: asMarks(r.marks),
    ...(answering ? { answering } : {}),
  };
}

function parseList(data: unknown): Message[] {
  return Array.isArray(data) ? data.flatMap((row) => parseMessage(row) ?? []) : [];
}

export async function call(path: string, init?: RequestInit): Promise<unknown> {
  const transport = getTransport();
  if (transport) {
    const body = typeof init?.body === "string" ? (JSON.parse(init.body) as unknown) : undefined;
    return transport.call(path, init?.method ?? "GET", body);
  }
  const response = await fetch(`/v1/app${path}`, { credentials: "same-origin", ...init });
  if (response.status === 401) {
    throw new Error("Your SSO session ended. Reload to sign in again.");
  }
  if (!response.ok) {
    throw new Error(`Felt didn't answer (${response.status}). Try again in a moment.`);
  }
  return response.json();
}

export async function getHistory(before?: number): Promise<Message[]> {
  const query = before === undefined ? "" : `?before=${before}`;
  return parseList(await call(`/history${query}`));
}

export function parseAsides(data: unknown): Asides {
  const d = data as Record<string, unknown> | null;
  const asides = Array.isArray(d?.asides) ? d.asides.flatMap((r) => parseRemark(r) ?? []) : [];
  const more = typeof d?.more === "number" && d.more > 0 ? d.more : 0;
  return { asides, more };
}

export async function getAsides(): Promise<Asides> {
  return parseAsides(await call("/asides"));
}

/** `answering`: the id of the aside he's answering, if any. */
export async function say(message: string, answering?: number): Promise<Message[]> {
  const data = (await call("/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(answering === undefined ? { message } : { message, answering }),
  })) as { messages?: unknown };
  return parseList(data.messages);
}

/** One of her lines in the Margins: anything she said that isn't the
 * conversation itself. `source` is a short label ("remark", "song",
 * "calendar_15", "email", "alarm"…). */
export interface MarginLine {
  id: number;
  kind: string;
  source: string;
  content: string;
  createdAt: Date;
  read: boolean;
}

export function parseMarginLine(row: unknown): MarginLine | null {
  const r = row as Record<string, unknown> | null;
  if (
    !r ||
    typeof r.id !== "number" ||
    typeof r.kind !== "string" ||
    typeof r.content !== "string" ||
    typeof r.created_at !== "string"
  ) {
    return null;
  }
  return {
    id: r.id,
    kind: r.kind,
    source: typeof r.source === "string" ? r.source : r.kind,
    content: r.content,
    createdAt: new Date(r.created_at),
    read: r.read === true,
  };
}

export async function getMargins(before?: number): Promise<MarginLine[]> {
  const query = before === undefined ? "" : `?before=${before}`;
  const data = await call(`/margins${query}`);
  return Array.isArray(data) ? data.flatMap((row) => parseMarginLine(row) ?? []) : [];
}

export async function getUnread(): Promise<number> {
  const data = (await call("/margins/count")) as { unread?: unknown };
  return typeof data.unread === "number" ? data.unread : 0;
}

export type MarginAction = "read" | "dismiss" | "snooze";

export async function markMargins(
  ids: number[],
  action: MarginAction,
  hours?: number,
): Promise<number> {
  if (ids.length === 0) return 0;
  const data = (await call("/margins/mark", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(hours === undefined ? { ids, action } : { ids, action, hours }),
  })) as { changed?: unknown };
  return typeof data.changed === "number" ? data.changed : 0;
}

// marks drawn in the last moment, sent to the server together
const seenQueue = new Set<string>();
let seenTimer: ReturnType<typeof setTimeout> | null = null;

/** Her ink was drawn here: tell the server, so no other screen animates it
 * again. Batched; a failure just means another device may replay it. */
export function reportSeen(markId: string) {
  seenQueue.add(markId);
  if (seenTimer) return;
  seenTimer = setTimeout(() => {
    seenTimer = null;
    const ids = [...seenQueue];
    seenQueue.clear();
    void call("/marks/seen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    }).catch(() => {});
  }, 500);
}
