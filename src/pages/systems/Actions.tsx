import { useState } from "react";

import { answerInTalk } from "@/lib/answer";
import { type Incident, markHandled } from "@/lib/systemsApi";

import { ACT, herWords } from "./words";

/** handled · ask Felt · details, under the circled problem and in the
 * details. `onHandled` refreshes whoever shows it. */
export function Actions({
  incident,
  details = true,
  onHandled,
}: {
  incident: Incident;
  details?: boolean;
  onHandled?: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const live = incident.state === "open" || incident.state === "pending";
  return (
    <div className="font-hand flex flex-wrap gap-x-4 text-sm text-[#cbbfc8]">
      {live ? (
        <button
          type="button"
          className={ACT}
          onClick={() =>
            void markHandled(incident.id)
              .then(() => onHandled?.())
              .catch((e: unknown) => setError((e as Error).message))
          }
        >
          handled
        </button>
      ) : null}
      <button
        type="button"
        className={ACT}
        disabled={incident.lineMessageId === null}
        onClick={() =>
          incident.lineMessageId !== null &&
          answerInTalk({
            id: incident.lineMessageId,
            content: herWords(incident),
            createdAt: incident.lastAt,
          })
        }
      >
        ask Felt
      </button>
      {details ? (
        <a className={`${ACT} text-[#cbbfc8]`} href={`#systems/${incident.id}`}>
          details
        </a>
      ) : null}
      {error ? <span className="text-rasp">{error}</span> : null}
    </div>
  );
}
