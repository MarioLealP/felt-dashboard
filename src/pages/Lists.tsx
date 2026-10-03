import { type FormEvent, useEffect, useRef, useState } from "react";

import { Gutter } from "@/components/Page";
import { addItem, clearChecked, getItems, type Item, removeItem, setChecked } from "@/lib/listsApi";
import { useNotices } from "@/lib/stream";

const ACT =
  "min-h-8 bg-transparent p-0 underline decoration-wavy decoration-[rgba(203,191,200,0.45)] underline-offset-[5px] hover:text-ink";

// the other lists Mario planned (WP-42 decision 2); each arrives with its WP
const LATER = [
  { name: "games", line: "the games I watch for news. with WP-49." },
  { name: "email noise", line: "the senders I keep quiet about. with WP-43." },
  { name: "about you", line: "what I remember about you, yours to fix. later." },
];

function headline(items: Item[]): string {
  const left = items.filter((i) => !i.checked).length;
  if (left === 0) return items.length ? "all crossed off." : "nothing to buy.";
  return left === 1 ? "one thing to buy." : `${left} things to buy.`;
}

/** WP-42.5: the Lists flag - the shopping list moved in (Mario 10-02:
 * "the shopping list moves into the app"), and room for the others. */
export function Lists() {
  const [items, setItems] = useState<Item[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setItems(await getItems());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });
  useEffect(() => {
    void loadRef.current();
  }, []);
  // she adds and crosses things off by voice too
  useNotices((n) => {
    if (n.type === "hello" || n.type === "lists") void load();
  });

  async function change(fn: () => Promise<void>) {
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    }
    await load();
  }

  function add(e: FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    void change(() => addItem(text));
  }

  const ordered = [...items.filter((i) => !i.checked), ...items.filter((i) => i.checked)];
  const anyChecked = items.some((i) => i.checked);
  return (
    <>
      <header className="flex pt-10 pr-16 pb-3">
        <Gutter />
        <div className="flex flex-col gap-0.5 pl-3.5">
          <h1 className="m-0 text-xl font-black">Lists</h1>
          <p className="font-hand m-0 text-[15px] text-[#b9cdb5]">{headline(items)}</p>
        </div>
      </header>
      <div className="thread flex min-h-0 flex-1 flex-col overflow-y-auto pr-16 pb-4">
        <section aria-label="Shopping" className="flex flex-col">
          <div className="flex">
            <Gutter>
              <span className="font-display text-sage text-[10px] font-black">SHOPPING</span>
            </Gutter>
          </div>
          {ordered.map((item) => (
            <div key={item.id} className="group flex items-center">
              <Gutter />
              <button
                type="button"
                aria-pressed={item.checked}
                onClick={() => void change(() => setChecked(item.id, !item.checked))}
                className={`font-hand min-h-[30px] min-w-0 flex-1 bg-transparent p-0 pl-3.5 text-left text-[17px] leading-[30px] break-words ${item.checked ? "text-pencil line-through decoration-[#3a3440] decoration-[3px]" : "text-ink"}`}
              >
                {item.text}
              </button>
              <button
                type="button"
                aria-label={`remove ${item.text}`}
                onClick={() => void change(() => removeItem(item.id))}
                className="text-pencil hover:text-rasp min-h-8 bg-transparent px-2 text-sm"
              >
                ×
              </button>
            </div>
          ))}
          {anyChecked ? (
            <button
              type="button"
              onClick={() => void change(clearChecked)}
              className={`font-hand text-pencil mt-2 ml-[calc(var(--margin)+14px)] self-start text-sm ${ACT}`}
            >
              clear crossed off
            </button>
          ) : null}
        </section>
        <section aria-label="Coming" className="mt-6 flex flex-col gap-2">
          {LATER.map((l) => (
            <div key={l.name} className="flex">
              <Gutter>
                <span className="font-display text-[10px] font-black text-[#6f6672]">
                  {l.name.toUpperCase()}
                </span>
              </Gutter>
              <p className="font-hand m-0 pl-3.5 text-[14px] leading-[22px] text-[#6f6672]">
                {l.line}
              </p>
            </div>
          ))}
        </section>
        {error ? (
          <p className="font-hand text-rasp m-0 pt-3 pl-[calc(var(--margin)+14px)] text-sm">
            {error}
          </p>
        ) : null}
      </div>
      <form
        onSubmit={add}
        className="flex items-center gap-1.5 pt-2 pr-16 pb-[calc(22px+env(safe-area-inset-bottom,0px))] pl-[90px]"
      >
        <label htmlFor="add-item" className="sr-only">
          Add to the shopping list
        </label>
        <input
          id="add-item"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="add something…"
          autoComplete="off"
          className="font-hand text-ink focus:border-rasp min-h-11 min-w-0 flex-1 border-0 border-b-[1.5px] border-[rgba(245,240,246,0.25)] bg-transparent px-0.5 text-[17px] outline-none"
        />
        <button type="submit" className={`font-hand text-pencil text-sm ${ACT}`}>
          add
        </button>
      </form>
    </>
  );
}
