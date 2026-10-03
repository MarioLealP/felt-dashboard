import { type FormEvent, useEffect, useRef, useState } from "react";

import { Asides } from "@/components/Asides";
import { Mark } from "@/components/Mark";
import { Gutter } from "@/components/Page";
import {
  type Asides as AsidesData,
  getAsides,
  getHistory,
  type Message,
  type Remark,
  say,
} from "@/lib/appApi";
import { clearPendingAnswer, pendingAnswer } from "@/lib/answer";
import { trayBridge } from "@/lib/bridge";
import { splitByMarks } from "@/lib/ink";
import { useNotices } from "@/lib/stream";

const time = (d: Date) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const day = (d: Date) =>
  d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" }).toUpperCase();

/** Asides are extra: if they fail to load, Talk works without them. */
function loadAsides(set: (asides: AsidesData) => void) {
  return getAsides()
    .then(set)
    .catch(() => {});
}

/** Her lines start at the margin with the time in the gutter; his sit on
 * the right, time after the words (Mario 10-03: "left side messages are
 * hers, right side are mine for the whole system"). The side says who's
 * speaking, so there are no name labels; screen readers still get one. */
function Line({ message, fresh }: { message: Message; fresh: boolean }) {
  const hers = message.role === "assistant";
  const notes = message.marks.filter((m) => m.note);
  const words = splitByMarks(message.content, message.marks).map((part, i) =>
    part.mark ? (
      <Mark key={part.mark.id} mark={part.mark}>
        {part.text}
      </Mark>
    ) : (
      // eslint-disable-next-line react/no-array-index-key -- static split of one message, never reordered
      <span key={i}>{part.text}</span>
    ),
  );
  return (
    <>
      {message.answering ? (
        // the aside of hers he answered, so the line reads in context later
        <p className="font-hand text-salmon/80 m-0 ml-[calc(var(--margin)+14px+15%)] text-right text-[13px] leading-[19px] break-words">
          ↳ {message.answering.content}
        </p>
      ) : null}
      {hers ? (
        <div className={`flex ${fresh ? "line-fresh" : ""}`}>
          <Gutter>{time(message.createdAt)}</Gutter>
          <div className="text-ink min-w-0 pl-3.5 text-base leading-[30px] break-words">
            <span className="sr-only">Felt: </span>
            {words}
          </div>
        </div>
      ) : (
        <div
          className={`text-ink-soft ml-[calc(var(--margin)+14px+15%)] min-w-0 text-right text-[15px] leading-[30px] break-words ${fresh ? "line-fresh" : ""}`}
        >
          <span className="sr-only">You: </span>
          {words}
          <span className="text-pencil ml-2 font-mono text-[9px] whitespace-nowrap">
            {time(message.createdAt)}
          </span>
        </div>
      )}
      {notes.map((m) => (
        <span
          key={`${m.id}-note`}
          className={`font-hand block -rotate-3 text-sm text-[#ff8fa8] ${hers ? "ml-[calc(var(--margin)+104px)]" : "pr-6 text-right"} ${fresh ? "note-fresh" : ""}`}
        >
          {m.note}
        </span>
      ))}
    </>
  );
}

export function Talk() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [freshIds, setFreshIds] = useState<Set<number>>(new Set());
  const [draft, setDraft] = useState("");
  const [writing, setWriting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [olderDone, setOlderDone] = useState(false);
  const [asides, setAsides] = useState<AsidesData>({ asides: [], more: 0 });
  // "answer her" on a Margins line lands here
  const [answering, setAnswering] = useState<Remark | null>(pendingAnswer);
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // The thread lays out bottom-up (flex-col-reverse), so the browser opens it
  // on the newest message by itself and keeps the position steady when older
  // pages are added above. scrollTop 0 is the bottom.
  const toBottom = () =>
    requestAnimationFrame(() => {
      const el = threadRef.current;
      if (el) el.scrollTop = 0;
    });

  useEffect(() => {
    let alive = true;
    const load = () =>
      getHistory().then((page) => {
        if (!alive) return;
        setMessages(page);
      });
    load().catch((e: unknown) => alive && setError((e as Error).message));
    void loadAsides(setAsides);
    // the tray window reloads the conversation when it's shown again
    const w = window as unknown as { __feltReloadHistory?: () => void };
    w.__feltReloadHistory = () => {
      void load().catch(() => {});
      void loadAsides(setAsides);
    };
    return () => {
      alive = false;
      delete w.__feltReloadHistory;
    };
  }, []);

  useEffect(() => {
    if (pendingAnswer()) inputRef.current?.focus();
    clearPendingAnswer();
  }, []);

  // live: her lines and marks show up without reopening Talk
  useNotices((n) => {
    if (n.type === "asides" || (n.type === "line" && n.kind !== "chat")) {
      void loadAsides(setAsides);
      return;
    }
    if (n.type === "hello" || n.type === "marks" || n.type === "line") {
      if (n.type === "hello") void loadAsides(setAsides);
      getHistory()
        .then((page) =>
          setMessages((prev) => {
            const byId = new Map(prev.map((m) => [m.id, m]));
            for (const m of page) byId.set(m.id, m);
            return [...byId.values()].toSorted((a, b) => a.id - b.id);
          }),
        )
        .catch(() => {});
    }
  });

  async function loadOlder() {
    const first = messages[0];
    if (!first || olderDone) return;
    const older = await getHistory(first.id);
    if (older.length === 0) {
      setOlderDone(true);
      return;
    }
    setMessages((prev) => [...older, ...prev]);
  }

  async function send(e: FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || writing) return;
    setDraft("");
    setError(null);
    setWriting(true);
    toBottom();
    try {
      // answering an aside goes straight to /v1/app, which knows her remarks;
      // the tray's text_chat doesn't carry that (yet), so it's silent there
      const bridge = answering ? null : trayBridge();
      let added: Message[];
      if (bridge) {
        const result = await bridge.text_chat(text);
        if (!result.ok) throw new Error(result.error ?? "the tray couldn't reach Felt");
        const latest = await getHistory();
        const known = new Set(messages.map((m) => m.id));
        added = latest.filter((m) => !known.has(m.id));
        setMessages(latest);
      } else {
        added = await say(text, answering?.id);
        setMessages((prev) => [...prev, ...added]);
      }
      setFreshIds(new Set(added.map((m) => m.id)));
      setAnswering(null);
      void loadAsides(setAsides);
      toBottom();
    } catch (err) {
      setDraft(text);
      setError((err as Error).message);
    } finally {
      setWriting(false);
    }
  }

  const today = messages.at(-1)?.createdAt ?? new Date();

  return (
    <>
      <header className="flex pt-10 pr-4 pb-1.5">
        <Gutter>
          <span className="text-[10px] leading-normal">{day(today)}</span>
        </Gutter>
        <div className="flex max-w-[230px] flex-col gap-0.5 pl-3.5">
          <h1 className="m-0 text-xl font-black">Felt</h1>
        </div>
      </header>

      <div
        ref={threadRef}
        className="thread flex min-h-0 flex-1 flex-col-reverse overflow-y-auto"
        aria-live="polite"
      >
        <div className="flex flex-col gap-2.5 pt-1 pr-16 pb-2">
          {!olderDone && messages.length >= 50 ? (
            <button
              type="button"
              onClick={() => void loadOlder()}
              className="font-hand text-pencil ml-[calc(var(--margin)+14px)] min-h-9 self-start bg-transparent text-sm underline decoration-wavy underline-offset-4"
            >
              earlier pages
            </button>
          ) : null}
          {messages.map((m) => (
            <Line key={m.id} message={m} fresh={freshIds.has(m.id)} />
          ))}
          {writing ? null : (
            <Asides
              asides={asides.asides}
              more={asides.more}
              answering={answering?.id ?? null}
              onAnswer={(remark) => {
                setAnswering(remark);
                inputRef.current?.focus();
              }}
            />
          )}
          {writing ? (
            <div className="flex items-center">
              <Gutter />
              <div className="font-hand flex items-center gap-2 pl-3.5 text-sm text-[#9a8f99]">
                <svg
                  className="pen"
                  width="34"
                  height="14"
                  viewBox="0 0 34 14"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M1 9 C 5 1, 8 13, 12 6 S 19 2, 22 8 S 29 10, 33 4"
                    stroke="#a9c3a5"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
                writing…
              </div>
            </div>
          ) : null}
          {error ? (
            <p className="font-hand text-rasp m-0 pl-[calc(var(--margin)+14px)] text-sm">{error}</p>
          ) : null}
        </div>
      </div>

      <div aria-hidden="true" className="bg-rasp mt-1 h-px opacity-30" />
      {answering ? (
        <div className="font-hand text-salmon flex items-center gap-1.5 pt-1.5 pr-16 pl-[90px] text-[13px]">
          <span className="min-w-0 flex-1 truncate">↳ re: {answering.content}</span>
          <button
            type="button"
            onClick={() => setAnswering(null)}
            aria-label="Don't answer this"
            className="text-pencil hover:text-ink flex min-h-8 min-w-8 items-center justify-center bg-transparent text-base"
          >
            ×
          </button>
        </div>
      ) : null}
      <form
        onSubmit={(e) => void send(e)}
        className="flex items-center gap-1.5 pt-2 pr-16 pb-[calc(22px+env(safe-area-inset-bottom,0px))] pl-[90px]"
      >
        <label htmlFor="say" className="sr-only">
          Write to Felt
        </label>
        <input
          id="say"
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={answering ? "answer her…" : "write to her…"}
          autoComplete="off"
          className="font-hand text-ink focus:border-rasp min-h-11 min-w-0 flex-1 border-0 border-b-[1.5px] border-[rgba(245,240,246,0.25)] bg-transparent px-0.5 text-[17px] outline-none"
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={writing}
          className="text-rasp hover:text-ink flex min-h-11 min-w-10 items-center justify-center bg-transparent disabled:opacity-40"
        >
          <svg width="26" height="20" viewBox="0 0 26 20" fill="none" aria-hidden="true">
            <path
              d="M2 11 C 8 9, 14 10, 22 10 M16 4 l7 6 -7 6"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </form>
    </>
  );
}
