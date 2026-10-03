import { useEffect, useRef, useState } from "react";

import { Gutter } from "@/components/Page";
import { getSettings, setClaudeAlerts, type Settings as Data } from "@/lib/settingsApi";

// what's coming here, each with its WP (Mario 10-03: settings = config)
const LATER = [
  "the games I watch for news (WP-49)",
  "the senders I keep quiet about (WP-43)",
  "what I remember about you, yours to fix",
  "on the desktop: every keybind, in one place",
];

/** WP-42 settings flag: things tuned once in a while. First in: WP-58's
 * kill switch for Claude looking into alerts, with the privacy line. */
export function Settings() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setData(await getSettings());
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

  async function flip() {
    if (!data) return;
    try {
      setData(await setClaudeAlerts(!data.claudeAlerts));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const on = data?.claudeAlerts ?? false;
  return (
    <>
      <header className="flex pt-10 pr-16 pb-4">
        <Gutter />
        <div className="flex flex-col gap-0.5 pl-3.5">
          <h1 className="m-0 text-xl font-black">Settings</h1>
          <p className="font-hand m-0 text-[15px] text-[#b9cdb5]">
            things you tune about me once in a while.
          </p>
        </div>
      </header>
      <div className="thread flex min-h-0 flex-1 flex-col overflow-y-auto pr-16 pb-6">
        <section
          aria-label="Claude and alerts"
          className="flex flex-col gap-2 pl-[calc(var(--margin)+14px)]"
        >
          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label="Claude looks into alerts"
            disabled={!data}
            onClick={() => void flip()}
            className="flex min-h-12 items-center gap-3 rounded-[14px] bg-[#26232a] px-3 text-left"
          >
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="text-[15px] font-black">Claude looks into alerts</span>
              <span className="font-hand text-xs text-[#9a909c]">
                {on ? "on - concerning ones go to him" : "off - I tell you, nobody investigates"}
              </span>
            </span>
            <span
              aria-hidden="true"
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-sage" : "bg-[#3a3440]"}`}
            >
              <span
                className={`absolute top-0.5 size-5 rounded-full bg-[#f5f0f6] transition-[left] ${on ? "left-[22px]" : "left-0.5"}`}
              />
            </span>
          </button>
          <p className="m-0 text-[12px] leading-relaxed text-[#a99fab]">
            When on, what he reads while looking goes to Anthropic through your Claude plan: the
            alert, the server's configs as committed, the logs he searches (they can hold IPs, URLs,
            usernames), Zabbix and Wazuh. Never: secrets, my chats, the diary, my memories, your
            mail, calendar or photos - his sandbox can't see them.
          </p>
        </section>
        <section aria-label="Coming" className="flex flex-col pt-6">
          {LATER.map((line) => (
            <p
              key={line}
              className="font-hand m-0 pl-[calc(var(--margin)+14px)] text-[14px] leading-[28px] text-[#6f6672]"
            >
              – {line}
            </p>
          ))}
        </section>
        {error ? (
          <p className="font-hand text-rasp m-0 pt-3 pl-[calc(var(--margin)+14px)] text-sm">
            {error}
          </p>
        ) : null}
      </div>
    </>
  );
}
