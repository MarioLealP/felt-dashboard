# felt-dashboard

The actual way to use [Felt](https://git.clockmost.com/Benylin/Felt) — a
chat UI (text + voice) talking to `felt-core`'s API. Forked from
`clockmost-frontend-template`, on the same stack as every other clockmost
front-end.

## What it does

- Text chat against `felt-core`'s `POST /v1/chat`.
- Voice: hold the mic button, `MediaRecorder` captures audio, sent to
  `felt-core`'s `POST /v1/voice-chat` (STT → brain → TTS in one call),
  the reply plays back automatically.
- Config via `VITE_FELT_CORE_URL` (`.env`, never hardcoded).

## Status (2026-09-20)

Built and running. Originally slated to ship wrapped in Tauri (Rust); after
the desktop's Linux→Windows migration that plan was dropped in favor of a
Python shell (`felt-tray`, in the sibling `felt-tray/` project) hosting this
built frontend in a `pywebview`/WebView2 window — no Rust dependency, no
`src-tauri/`. This repo builds the static frontend only; felt-tray owns the
tray icon, global hotkey, native mic capture for push-to-talk, toast
notifications, and the felt-overlay relay.

**Stack**

| Concern   | Choice                                                     | Why                                                                                                                     |
| --------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Framework | **React 19** + **Vite 8**                                  | matches the earlier `endfield-dashboard`; instant HMR; the Vite 8 React plugin transforms JSX with **oxc**, no Babel    |
| Language  | **TypeScript 7** (native compiler)                         | `tsc --noEmit` is the typecheck gate; fast                                                                              |
| Styling   | **Tailwind v4** (`@tailwindcss/vite`) + **`endfield.css`** | Tailwind for layout/spacing, the `.ef-*` design system for components — both fed by the same `--ef-*` custom properties |
| Lint      | **oxlint**                                                 | Rust-fast; replaces ESLint                                                                                              |
| Format    | **oxfmt**                                                  | Rust-fast, Prettier-compatible; replaces Prettier                                                                       |
| Test      | **Vitest** + Testing Library (jsdom)                       |                                                                                                                         |
| CI        | **Gitea Actions** (`.gitea/workflows/ci.yml`)              | one `smell` job: fmt → lint → types → test → build                                                                      |

Prettier and ESLint are **not** installed and should stay that way.

## Commands

```sh
pnpm install
pnpm dev            # vite dev server
pnpm check          # everything CI runs: fmt:check, lint, typecheck, test
pnpm fmt            # format in place (oxfmt)
pnpm lint           # oxlint, warnings fail (--deny-warnings)
pnpm lint:fix       # oxlint autofix
pnpm build          # tsc --noEmit && vite build
pnpm test:watch     # vitest watch
pnpm sync:endfield  # re-vendor src/styles/endfield.css from the design repo
```

## The styling split

`endfield.css` (the design system, vendored in `src/styles/`) owns **components,
motifs and structure** — `.ef-card`, `.ef-gauge`, `.ef-slab`, the chamfer, the
diamond marker, HUD/DOC theming. Tailwind owns **layout, spacing, flex/grid and
one-off colour**.

`src/styles/theme.css` bridges them: the `--ef-*` tokens are mapped into
Tailwind's scale with `@theme inline`, so `bg-surface`, `border-line`,
`text-ink-2`, `font-mono` etc. resolve to the live `--ef-*` values and follow the
`[data-theme]` swap. Tailwind's `rounded-*` scale is zeroed — Endfield is radius-0.

```tsx
// components: the design system's classes
<div className="ef-card ef-brackets">…</div>

// layout: Tailwind, on the shared tokens
<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">…</div>
```

Two extra utilities from `theme.css`: `chamfer` (the two-corner clip) and `rail`
(the 3px active left edge).

## HUD ⇄ DOC

`useTheme()` reflects the surface onto `<html data-theme>` and remembers it per
browser. `index.html` ships `data-theme="dark"` so there's no flash. Endfield is
dark-first; `light` is the "DOC" document surface.

## The design system

`src/styles/endfield.css` is a **vendored copy** — the source is
`git.clockmost.com/Benylin/endfield-design`. When that ships a new version:

```sh
pnpm sync:endfield
# or, from a local checkout:
EF_SRC=~/Projects/endfield-design/endfield.css pnpm sync:endfield
```

Fonts (Chakra Petch / Jost / JetBrains Mono) are loaded from Google Fonts in
`index.html`.

## Notes

- `oxfmt` is pre-1.0 (0.65) — pinned exact; expect the occasional formatting
  churn on upgrade. `oxlint` is 1.x and stable.
- `@vitejs/plugin-react@6` is Vite 8's oxc-based React plugin (not the older
  standalone `@vitejs/plugin-react-oxc`, which stops at Vite 7).
- `.oxlintrc.json` allows unassigned imports only for `*.css` and
  `@testing-library/*`; anything else `import "x"` is flagged.
