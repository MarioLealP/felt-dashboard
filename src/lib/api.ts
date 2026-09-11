import { FELT_CORE_URL } from "@/lib/config";

export async function sendChat(message: string, sessionId: string): Promise<string> {
  const response = await fetch(`${FELT_CORE_URL}/v1/chat`, {
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

  const response = await fetch(
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
