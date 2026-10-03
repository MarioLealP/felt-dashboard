import { useState } from "react";

import { Gutter } from "@/components/Page";
import type { IncidentDetails, TrailStep } from "@/lib/systemsApi";

import { Actions } from "./Actions";
import { day, note, time } from "./words";

const VERDICT: Record<string, string> = {
  expected: "ours - expected",
  "fixed-itself": "it fixed itself",
  "needs-mario": "needs you",
  unknown: "couldn't tell for sure",
};

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5 pt-4">
      <h2 className="font-display text-sage m-0 pl-[calc(var(--margin)+14px)] text-[11px] font-black tracking-wide uppercase">
        {label}
      </h2>
      <div className="flex min-w-0 flex-col gap-1.5 pl-[calc(var(--margin)+14px)]">{children}</div>
    </section>
  );
}

function Step({ step }: { step: TrailStep }) {
  if (step.said) {
    return (
      <p className="m-0 text-[13px] leading-snug whitespace-pre-wrap text-[#cfc5cd]">{step.said}</p>
    );
  }
  return (
    <details className="group">
      <summary
        className={`cursor-pointer font-mono text-[11px] break-all ${step.error ? "text-rasp" : "text-[#b9cdb5]"}`}
      >
        {step.tool === "Bash" ? "$ " : `${step.tool}: `}
        {step.input}
      </summary>
      {step.output ? (
        <pre className="text-pencil m-0 mt-1 overflow-x-auto font-mono text-[10px] whitespace-pre-wrap">
          {step.output}
        </pre>
      ) : null}
    </details>
  );
}

/** One incident, all of it (Mario 10-03: "let me click on the incident and
 * see further"): her words, Claude's report and how he got there, the raw
 * alerts, and how to join his session. */
export function Details({
  incident,
  onHandled,
}: {
  incident: IncidentDetails;
  onHandled: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const report = incident.report;
  const join = incident.sessionId ? `sudo felt-responder-join ${incident.sessionId}` : null;
  const words = [incident.line, incident.followup, incident.backLine].filter(
    (w): w is string => !!w,
  );
  return (
    <>
      <header className="flex pt-10 pr-16 pb-1">
        <Gutter>
          <a href="#systems" className="text-pencil text-[10px] underline">
            ← systems
          </a>
          <span className="mt-1 block text-[9px]">{day(incident.firstAt)}</span>
          <span className="block">{time(incident.firstAt)}</span>
        </Gutter>
        <div className="flex min-w-0 flex-col gap-1 pl-3.5">
          <h1 className="m-0 text-base leading-snug font-black break-words">{incident.title}</h1>
          <p className="text-pencil m-0 font-mono text-[10px]">
            {incident.area} · {incident.tier} · {incident.state}
            {incident.count > 1 ? ` · ${incident.count} alerts` : ""}
            {note(incident) ? ` · ${note(incident)}` : ""}
          </p>
        </div>
      </header>
      <div className="thread flex min-h-0 flex-1 flex-col overflow-y-auto pr-16 pb-8">
        <Section label="what I told you">
          {words.length === 0 ? (
            <p className="font-hand text-pencil m-0 text-sm">nothing yet.</p>
          ) : (
            words.map((w) => (
              <p key={w} className="font-hand text-ink m-0 text-[16px] leading-[30px] break-words">
                {w}
              </p>
            ))
          )}
          <Actions incident={incident} details={false} onHandled={onHandled} />
        </Section>

        <Section label="what Claude found">
          {report ? (
            <>
              <p className="text-salmon m-0 text-sm font-black">
                {VERDICT[report.verdict]}{" "}
                <span className="text-pencil font-mono text-[10px] font-normal">
                  ({report.confidence} confidence)
                </span>
              </p>
              <p className="m-0 text-sm leading-relaxed">{report.summary}</p>
              {report.forMario ? (
                <p className="m-0 text-sm leading-relaxed">
                  <span className="text-sage font-black">for you: </span>
                  {report.forMario}
                </p>
              ) : null}
              {report.proposedFix ? (
                <p className="m-0 text-sm leading-relaxed">
                  <span className="text-sage font-black">he'd fix it by: </span>
                  {report.proposedFix}
                </p>
              ) : null}
              {report.evidence.length ? (
                <ul className="m-0 flex list-disc flex-col gap-1 pl-4 text-[13px] text-[#cfc5cd]">
                  {report.evidence.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              ) : null}
              {report.couldntCheck.length ? (
                <p className="text-pencil m-0 text-[12px]">
                  couldn't check: {report.couldntCheck.join("; ")}
                </p>
              ) : null}
            </>
          ) : (
            <p className="font-hand text-pencil m-0 text-sm">
              {incident.missed
                ? "Claude couldn't look at this one."
                : incident.status === "looking"
                  ? "Claude's on it."
                  : "this one wasn't Claude's."}
            </p>
          )}
        </Section>

        {report?.trail.length ? (
          <Section label="how he got there">
            <details>
              <summary className="font-hand text-pencil cursor-pointer text-sm">
                {report.trail.length} steps
              </summary>
              <div className="mt-2 flex flex-col gap-2">
                {report.trail.map((step, i) => (
                  // steps have no ids and never reorder
                  // oxlint-disable-next-line no-array-index-key
                  <Step key={i} step={step} />
                ))}
              </div>
            </details>
          </Section>
        ) : null}

        <Section label="the alerts">
          {incident.alerts.map((a) => (
            <div key={`${a.at.getTime()}-${a.title}`} className="flex flex-col">
              <span className="text-pencil font-mono text-[10px]">
                {day(a.at)} {time(a.at)}
              </span>
              <span className="text-[13px] break-words">{a.title}</span>
              {a.message ? (
                <span className="font-mono text-[10px] break-words whitespace-pre-wrap text-[#a99fab]">
                  {a.message}
                </span>
              ) : null}
            </div>
          ))}
        </Section>

        <Section label="go further">
          {join ? (
            <div className="flex flex-wrap items-center gap-2">
              <code className="bg-[#0f0e11] px-1.5 py-0.5 font-mono text-[10px] break-all">
                {join}
              </code>
              <button
                type="button"
                className="font-hand text-pencil bg-transparent p-0 text-sm underline"
                onClick={() =>
                  void navigator.clipboard
                    ?.writeText(join)
                    .then(() => setCopied(true))
                    .catch(() => {})
                }
              >
                {copied ? "copied" : "copy"}
              </button>
            </div>
          ) : null}
          <div className="flex gap-4 text-sm">
            {Object.entries(incident.links).map(([name, url]) => (
              <a
                key={name}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="text-sage underline"
              >
                {name}
              </a>
            ))}
          </div>
        </Section>
      </div>
    </>
  );
}
