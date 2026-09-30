---
name: frontend-development
description: Use when building or modifying React 18 + Vite + Tailwind pages, components, contexts, hooks, or the axios API client under frontend/src/.
---
# Frontend Development

Use this skill whenever you work in `frontend/src/`. Covers Vite + React 18 conventions, file layout (pages/, components/, contexts/, hooks/, api/), the `AuthContext` pattern with JWT-in-memory + refresh cookie, the `ProtectedRoute` wrapper, the axios instance with a 401-refresh interceptor, Tailwind design tokens and `data-theme` theming (no flash on load), polling hooks (`usePolling`) for the live dashboard, toast + empty-state conventions, and accessibility rules (keyboard reachability, ARIA on icon buttons). Read this before adding a page, hook, or API client method.

## Tailwind design tokens (Step 11)

Colors are CSS variables (`--color-*`, `R G B` triples) defined in `src/index.css` under `:root`/`[data-theme="light"]` and `[data-theme="dark"]`, then exposed to Tailwind in `tailwind.config.js` via `rgb(var(--color-x) / <alpha-value>)` so `bg-primary/50`-style opacity utilities work. Available tokens: `bg`, `surface`, `surfaceAlt`, `border`, `text`, `textMuted`, `primary`, `primaryHover`, and the decision-pill pairs `allow`/`allowBg`, `neutralize`/`neutralizeBg`, `block`/`blockBg` (green/amber/red per §12's global UI conventions). `darkMode` is `["selector", '[data-theme="dark"]']` — never use Tailwind's `dark:` variant based on `prefers-color-scheme` directly; it must go through `data-theme`, which `ThemeContext` and the `index.html` pre-paint script both set.

## No-flash theming

`index.html` has an inline script (before `<script type="module" src="/src/main.jsx">`) that reads `localStorage.theme || 'auto'`, resolves `auto` via `matchMedia`, and sets `document.documentElement.dataset.theme` synchronously before first paint. `ThemeContext` re-derives the same resolution on mount and on OS scheme change (while `theme === 'auto'`) — keep both in sync if the resolution logic ever changes.

## Auth pattern

`src/api/client.js` holds the access token in a mutable ref (`accessTokenRef`, set via `setAccessTokenRef`) rather than component state, so the axios interceptor always reads the latest value without needing to recreate the interceptor. On a 401, the response interceptor calls `axios.post("/api/auth/refresh", ...)` directly (not through `client`, to avoid interceptor recursion), shares one in-flight refresh promise across concurrent 401s, retries the original request once (`config._retried` guards against loops), and calls the `onAuthFailure` callback (wired to `AuthContext`'s `clearAuth`) if the refresh itself fails. `AuthContext` stores the refresh token in `localStorage` and restores the session on mount by calling `/auth/refresh` then `GET /users/me` — this is what makes a hard reload on a protected route survive without bouncing to `/login`.

## Toasts

`src/contexts/ToastContext.jsx` (added in Step 11, not in the original §5 file tree — needed for the Login/Register "error toasts" requirement) exposes `useToast()` -> `{ success(msg), error(msg), dismiss(id) }`. Toasts auto-dismiss after 5s and render in a fixed bottom-right `aria-live` region. Reuse this instead of inventing local toast state per page.

## Chart library

Step 13 added `recharts` (not previously in package.json) for `SessionDetail.jsx`'s suspicion-score line chart (`LineChart`/`Line`/`ReferenceLine` for the 0.70 threshold). Style its SVG strokes with the same `rgb(var(--color-x))` tokens used everywhere else (e.g. `stroke="rgb(var(--color-primary))"`) so the chart stays in sync with light/dark theming — recharts doesn't pick up Tailwind classes on its internal SVG nodes, so this has to be inline.

## Shared enum constants

`src/constants.js` holds `SOURCE_TYPES`, `ATTACK_TYPES`/`ATTACK_TYPE_LABELS`, `DECISIONS`, and `SESSION_JAILBREAK_THRESHOLD` (0.70) — the frontend's copy of the backend's `SourceType`/`AttackType`/`Decision` enums and the default `session_jailbreak_threshold`. `Inspect.jsx`, `History.jsx`, and `HistoryDetail.jsx` all import from here instead of redeclaring the lists; add new dropdown options here first if the backend enums ever change.

## N+1 reads where the backend has no aggregate field

`SessionSummaryOut` (from `GET /sessions`) has no "final decision" field — only `turn_count`/`max_suspicion_score`/timestamps. `Sessions.jsx` derives it by firing one `GET /sessions/{id}` per visible row via `useQueries` and reading `turns[turns.length - 1].final_decision`. This is deliberate (not a bug): adding a backend field wasn't allowed without the "no inventing contracts" sign-off, and the row count is bounded by the page size. The same reasoning applies to Dashboard's non-admin StatCards/AttackBreakdown, which aggregate the `page_size=50` history feed client-side instead of calling a nonexistent `/history/stats` endpoint. If either page's dataset grows past ~50 rows per user in practice, ask the backend team for a real aggregate endpoint rather than raising the client-side page size further.

## Settings tabs and the "Use app default" sentinel

`src/pages/Settings.jsx` reads/writes the active tab via `?tab=` (`useSearchParams`) so `Profile.jsx` can deep-link with `<Link to="/settings?tab=models">`. Each tab lives in `src/components/settings/{Models,Thresholds,Privacy,Appearance}Tab.jsx` and calls `PUT /users/me/settings` with **only the fields that tab owns** (e.g. Models sends `{working_model_id, judge_model_id}` only) — the backend only touches JSON keys that are present in the body, so this is how one tab's save avoids clobbering another tab's settings.

`ModelsTab.jsx` represents "use app default" as the sentinel string `"__default__"` in local `<select>` state (native `<select>` can't hold `null`), converting it to `null` only at PUT time. It resolves each dropdown's initial value by checking whether the saved `working_model_id`/`judge_model_id` is present in the fetched allowlist — if not, it falls back the displayed value to the default sentinel and renders the "no longer available" warning banner. The dirty-check (which enables Save) compares live state against this resolved initial value, not the raw saved id. A 422 from the PUT is a `{detail: "working_model_id must be one of: ..."}` string (see `settings.py`) — parse the `field:` prefix to route the error under the right dropdown.

`src/contexts/AuthContext.jsx` exposes `updateUser(patch)` (merges into the in-memory user object) so `Profile.jsx`'s inline display-name edit can update the header/Layout menu immediately after a successful `PATCH /users/me`, without a full refetch.

`Settings` and `Profile` both use the query key `["user-settings"]` for `GET /users/me/settings` — React Query shares that cache entry, so a save on one page (`queryClient.setQueryData(["user-settings"], data)`) is instantly visible on the other without an explicit invalidate-and-refetch round trip.

## AuditLog and admin-only routing

`ProtectedRoute.jsx`'s `adminOnly` prop fires `toast.error(...)` (via a `useEffect`, not during render) before redirecting a non-admin user to `/dashboard` — don't move that logic into the render body or it'll violate React's side-effect rules. `AuditLogOut` (backend) has no `working_model_id`/`judge_model_id` columns and `GET /admin/audit` has no `from`/`to` query params — `AuditLog.jsx` only renders the columns the API actually returns and applies its date-range filter client-side over the current page only (same "no inventing contracts" reasoning as the Sessions/Dashboard deviations above).

## Vite proxy

Backend routers have no `/api` prefix (e.g. `/auth/login`, not `/api/auth/login`). `vite.config.js`'s dev proxy rewrites `/api/*` -> `http://localhost:8000/*` (strips the `/api` prefix). The axios instance's `baseURL` is `"/api"` — always call endpoints as `/auth/login`, `/users/me`, etc. through `client`, and the proxy handles the rest.

## Auth visual system

`AuthVisual.jsx` is the shared, desktop/tablet visual panel for Login and Register. It uses the decorative assets in `public/images/`, is hidden only below Tailwind's `md` breakpoint, and keeps the actual form in the adjacent responsive panel. Keep the image alt text empty when it is purely decorative, preserve visible labels and keyboard focus for every form field, and use the shared decision tokens (green ALLOW, amber NEUTRALIZE, red BLOCK) whenever a result state is presented.

`Layout.jsx` renders both the desktop `Nav` and a compact mobile variant below the `md` breakpoint. Do not hide the only primary navigation on narrow windows; Dashboard, Inspect, History, and Sessions must remain directly reachable at every supported width.

## Manual inspection sessions

`Inspect.jsx` has optional Session ID and Turn fields so a person can replay multi-turn jailbreak cases without calling the API directly. A blank Session ID preserves the one-off inspection behaviour. When a Session ID is supplied it must be a valid UUID (backend contract), and the user reuses it while incrementing Turn from 1; keep this in sync with `manual_test_cases/README.md` whenever the form changes.

Validate a non-empty Session ID in the browser before submitting and show the error inline on the field. Do not let the backend's generic 422 handling mislabel a malformed session identifier as a source-parser failure.

## Live Inspect console and demo scenarios

`pages/Inspect.jsx` supports both paste and attachment modes for every source type. Textual sources (including HTML and email) may be pasted or attached; binary sources remain attachment-first and are base64 encoded in memory. `demoScenarios.js` is the source of truth for long, synthetic, source-specific prompts. `InspectionConsole.jsx` renders an accessible staged trace and rotates short credited field notes while the existing JSON inspection request is in flight; it must not expose raw input or secrets in logs.

The Dashboard's **Launch live demo** action navigates to `/inspect?demo=1&autostart=1`. Inspect owns the guided replay: it presents the scenario queue and progress, runs the existing synthetic `DEMO_ATTACKS` through the real API, and lets the user stop after the current check or replay the tour. Keep the replay state separate from manual form state so the user can still use `/inspect` without query parameters for one-off inspections.

Keep the live console's stage details, trace output, and quote attribution at high contrast on its dark navy surface (`slate-300` or brighter). Log each pipeline stage once, stop the progress timer after the policy stage, and expose trace lines through the labelled `role="log"` region so long-running inspections remain readable without producing duplicate terminal entries.
