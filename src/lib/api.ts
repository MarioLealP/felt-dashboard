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

// WP-15: felt-animation's GET /tone, best-effort - felt-animation not
// running (or not reachable from this build, e.g. a browser-tab session
// with no desktop companion) must never block or fail a chat turn just
// for the tone line. Mirrors felt-tray's own Python fetch_tone().
async function fetchTone(): Promise<string | null> {
  try {
    const response = await doFetch(`${FELT_ANIMATION_URL}/tone`);
    if (!response.ok) return null;
    const data = (await response.json()) as { tone?: string };
    return data.tone ?? null;
  } catch {
    return null;
  }
}

export async function sendVoiceChat(audio: Blob, sessionId: string): Promise<VoiceChatResult> {
  const tone = await fetchTone();
  const form = new FormData();
  form.append("file", audio, "voice.webm");
  if (tone) form.append("tone", tone);

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

// WP-08: felt-animation is now the single owner of her audio (voice, mouth
// and reaction start together there) - the chat window used to play the
// same clip itself via `audioRef`, which double-played once felt-animation
// started playing too. Returns whether felt-animation actually took it, so
// the caller can fall back to local playback only when it didn't (down, or
// timed out) - never both, never neither.
async function notifyReplyReady(text: string, animationTag: string | null, audio: Blob): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);
  try {
    const form = new FormData();
    form.append("text", text);
    form.append("animation_tag", animationTag ?? "");
    form.append("audio", audio, "reply.wav");
    form.append("prompted", "1");
    const response = await doFetch(`${FELT_ANIMATION_URL}/reply_ready`, {
      method: "POST",
      body: form,
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    // felt-animation down or unreachable - caller falls back to local playback.
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export interface TextChatResult {
  reply: string;
  audio: Blob;
  animationTag: string | null;
  playedByAnimation: boolean;
}

// Same TTS + reaction-animation treatment a spoken message gets (2026-09-21,
// "hook up the chat like it was voice input, need her to reply with TTS +
// animation") - /v1/text-chat is /v1/voice-chat's same response shape
// (audio/wav + X-Reply-Text/X-Animation-Tag headers) minus the STT step.
export async function sendTextChat(message: string, sessionId: string): Promise<TextChatResult> {
  void notifyRequestStarted();
  const tone = await fetchTone();

  const response = await doFetch(`${FELT_CORE_URL}/v1/text-chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, session_id: sessionId, tone }),
  });
  if (!response.ok) {
    throw new Error(`Felt returned ${response.status}`);
  }
  const audioBlob = await response.blob();
  const reply = decodeURIComponent(response.headers.get("X-Reply-Text") ?? "");
  const animationTag = response.headers.get("X-Animation-Tag")
    ? decodeURIComponent(response.headers.get("X-Animation-Tag")!)
    : null;
  const playedByAnimation = await notifyReplyReady(reply, animationTag, audioBlob);
  return { reply, audio: audioBlob, animationTag, playedByAnimation };
}
