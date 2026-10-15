/** WP-42.2: inside the tray's Felt window, messages go through the tray
 * instead of /v1/app: the tray holds felt-core's machine cert and plays her
 * voice, so she still speaks typed replies at the desk. On the phone there is
 * no bridge and the app talks to /v1/app directly (silent). The Linux tray
 * (felt-tray-rust, wry) defines `window.feltTray` on this origin only. */

interface TrayApi {
  text_chat(message: string): Promise<{ ok: boolean; error?: string }>;
}

declare global {
  interface Window {
    feltTray?: Partial<TrayApi>;
  }
}

export function trayBridge(): TrayApi | null {
  const api = window.feltTray;
  return api && typeof api.text_chat === "function" ? (api as TrayApi) : null;
}
