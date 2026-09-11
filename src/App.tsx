import { useEffect, useRef, useState } from "react";

import { ChatMessage, type Message } from "@/components/ChatMessage";
import { Slab } from "@/components/Slab";
import { ThemeToggle } from "@/components/ThemeToggle";
import { sendChat, sendVoiceChat } from "@/lib/api";
import { useMicRecorder } from "@/lib/useMicRecorder";
import { useTheme } from "@/lib/useTheme";

const SESSION_ID = "dashboard";

interface StoredMessage extends Message {
  id: string;
}

export function App() {
  const { surface, toggle } = useTheme();
  const [messages, setMessages] = useState<StoredMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isRecording, start, stop } = useMicRecorder();
  const audioRef = useRef<HTMLAudioElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scrolls when
    // messages changes; the effect reads scrollRef, not messages, directly
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const text = draft.trim();
    if (!text || busy) return;
    setDraft("");
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", text }]);
    setBusy(true);
    setError(null);
    try {
      const reply = await sendChat(text, SESSION_ID);
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", text: reply }]);
    } catch {
      setError("Couldn't reach Felt. Is felt-core running and reachable?");
    } finally {
      setBusy(false);
    }
  }

  async function handleMicClick() {
    if (isRecording) {
      setBusy(true);
      setError(null);
      try {
        const audioBlob = await stop();
        const result = await sendVoiceChat(audioBlob, SESSION_ID);
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "user", text: result.transcribed || "(voice message)" },
          { id: crypto.randomUUID(), role: "assistant", text: result.reply },
        ]);
        if (audioRef.current) {
          audioRef.current.src = URL.createObjectURL(result.audio);
          await audioRef.current.play();
        }
      } catch {
        setError("Voice chat failed. Is felt-voice reachable?");
      } finally {
        setBusy(false);
      }
    } else {
      try {
        await start();
      } catch {
        setError("Couldn't access the microphone.");
      }
    }
  }

  return (
    <div className="mx-auto flex h-screen max-w-3xl flex-col px-6 pt-6 pb-4">
      <header className="flex items-center gap-4 border-b border-line pb-3">
        <span className="font-display text-base font-bold tracking-[0.22em] uppercase">felt</span>
        <span className="ef-label hidden sm:block">{"// assistant"}</span>
        <span className="flex-1" />
        <ThemeToggle surface={surface} onToggle={toggle} />
      </header>
      <div className="ef-rule--tri" style={{ height: 2 }} />

      <Slab
        kicker="// LOCAL-FIRST"
        headline="Felt"
        detail="say or type anything"
        watermark="FELT"
      />

      <div ref={scrollRef} className="mt-6 flex flex-1 flex-col gap-3 overflow-y-auto pb-4">
        {messages.length === 0 ? (
          <div className="ef-mono text-xs opacity-50">no messages yet</div>
        ) : (
          messages.map(({ id, ...message }) => <ChatMessage key={id} {...message} />)
        )}
      </div>

      {error ? <div className="ef-callout ef-callout--dont mb-2 text-xs">{error}</div> : null}

      <div className="ef-field flex-row items-stretch gap-2">
        <textarea
          className="ef-textarea flex-1 resize-none"
          rows={1}
          placeholder="Message Felt..."
          value={draft}
          disabled={busy}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void handleSend();
            }
          }}
        />
        <button
          type="button"
          className={`ef-btn ${isRecording ? "ef-btn--danger" : ""}`}
          disabled={busy && !isRecording}
          onClick={() => void handleMicClick()}
        >
          {isRecording ? "stop" : "mic"}
        </button>
        <button
          type="button"
          className="ef-btn ef-btn--primary"
          disabled={busy || !draft.trim()}
          onClick={() => void handleSend()}
        >
          send
        </button>
      </div>
      <audio ref={audioRef} className="hidden">
        <track kind="captions" />
      </audio>
    </div>
  );
}
