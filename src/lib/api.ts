import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

import { FELT_CORE_URL } from "@/lib/config";

// Inside the packaged Tauri app, use Tauri's own HTTP client (a native
// Rust request, not the webview's fetch) instead of the browser's fetch.
// Real bug found 2026-09-12: WebKitGTK on Linux fails any POST whose
// body isn't a trivial string — a JSON chat message, or a multipart
// voice-chat upload — with a generic "TypeError: Load failed", while
// plain-string POSTs and all GETs work fine. The browser-tab build (no
// `__TAURI_INTERNALS__`) keeps using the real browser fetch, since the
// Tauri plugin only exists inside the Tauri runtime.
const isTauri = "__TAURI_INTERNALS__" in window;
const doFetch: typeof fetch = isTauri ? (tauriFetch as typeof fetch) : fetch;

export async function sendChat(message: string, sessionId: string): Promise<string> {
  const response = await doFetch(`${FELT_CORE_URL}/v1/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, session_id: sessionId }),
  });
  if (!response.ok) {
    throw new Error(`Felt returned ${response.status}`);
  }
  const data = (await response.json()) as { reply: string };
  return data.reply;
}

export interface VoiceChatResult {
  transcribed: string;
  reply: string;
  audio: Blob;
}

export async function sendVoiceChat(audio: Blob, sessionId: string): Promise<VoiceChatResult> {
  const form = new FormData();
  form.append("file", audio, "voice.webm");

  const response = await doFetch(
    `${FELT_CORE_URL}/v1/voice-chat?session_id=${encodeURIComponent(sessionId)}`,
    { method: "POST", body: form },
  );
  if (!response.ok) {
    throw new Error(`Felt returned ${response.status}`);
  }
  const audioBlob = await response.blob();
  return {
    transcribed: decodeURIComponent(response.headers.get("X-Transcribed-Text") ?? ""),
    reply: decodeURIComponent(response.headers.get("X-Reply-Text") ?? ""),
    audio: audioBlob,
  };
}
