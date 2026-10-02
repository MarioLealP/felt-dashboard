/** WP-42.2: inside the tray's Felt window (pywebview), messages go through
 * the tray instead of /v1/app: the tray holds felt-core's token and drives her
 * voice and lip-sync, so she still speaks typed replies at the desk. On the
 * phone there is no bridge and the app talks to /v1/app directly (silent). */

interface TrayApi {
  text_chat(message: string): Promise<{ ok: boolean; error?: string }>;
}

declare global {
  interface Window {
    pywebview?: { api?: Partial<TrayApi> };
  }
}

export function trayBridge(): TrayApi | null {
  const api = window.pywebview?.api;
  return api && typeof api.text_chat === "function" ? (api as TrayApi) : null;
}
