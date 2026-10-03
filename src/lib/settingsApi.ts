/** WP-58: the app's settings (felt-core /v1/app/settings, SSO) - for now
 * the kill switch: whether the server's Claude looks into alerts. */

import { call } from "@/lib/appApi";

export interface Settings {
  claudeAlerts: boolean;
}

export function parseSettings(data: unknown): Settings {
  const r = (data ?? {}) as Record<string, unknown>;
  return { claudeAlerts: r.claude_alerts !== false };
}

export async function getSettings(): Promise<Settings> {
  return parseSettings(await call("/settings"));
}

export async function setClaudeAlerts(on: boolean): Promise<Settings> {
  return parseSettings(
    await call("/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ claude_alerts: on }),
    }),
  );
}
