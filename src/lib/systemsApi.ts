/** WP-42.5: the Systems page's data from felt-core (/v1/app/systems,
 * /v1/app/incidents/*), built from her incidents: how things are, what
 * happened, and everything about one incident. */

import { call } from "@/lib/appApi";

export const AREAS = ["server", "backups", "security", "desktop", "laptop", "router"] as const;
export type AreaName = (typeof AREAS)[number];
/** what an area's dot says, worst first */
export type Status = "needs-you" | "looking" | "watching" | "fine";
export type Verdict = "expected" | "fixed-itself" | "needs-mario" | "unknown";

export interface Area {
  name: AreaName;
  status: Status;
  count: number;
  incidentId: number | null;
}

export interface Incident {
  id: number;
  area: AreaName;
  tier: string;
  state: string;
  status: Status;
  expected: boolean;
  title: string;
  count: number;
  firstAt: Date;
  lastAt: Date;
  line: string | null;
  followup: string | null;
  backLine: string | null;
  verdict: Verdict | null;
  missed: boolean;
  /** her newest line about it, which "ask Felt" answers in Talk */
  lineMessageId: number | null;
}

export interface SystemsPage {
  areas: Area[];
  circled: number | null;
  incidents: Incident[];
}

export interface TrailStep {
  said?: string;
  tool?: string;
  input?: string;
  output?: string;
  error?: boolean;
}

export interface Report {
  verdict: Verdict;
  summary: string;
  evidence: string[];
  forMario: string;
  proposedFix: string;
  confidence: string;
  couldntCheck: string[];
  trail: TrailStep[];
}

export interface RawAlert {
  at: Date;
  title: string;
  message: string;
}

export interface IncidentDetails extends Incident {
  alerts: RawAlert[];
  report: Report | null;
  sessionId: string | null;
  handledBy: string | null;
  links: Record<string, string>;
}

const STATUSES = new Set(["needs-you", "looking", "watching", "fine"]);
const VERDICTS = new Set(["expected", "fixed-itself", "needs-mario", "unknown"]);
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
const strs = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
// felt-core stores UTC as "YYYY-MM-DD HH:MM:SS"
const utc = (v: unknown): Date =>
  new Date(typeof v === "string" ? `${v.replace(" ", "T")}${v.endsWith("Z") ? "" : "Z"}` : 0);

function parseArea(row: unknown): Area | null {
  const r = row as Record<string, unknown> | null;
  if (!r || !(AREAS as readonly unknown[]).includes(r.name)) return null;
  return {
    name: r.name as AreaName,
    status: STATUSES.has(String(r.status)) ? (r.status as Status) : "fine",
    count: typeof r.count === "number" ? r.count : 0,
    incidentId: typeof r.incident_id === "number" ? r.incident_id : null,
  };
}

export function parseIncident(row: unknown): Incident | null {
  const r = row as Record<string, unknown> | null;
  if (!r || typeof r.id !== "number" || typeof r.title !== "string") return null;
  return {
    id: r.id,
    area: (AREAS as readonly unknown[]).includes(r.area) ? (r.area as AreaName) : "server",
    tier: str(r.tier) ?? "default",
    state: str(r.state) ?? "open",
    status: STATUSES.has(String(r.status)) ? (r.status as Status) : "fine",
    expected: r.expected === true,
    title: r.title,
    count: typeof r.count === "number" ? r.count : 1,
    firstAt: utc(r.first_at),
    lastAt: utc(r.last_at),
    line: str(r.line),
    followup: str(r.followup),
    backLine: str(r.back_line),
    verdict: VERDICTS.has(String(r.verdict)) ? (r.verdict as Verdict) : null,
    missed: r.missed === true,
    lineMessageId: typeof r.line_message_id === "number" ? r.line_message_id : null,
  };
}

function parseTrail(v: unknown): TrailStep[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((s: Record<string, unknown>) => {
    const step: TrailStep = {};
    if (typeof s?.said === "string") step.said = s.said;
    if (typeof s?.tool === "string") step.tool = s.tool;
    if (typeof s?.input === "string") step.input = s.input;
    if (typeof s?.output === "string") step.output = s.output;
    if (s?.error === true) step.error = true;
    return step.said || step.tool ? [step] : [];
  });
}

export function parseReport(v: unknown): Report | null {
  const r = v as Record<string, unknown> | null;
  if (!r || !VERDICTS.has(String(r.verdict))) return null;
  return {
    verdict: r.verdict as Verdict,
    summary: str(r.summary) ?? "",
    evidence: strs(r.evidence),
    forMario: str(r.for_mario) ?? "",
    proposedFix: str(r.proposed_fix) ?? "",
    confidence: str(r.confidence) ?? "low",
    couldntCheck: strs(r.couldnt_check),
    trail: parseTrail(r.trail),
  };
}

export function parseDetails(data: unknown): IncidentDetails | null {
  const base = parseIncident(data);
  if (!base) return null;
  const r = data as Record<string, unknown>;
  const alerts = Array.isArray(r.alerts)
    ? r.alerts.flatMap((a: Record<string, unknown>) =>
        typeof a?.title === "string"
          ? [{ at: utc(a.at), title: a.title, message: str(a.message) ?? "" }]
          : [],
      )
    : [];
  const links = (r.links ?? {}) as Record<string, unknown>;
  return {
    ...base,
    alerts,
    report: parseReport(r.report),
    sessionId: str(r.session_id),
    handledBy: str(r.handled_by),
    links: Object.fromEntries(
      Object.entries(links).filter((e): e is [string, string] => typeof e[1] === "string"),
    ),
  };
}

export async function getSystems(before?: number): Promise<SystemsPage> {
  const data = (await call(`/systems${before === undefined ? "" : `?before=${before}`}`)) as Record<
    string,
    unknown
  >;
  return {
    areas: Array.isArray(data.areas) ? data.areas.flatMap((a) => parseArea(a) ?? []) : [],
    circled: typeof data.circled === "number" ? data.circled : null,
    incidents: Array.isArray(data.incidents)
      ? data.incidents.flatMap((i) => parseIncident(i) ?? [])
      : [],
  };
}

export async function getIncident(id: number): Promise<IncidentDetails | null> {
  return parseDetails(await call(`/incidents/${id}`));
}

export async function markHandled(id: number): Promise<void> {
  await call(`/incidents/${id}/handled`, { method: "POST" });
}
