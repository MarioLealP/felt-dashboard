import { useEffect, useRef, useState } from "react";

import { Gutter } from "@/components/Page";
import {
  getMargins,
  type MarginAction,
  type MarginLine,
  markAllRead,
  markMargins,
} from "@/lib/appApi";
import { answerInTalk } from "@/lib/answer";
import { useNotices } from "@/lib/stream";

const time = (d: Date) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const day = (d: Date) =>
  d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" }).toUpperCase();

// seen this long on screen counts as read
const READ_AFTER_MS = 1500;
const SNOOZE_HOURS = 3;
const ACT =
  "min-h-8 bg-transparent p-0 underline decoration-wavy decoration-[rgba(203,191,200,0.45)] underline-offset-[5px] hover:text-ink";

/** Short margin labels for where a line came from. */
export function sourceLabel(source: string): string {
  if (source === "remark") return "SCREEN";
  if (source === "email") return "MAIL";
  if (source.startsWith("calendar")) return "CALENDAR";
  if (source === "diary") return "MORNING";
  return source.replaceAll("_", " ").toUpperCase().slice(0, 10);
}

function mergeById(prev: MarginLine[], next: MarginLine[]): MarginLine[] {
  const byId = new Map(prev.map((m) => [m.id, m]));
  for (const m of next) byId.set(m.id, { ...byId.get(m.id), ...m });
  return [...byId.values()].toSorted((a, b) => a.id - b.id);
}

function Line({
  line,
  fresh,
  onAct,
}: {
  line: MarginLine;
  fresh: boolean;
  onAct: (line: MarginLine, action: MarginAction) => void;
}) {
  return (
    <div className="flex">
      <Gutter>
        {time(line.createdAt)}
        <span className="font-display text-sage block text-[10px] font-black">
          {sourceLabel(line.source)}
        </span>
        {fresh ? (
          <span aria-label="new" className="bg-salmon mt-1 ml-auto block size-1.5 rotate-45" />
        ) : null}
      </Gutter>
      <div className="flex min-w-0 flex-col gap-0.5 pl-3.5">
        <p
          className={`font-hand m-0 leading-[30px] break-words ${fresh ? "text-salmon text-[17px]" : "text-[16px] text-[#b0a6b0]"}`}
        >
          {line.content}
        </p>
        <div className="font-hand flex flex-wrap gap-x-4 text-sm text-[#cbbfc8]">
          {line.kind === "alarm" ? null : (
            <button
              type="button"
              className={ACT}
              onClick={() =>
                answerInTalk({ id: line.id, content: line.content, createdAt: line.createdAt })
              }
            >
              answer her
            </button>
          )}
          <button type="button" className={ACT} onClick={() => onAct(line, "snooze")}>
            later
          </button>
          <button type="button" className={ACT} onClick={() => onAct(line, "dismiss")}>
            dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

/** WP-42.3: everything she said on her own (Mario 10-02: Talk stays "only
 * the conversation"). Newest at the bottom like Talk; seen lines are marked
 * read after a moment, new ones keep their diamond for this visit. */
export function Margins({
  unread = 0,
  onUnreadChange,
}: {
  /** unread lines overall (the flag's badge), not just the ones loaded */
  unread?: number;
  onUnreadChange?: () => void;
}) {
  const [lines, setLines] = useState<MarginLine[]>([]);
  const [fresh, setFresh] = useState<Set<number>>(new Set());
  const [olderDone, setOlderDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toRead = useRef<Set<number>>(new Set());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function noteUnread(page: MarginLine[]) {
    const unseen = page.filter((m) => !m.read).map((m) => m.id);
    if (unseen.length === 0) return;
    setFresh((prev) => new Set([...prev, ...unseen]));
    for (const id of unseen) toRead.current.add(id);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const ids = [...toRead.current];
      toRead.current.clear();
      void markMargins(ids, "read")
        .then(() => onUnreadChange?.())
        .catch(() => {});
    }, READ_AFTER_MS);
  }

  const loadNewest = () =>
    getMargins().then((page) => {
      setLines((prev) => mergeById(prev, page));
      noteUnread(page);
    });

  const loadRef = useRef(loadNewest);
  useEffect(() => {
    loadRef.current = loadNewest;
  });
  useEffect(() => {
    loadRef.current().catch((e: unknown) => setError((e as Error).message));
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  useNotices((n) => {
    if (n.type === "hello" || (n.type === "line" && n.kind !== "chat")) {
      void loadNewest().catch(() => {});
    }
  });

  async function loadOlder() {
    const first = lines[0];
    if (!first) return;
    const older = await getMargins(first.id);
    if (older.length === 0) setOlderDone(true);
    else setLines((prev) => mergeById(older, prev));
  }

  async function act(line: MarginLine, action: MarginAction) {
    setLines((prev) => prev.filter((m) => m.id !== line.id));
    try {
      await markMargins([line.id], action, action === "snooze" ? SNOOZE_HOURS : undefined);
      onUnreadChange?.();
    } catch (err) {
      setLines((prev) => mergeById(prev, [line]));
      setError((err as Error).message);
    }
  }

  async function readAll() {
    try {
      await markAllRead();
      toRead.current.clear();
      setFresh(new Set());
      setLines((prev) => prev.map((m) => ({ ...m, read: true })));
      onUnreadChange?.();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const newCount = fresh.size;
  return (
    <>
      <header className="flex pt-10 pr-16 pb-3">
        <Gutter>
          <span className="text-[10px] leading-normal">
            {day(lines.at(-1)?.createdAt ?? new Date())}
          </span>
        </Gutter>
        <div className="flex flex-col gap-0.5 pl-3.5">
          <h1 className="m-0 text-xl font-black">In the margins</h1>
          <p className="font-hand m-0 text-[15px] text-[#b9cdb5]">
            {newCount === 0
              ? "nothing new. I've been good."
              : `${newCount} new since you last looked.`}
          </p>
          {unread > 0 ? (
            <button
              type="button"
              onClick={() => void readAll()}
              className="font-hand text-pencil min-h-9 self-start bg-transparent text-sm underline decoration-wavy underline-offset-4"
            >
              mark all {unread} read
            </button>
          ) : null}
        </div>
      </header>
      <div className="thread flex min-h-0 flex-1 flex-col-reverse overflow-y-auto">
        <div className="flex flex-col gap-4 pt-1 pr-16 pb-6">
          {!olderDone && lines.length >= 50 ? (
            <button
              type="button"
              onClick={() => void loadOlder()}
              className="font-hand text-pencil ml-[calc(var(--margin)+14px)] min-h-9 self-start bg-transparent text-sm underline decoration-wavy underline-offset-4"
            >
              earlier pages
            </button>
          ) : null}
          {lines.map((line, i) => {
            const prev = lines[i - 1];
            const newDay = !prev || day(prev.createdAt) !== day(line.createdAt);
            return (
              <div key={line.id} className="flex flex-col gap-1">
                {newDay ? (
                  <Gutter>
                    <span className="text-[10px]">{day(line.createdAt)}</span>
                  </Gutter>
                ) : null}
                <Line line={line} fresh={fresh.has(line.id)} onAct={(l, a) => void act(l, a)} />
              </div>
            );
          })}
          {error ? (
            <p className="font-hand text-rasp m-0 pl-[calc(var(--margin)+14px)] text-sm">{error}</p>
          ) : null}
        </div>
      </div>
    </>
  );
}
