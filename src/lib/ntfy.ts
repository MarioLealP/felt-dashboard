/** WP-42.5: alerts straight from ntfy, for when felt-core doesn't answer
 * (Mario 10-03: "system tab should always be up, since its from ntfy
 * itself"). How the app gets at them is being redone: a plain password in
 * browser storage was wrong (Mario: "thats plain text password on local
 * storage is crazy") - no credential is kept in the browser now. */

export interface RawAlert {
  id: string;
  at: Date;
  title: string;
  message: string;
  priority: number;
}

/** ntfy's poll answer: one JSON object per line, messages among them. */
export function parseAlerts(text: string): RawAlert[] {
  return text
    .split("\n")
    .flatMap((line) => {
      try {
        const e = JSON.parse(line) as Record<string, unknown>;
        if (e.event !== "message" || typeof e.id !== "string") return [];
        return [
          {
            id: e.id,
            at: new Date(Number(e.time) * 1000),
            title: typeof e.title === "string" ? e.title : "server alert",
            message: typeof e.message === "string" ? e.message : "",
            priority: typeof e.priority === "number" ? e.priority : 3,
          },
        ];
      } catch {
        return [];
      }
    })
    .toSorted((a, b) => b.at.getTime() - a.at.getTime());
}
