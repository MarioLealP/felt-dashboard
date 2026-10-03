/** WP-42.5: alerts straight from ntfy, for when felt-core doesn't answer
 * (Mario 10-03: "system tab should always be up, since its from ntfy
 * itself"). He connects once per device with his own receive-only ntfy
 * login, like the ntfy app (Mario: "i have to login to ntfy app, so here
 * would be similar"); it's kept in this browser. In the real app (WP-42.6)
 * it moves to the device's secure storage. */

const KEY = "felt-ntfy";
const TOPIC = "clockmost";

export interface NtfyLogin {
  user: string;
  password: string;
}

export interface RawAlert {
  id: string;
  at: Date;
  title: string;
  message: string;
  priority: number;
}

/** ntfy lives next to the app: felt.clockmost.com -> ntfy.clockmost.com */
export function ntfyBase(host = window.location.host): string {
  return `https://${host.replace(/^[^.]+\./, "ntfy.")}`;
}

export function savedLogin(): NtfyLogin | null {
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw ? (JSON.parse(raw) as Partial<NtfyLogin>) : null;
    return v?.user && v.password ? { user: v.user, password: v.password } : null;
  } catch {
    return null;
  }
}

export function forgetLogin(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // storage blocked: nothing was kept anyway
  }
}

function auth(login: NtfyLogin): string {
  return `Basic ${btoa(`${login.user}:${login.password}`)}`;
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

async function poll(login: NtfyLogin, since: string): Promise<RawAlert[]> {
  const response = await fetch(`${ntfyBase()}/${TOPIC}/json?poll=1&since=${since}`, {
    headers: { Authorization: auth(login) },
  });
  if (response.status === 401 || response.status === 403) {
    throw new Error("ntfy didn't accept that login.");
  }
  if (!response.ok) throw new Error(`ntfy didn't answer (${response.status}).`);
  return parseAlerts(await response.text());
}

/** Tries the login; keeps it only if ntfy accepts it. */
export async function connect(login: NtfyLogin): Promise<void> {
  await poll(login, "1m");
  try {
    localStorage.setItem(KEY, JSON.stringify(login));
  } catch {
    throw new Error("This browser won't keep it (private window or blocked storage).");
  }
}

/** The last 48 hours of server alerts, newest first. */
export async function rawAlerts(login: NtfyLogin): Promise<RawAlert[]> {
  return poll(login, "48h");
}
