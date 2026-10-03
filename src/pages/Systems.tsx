import { useEffect, useRef, useState } from "react";

import { answerInTalk } from "@/lib/answer";
import { type RawAlert, rawAlerts, savedLogin } from "@/lib/ntfy";
import { useHashId } from "@/lib/route";
import { useNotices } from "@/lib/stream";
import { getIncident, getSystems, type IncidentDetails, type SystemsPage } from "@/lib/systemsApi";
import { Details } from "@/pages/systems/Details";
import { Overview } from "@/pages/systems/Overview";
import { Raw } from "@/pages/systems/Raw";
import { herWords } from "@/pages/systems/words";

/** WP-42.5: the Systems flag - the overview, or one incident's details
 * (#systems/<id>). Refreshes on her alert lines and on reconnect. */
export function Systems() {
  const id = useHashId();
  const [page, setPage] = useState<SystemsPage | null>(null);
  const [details, setDetails] = useState<IncidentDetails | null>(null);
  const [olderDone, setOlderDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // felt-core not answering: the alerts straight from ntfy (null = this
  // device isn't connected to ntfy yet)
  const [raw, setRaw] = useState<RawAlert[] | null | undefined>(undefined);

  async function load(which: number | null = id) {
    try {
      if (which === null) {
        const fresh = await getSystems();
        // the circled one can be older than the first page of history
        if (fresh.circled !== null && !fresh.incidents.some((i) => i.id === fresh.circled)) {
          const circled = await getIncident(fresh.circled);
          if (circled) fresh.incidents = [circled, ...fresh.incidents];
        }
        setPage(fresh);
      } else {
        const found = await getIncident(which);
        // a desktop pop-up's "ask Felt" (#systems/<id>?ask): straight to Talk
        if (found && found.lineMessageId !== null && window.location.hash.endsWith("?ask")) {
          answerInTalk({
            id: found.lineMessageId,
            content: herWords(found),
            createdAt: found.lastAt,
          });
          return;
        }
        setDetails(found);
      }
      setError(null);
      setRaw(undefined);
    } catch (e) {
      const message = (e as Error).message;
      if (message.startsWith("Your SSO")) {
        setError(message);
        return;
      }
      const login = savedLogin();
      try {
        setRaw(login ? await rawAlerts(login) : null);
        setError(null);
      } catch (ntfyError) {
        setError(`${message} ${(ntfyError as Error).message}`);
      }
    }
  }

  // through a ref, like the Margins: the effect only starts the fetch
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });
  useEffect(() => {
    void loadRef.current(id);
  }, [id]);

  // the live stream is down with felt-core: recheck on a timer meanwhile
  const fallback = raw !== undefined;
  useEffect(() => {
    if (!fallback) return;
    const timer = setInterval(() => void loadRef.current(id), 30_000);
    return () => clearInterval(timer);
  }, [fallback, id]);

  useNotices((n) => {
    if (n.type === "hello" || n.type === "systems" || (n.type === "line" && n.kind === "alert")) {
      void load();
    }
  });

  async function older() {
    const last = page?.incidents.at(-1);
    if (!page || !last) return;
    const more = await getSystems(last.id);
    if (more.incidents.length === 0) setOlderDone(true);
    else setPage({ ...page, incidents: [...page.incidents, ...more.incidents] });
  }

  if (raw !== undefined) return <Raw alerts={raw} />;
  if (error) {
    return (
      <p className="font-hand text-rasp m-0 pt-10 pr-16 pl-[calc(var(--margin)+14px)] text-sm">
        {error}
      </p>
    );
  }
  if (id !== null) {
    // until the new one loads, never show the previous incident
    return details?.id === id ? <Details incident={details} onHandled={() => void load()} /> : null;
  }
  return page ? (
    <Overview
      page={page}
      olderDone={olderDone}
      onOlder={() => void older()}
      onHandled={() => void load()}
    />
  ) : null;
}
