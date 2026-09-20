import { FELT_CORE_URL } from "@/lib/config";

// Previously routed through Tauri's own HTTP client on the packaged
// desktop build, to work around a WebKitGTK-on-Linux bug where any POST
// with a non-trivial body failed with "TypeError: Load failed" (found
// 2026-09-12). The desktop shell is now pywebview/WebView2 (Windows),
// which doesn't have that bug, so plain `fetch` is used unconditionally —
// same as the browser-tab build always did.
const doFetch: typeof fetch = fetch;

export interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export async function getHistory(sessionId: string): Promise<HistoryMessage[]> {
  const response = await doFetch(
    `${FELT_CORE_URL}/v1/history?session_id=${encodeURIComponent(sessionId)}`,
  );
  if (!response.ok) {
    throw new Error(`Felt returned ${response.status}`);
  }
  return (await response.json()) as HistoryMessage[];
}

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
