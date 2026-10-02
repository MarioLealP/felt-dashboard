/** WP-42.2: felt-core's app API (/v1/app/*). Same origin as the app, behind
 * SSO, so requests carry the SSO cookie and nothing else: no token lives in
 * the built files. */

export type MarkType = "circle" | "underline" | "strike-through" | "box" | "bracket";

/** Something she marked on a message: `quote` is the exact text she marked. */
export interface Mark {
  id: string;
  type: MarkType;
  quote: string;
  note?: string;
}

export interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
  marks: Mark[];
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
          },
        ]
      : [],
  );
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
  return {
    id: r.id,
    role: r.role,
    content: r.content,
    createdAt: new Date(r.created_at),
    marks: asMarks(r.marks),
  };
}

function parseList(data: unknown): Message[] {
  return Array.isArray(data) ? data.flatMap((row) => parseMessage(row) ?? []) : [];
}

async function call(path: string, init?: RequestInit): Promise<unknown> {
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

export async function say(message: string): Promise<Message[]> {
  const data = (await call("/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  })) as { messages?: unknown };
  return parseList(data.messages);
}
