import { useEffect, useState } from "react";

/** The notebook's sections, one per sticky flag (WP-42 decision 2). */
export const PAGES = ["talk", "margins", "diary", "lists", "systems"] as const;
export type PageName = (typeof PAGES)[number];

export function pageFromHash(hash: string): PageName {
  const name = hash.replace(/^#\/?/, "");
  return (PAGES as readonly string[]).includes(name) ? (name as PageName) : "talk";
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
