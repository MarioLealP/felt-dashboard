import { useEffect, useState } from "react";

/** The notebook's sections, one per sticky flag (WP-42 decision 2; settings
 * and controls added 10-03). */
export const PAGES = [
  "talk",
  "margins",
  "diary",
  "lists",
  "systems",
  "controls",
  "settings",
] as const;
export type PageName = (typeof PAGES)[number];

export function pageFromHash(hash: string): PageName {
  const name = hash.replace(/^#\/?/, "").split(/[/?]/)[0] ?? "";
  return (PAGES as readonly string[]).includes(name) ? (name as PageName) : "talk";
}

/** The id after a section, e.g. #systems/12 -> 12 (an incident's details). */
export function idFromHash(hash: string): number | null {
  const id = hash.replace(/^#\/?/, "").split("?")[0]?.split("/")[1];
  return id && /^\d+$/.test(id) ? Number(id) : null;
}

export function useHashId(): number | null {
  const [id, setId] = useState<number | null>(() => idFromHash(window.location.hash));
  useEffect(() => {
    const onHash = () => setId(idFromHash(window.location.hash));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return id;
}

/** Hash routing (#talk, #diary…): the app is served as static files, so
 * every section works without server-side fallbacks. */
export function usePage(): PageName {
  const [page, setPage] = useState<PageName>(() => pageFromHash(window.location.hash));
  useEffect(() => {
    const onHash = () => setPage(pageFromHash(window.location.hash));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return page;
}
