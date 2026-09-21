import { FELT_ANIMATION_URL, FELT_CORE_URL } from "@/lib/config";

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

export interface VoiceChatResult {
  transcribed: string;
  reply: string;
  audio: Blob;
  animationTag: string | null;
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
    animationTag: response.headers.get("X-Animation-Tag")
      ? decodeURIComponent(response.headers.get("X-Animation-Tag")!)
      : null,
  };
}

// Best-effort - felt-animation is desktop-only and optional, a chat
// window on some other client shouldn't fail (or even show an error) just
// because it's not running here. Mirrors felt-tray's own Python calls to
// the same two endpoints for the voice hotkey path (src/felt_tray/app.py).
async function notifyRequestStarted(): Promise<void> {
  try {
    await doFetch(`${FELT_ANIMATION_URL}/request_started`, { method: "POST" });
  } catch {
    // felt-animation not running - fine, chat continues without her reacting.
  }
}

async function notifyReplyReady(text: string, animationTag: string | null, audio: Blob): Promise<void> {
  try {
    const form = new FormData();
    form.append("text", text);
    form.append("animation_tag", animationTag ?? "");
    form.append("audio", audio, "reply.wav");
    await doFetch(`${FELT_ANIMATION_URL}/reply_ready`, { method: "POST", body: form });
  } catch {
    // Same - best-effort only.
  }
}

export interface TextChatResult {
  reply: string;
  audio: Blob;
  animationTag: string | null;
}

// Same TTS + reaction-animation treatment a spoken message gets (2026-09-21,
// "hook up the chat like it was voice input, need her to reply with TTS +
// animation") - /v1/text-chat is /v1/voice-chat's same response shape
// (audio/wav + X-Reply-Text/X-Animation-Tag headers) minus the STT step.
export async function sendTextChat(message: string, sessionId: string): Promise<TextChatResult> {
  void notifyRequestStarted();

  const response = await doFetch(`${FELT_CORE_URL}/v1/text-chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, session_id: sessionId }),
  });
  if (!response.ok) {
    throw new Error(`Felt returned ${response.status}`);
  }
  const audioBlob = await response.blob();
  const result: TextChatResult = {
    reply: decodeURIComponent(response.headers.get("X-Reply-Text") ?? ""),
    audio: audioBlob,
    animationTag: response.headers.get("X-Animation-Tag")
      ? decodeURIComponent(response.headers.get("X-Animation-Tag")!)
      : null,
  };
  void notifyReplyReady(result.reply, result.animationTag, result.audio);
  return result;
}
