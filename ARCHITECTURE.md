# felt-dashboard — architecture audit (WP-38)

Read-only audit. Measured via `git ls-files`, `wc -l`, and reading every
source file; no dev server was started per instructions — `package.json`
and `src/` were read instead.

## 1. Purpose

The chat UI for Felt (text + voice) against `felt-core`'s API — the "actual
way to use Felt". Built static output only; it does not run its own
process. Originally slated for a Tauri (Rust) desktop shell; after the
Windows migration that was dropped for felt-tray hosting this build in a
`pywebview`/WebView2 window instead. Forked from `clockmost-frontend-
template`, on the shared clockmost React/Vite/Endfield stack.

## 2. Runtime

- **Launch:** none of its own — `pnpm build` (`tsc --noEmit && vite
  build`) produces static `dist/`, which felt-tray's `DashboardServer`
  serves on a local ephemeral port and points its `pywebview` window at.
  `pnpm dev` (Vite dev server) exists for standalone development but is
  not how Felt runs it in production.
- **Ports:** none bound by this repo itself; whatever Vite/felt-tray
  assigns at dev/serve time.
- **Outbound (from the browser):** `felt-core` at `VITE_FELT_CORE_URL`
  (required, throws if unset — `src/lib/config.ts:6-9`); `felt-animation`
  at `VITE_FELT_ANIMATION_URL` (optional, default `127.0.0.1:8421`).

## 3. Entry points

| Path | Role |
|---|---|
| `index.html` | Vite HTML entry, ships `data-theme="dark"` to avoid a flash |
| `src/main.tsx` | mounts `<App />` into `#root` |
| `src/App.tsx` | the entire application — one component, no router |

## 4. Module map

| File | LOC | Responsibility |
|---|---:|---|
| `src/styles/endfield.css` | 924 | vendored Endfield design system (components/motifs), synced from `endfield-design` via `scripts/sync-endfield.sh` — not hand-maintained here |
| `src/App.tsx` | 205 | the whole app: theme toggle, history load/restore, text send, voice record+send, error state, layout |
| `src/lib/api.ts` | 143 | `felt-core`/`felt-animation` HTTP calls: history, voice-chat, text-chat, tone fetch, request-started/reply-ready notifications |
| `src/styles/theme.css` | 74 | bridges `--ef-*` design tokens into Tailwind's `@theme inline` scale |
| `src/components/ChatMessage.tsx` | 80 | one chat bubble; linkifies URLs and inlines image links |
| `src/components/ChatMessage.test.tsx` | 69 | tests for the above |
| `src/lib/useMicRecorder.ts` | 49 | `MediaRecorder`-based mic hook for the in-window mic button |
| `src/lib/useTheme.ts` | 42 | HUD/DOC (dark/light) surface state, persisted to `localStorage` |
| `src/components/Slab.tsx` | 19 | one presentational "big yellow slab" headline component |
| `src/components/ThemeToggle.tsx` | 19 | HUD/DOC toggle button |
| `src/lib/config.ts` | 16 | reads/validates the two `VITE_*` env vars |
| `src/main.tsx` | 16 | React root mount |
| `vite.config.ts` | 18 | React + Tailwind v4 plugins, `@/` alias, Vitest config |
| `src/test/setup.ts` | 13 | Testing Library/jsdom setup |
| `src/vite-env.d.ts` | 1 | Vite client types |

Import direction: `App.tsx` is the only consumer of everything else;
`api.ts`, `useTheme.ts`, `useMicRecorder.ts` and the components have no
inter-dependencies among themselves. No module cycles. This is a flat,
un-layered structure — reasonable at 1,688 total lines, but there is no
separation yet between "shell" (theme, layout) and "chat feature"
(history, send, mic) — everything lives directly in `App.tsx`.

## 5. Interfaces

**HTTP served:** none — static build only.

**HTTP called** (`src/lib/api.ts`):
- *felt-core*: `GET /v1/history?session_id=`, `POST
  /v1/voice-chat?session_id=`, `POST /v1/text-chat`.
- *felt-animation* (best-effort, silently caught — desktop-only/optional):
  `GET /tone`, `POST /request_started`, `POST /reply_ready`.

**Hotkeys:** none — this repo has no OS-level hotkey handling; the mic and
send actions are in-window buttons/Enter-key only (felt-tray owns the
global hotkeys and never touches this window for the primary voice path).

**Capture pipeline:** not present in this repo (felt-tray's `capture.py`
only).

**Data files:** none — no persisted local files; theme choice persists to
`localStorage` (`useTheme.ts:6,10,31`) and chat history is not cached
locally at all (re-fetched from felt-core's own SQLite on every mount/
reload-history call, `App.tsx:39-58`).

## 6. Config

Two env keys, both actually used and both documented:

| Key | In `.env.example` | Used | Notes |
|---|---|---|---|
| `VITE_FELT_CORE_URL` | yes | `config.ts:6` | required, throws if unset |
| `VITE_FELT_ANIMATION_URL` | yes | `config.ts:16` | optional, defaults to `127.0.0.1:8421` |

No gaps found — small surface, and it's kept in sync. **Hardcoded values:**
`SESSION_ID = "dashboard"` (`App.tsx:10`) — a cross-repo contract that must
match felt-tray's own `api_client.py` `SESSION_ID` constant, with no shared
source of truth between the two repos (both docstrings say so, neither
enforces it); the 2000ms abort timeout on `notifyReplyReady`
(`api.ts:92`); the felt-animation default URL (`config.ts:16`).

## 7. Tests

`vitest run` (per `.gitea/workflows/ci.yml`'s `smell` job, not re-run here
per instructions) covers **one file**: `ChatMessage.test.tsx`, 7 tests (URL
linkification, image-link inlining, punctuation trimming, multi-URL
handling, role label rendering).

**Gaps:** `App.tsx` — the entire chat orchestration (history restore, text
send, voice record+send, error banners, the `window.__feltReloadHistory`
bridge felt-tray's `ChatWindow.reload_history()` calls into) — has no
tests at all. `api.ts`, `useTheme.ts`, `useMicRecorder.ts`,
`ThemeToggle.tsx`, `Slab.tsx` are likewise untested. CI does run
`typecheck` and `build` as separate gates, which catches a real class of
regressions the test suite doesn't, but the behavioral surface (does
history actually reload on show, does a failed voice-chat show the right
error, does `playedByAnimation` correctly suppress double-playback) is
untested. No environment-dependent tests found (jsdom covers everything
currently exercised).

## 8. Smells

- **`App.tsx` is a monolith** (205 lines): layout shell, theme, history
  load/restore, the `__feltReloadHistory` window bridge, text-send, and
  voice-send are all inline in one component with no sub-hooks/sub-views.
  Not large in absolute terms, but it is already doing five distinct jobs
  and has zero test coverage for any of them (§7).
- **Untested core logic:** the riskiest code in the repo (async
  send/receive with two side-effecting notifications to felt-animation,
  `api.ts:76-111`) has no tests, unlike felt-tray's equivalent Python path
  which is well covered (`test_app_delivery.py`).
- **Cross-repo hardcoded contract:** `SESSION_ID` (`App.tsx:10`) must
  match felt-tray's `api_client.py` constant by convention only — a typo
  in either place silently splits chat history into two sessions with no
  error.
- **Browser calls felt-animation directly** (`api.ts:37-46,76-111`): fine
  for the current single-machine desktop deployment, but see §9's app-base
  verdict — this assumption does not hold once the app is server-hosted.

## 9. Ranked refactor suggestions

1. **Add tests for `App.tsx`'s async flows** (history restore, text-chat
   send + error path, voice-chat send + `playedByAnimation` branching) via
   Testing Library + a mocked `fetch`. *Why:* this is the actual chat
   logic; it is currently the least-tested code in either repo relative to
   its risk. *Effort:* low-medium. *Risk:* none (test-only). **agent-ok.**
2. **Split `App.tsx`** into a `useChat()` hook (history/send/voice state)
   and a presentational shell, before Track E adds more views. *Why:*
   Track E needs Chat/Feed/Daily-briefs/Diary as separate logs — doing
   this split now, while there is only one view, is cheaper than doing it
   alongside the first new view. *Effort:* low. *Risk:* low (mechanical
   extraction, existing tests from #1 would catch regressions).
   **agent-ok.**
3. **Give `SESSION_ID` one shared source of truth** (e.g. felt-core
   returns/defines it, or a single checked-in constant both repos read at
   build/config time) instead of two hand-synced literals. *Effort:* low.
   *Risk:* low. **agent-ok.**
4. **Decide the felt-animation-from-browser question explicitly before
   Track E work starts** (see verdict below) — either keep tone/reaction
   signaling browser-side only for the desktop client, or move it
   server-side/behind a proxy for the hosted app. *Effort:* n/a (a design
   decision, not a code change). *Risk:* n/a. **needs-Claude** (architecture
   call, not mechanical).

## Fit as the Track E app base

**Verdict: good foundation, not yet structured for it.** What transfers
directly: the build tooling (Vite/TS/oxlint/oxfmt/Vitest/Gitea CI, already
enforced and green), the Endfield design system integration
(`endfield.css`/`theme.css`/HUD-DOC theming), and the `felt-core` API
client pattern in `api.ts`. What does **not** transfer as-is:

- **No routing/multi-view structure.** Track E needs separate logs (Chat,
  Feed, Daily briefs, Diary, later Reminders/Agents) as the plan describes
  them; today there is exactly one view and no router dependency at all.
  This is a real but small gap — see refactor #2.
- **The felt-animation-from-browser calls are desktop-LAN-only.**
  `api.ts` calls `VITE_FELT_ANIMATION_URL` (default `127.0.0.1:8421`)
  directly from client-side `fetch`. That is correct for today's felt-tray-
  hosted window on the same machine as felt-animation, but Track E's plan
  is explicit that the app moves **server-side** (behind Authentik SSO,
  reachable from phone too) while felt-animation stays desktop-only. A
  phone or server-rendered session cannot reach `127.0.0.1:8421` on
  Mario's desktop — this call pattern needs to move behind felt-core (or a
  new server-side relay) rather than being lifted unchanged. This is the
  single most consequential thing to resolve before reusing this repo as
  the Track E base, not a rewrite-everything problem — the actual
  chat-send/receive and history-render logic ports over fine.
- **Single hardcoded `SESSION_ID`.** A multi-log, potentially multi-client
  (desktop + phone) app will need real session/identity handling, not one
  literal constant.

None of this blocks starting Track E on top of felt-dashboard — the
repo is small (1,688 lines) and clean enough that these are additive
changes, not a rewrite.
