/** WP-62 phase 1 (the 10-03 incident): no credential ever lands in browser
 * storage. The app once kept an ntfy password in localStorage (3ed8a32,
 * removed in 5c9bb22); this is the regression test that closes that defect.
 *
 * - static: persistent browser stores are touched only by the allowlisted
 *   file, for its one non-secret key (her ink's seen-marks);
 * - runtime: a recognisable fake credential (the canary) is fed in through
 *   every API answer, the live stream and every text field on every page -
 *   it must never show up in localStorage, sessionStorage or a cookie, and
 *   nothing but the allowlisted key is ever written.
 * Field names alone prove nothing (a harmless-looking name slips through),
 * so the canary is checked by value. */

import { act, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Controls } from "@/pages/Controls";
import { Lists } from "@/pages/Lists";
import { Margins } from "@/pages/Margins";
import { Settings } from "@/pages/Settings";
import { Systems } from "@/pages/Systems";
import { Talk } from "@/pages/Talk";

const CANARY = "felt-canary-7f3a9c-not-a-real-secret";
// file -> the storage keys it may use (non-secret preferences only)
const ALLOWED: Record<string, string[]> = { "./lib/ink.ts": ["felt-ink-seen"] };
const STORAGE_API =
  /\b(localStorage|sessionStorage|indexedDB|IDBFactory|caches\s*\.|CacheStorage|document\s*\.\s*cookie|navigator\s*\.\s*storage|cookieStore)\b/;

// every app source file (paths relative to src/), tests and test setup aside
const SOURCES = import.meta.glob<string>(
  ["./**/*.{ts,tsx}", "!./**/*.test.{ts,tsx}", "!./test/**"],
  { query: "?raw", import: "default", eager: true },
);

describe("static: persistent browser storage", () => {
  it("is used only by the allowlisted files", () => {
    expect(Object.keys(SOURCES).length).toBeGreaterThan(10); // the glob found the app
    const users = Object.entries(SOURCES)
      .filter(([, text]) => STORAGE_API.test(text))
      .map(([path]) => path);
    expect(users.toSorted()).toEqual(Object.keys(ALLOWED).toSorted());
  });
});

// Every answer carries the canary in every credential-shaped place.
function canaryAnswer(): Response {
  const secretish = {
    token: CANARY, password: CANARY, secret: CANARY, api_key: CANARY,
    access_token: CANARY, refresh_token: CANARY, authorization: CANARY, session: CANARY,
  }; // prettier-ignore
  return new Response(JSON.stringify({ ...secretish, user: { ...secretish }, items: [] }), {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CANARY}`,
      "X-Auth-Token": CANARY,
    },
  });
}

class CanaryEventSource {
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  readyState = 1;
  url: string;
  constructor(url: string) {
    this.url = url;
    setTimeout(() => {
      this.onmessage?.(
        new MessageEvent("message", { data: JSON.stringify({ type: "hello", token: CANARY }) }),
      );
    }, 0);
  }
  addEventListener() {}
  removeEventListener() {}
  close() {}
}

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
});

const PAGES: [string, () => ReactElement][] = [
  ["Talk", () => <Talk />],
  ["Margins", () => <Margins onUnreadChange={() => {}} />],
  ["Systems", () => <Systems />],
  ["Lists", () => <Lists />],
  ["Controls", () => <Controls />],
  ["Settings", () => <Settings />],
];

describe("runtime: the canary credential never reaches browser storage", () => {
  it.each(PAGES)("%s", async (_name, page) => {
    const writes: [string, string][] = [];
    const realSetItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      writes.push([key, String(value)]);
      realSetItem.call(this, key, value);
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(canaryAnswer())),
    );
    vi.stubGlobal("EventSource", CanaryEventSource);
    vi.spyOn(console, "error").mockImplementation(() => {}); // pages may dislike the odd shapes

    const { container } = render(page());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    const user = userEvent.setup();
    for (const field of container.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      "input:not([type=checkbox]):not([type=radio]), textarea",
    )) {
      // one field at a time, like a person typing (the page reacts in between)
      // oxlint-disable-next-line no-await-in-loop
      await user.type(field, `${CANARY}{Enter}`);
    }
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    const stored = [localStorage, sessionStorage].flatMap((s) =>
      Array.from({ length: s.length }, (_, i) => `${s.key(i)}=${s.getItem(s.key(i)!)}`),
    );
    expect(stored.join("\n")).not.toContain(CANARY);
    expect(writes.map(([, v]) => v).join("\n")).not.toContain(CANARY);
    expect(document.cookie).not.toContain(CANARY);
    const allowedKeys = new Set(Object.values(ALLOWED).flat());
    expect(writes.map(([k]) => k).filter((k) => !allowedKeys.has(k))).toEqual([]);
  });
});
