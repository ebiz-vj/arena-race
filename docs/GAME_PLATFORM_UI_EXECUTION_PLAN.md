# Game Platform UI — Step-by-Step Execution Plan

**Purpose:** Turn the Arena Race webapp into a proper game platform UI that an autonomous AI agent can build incrementally. Target: login/account, dashboard, wallets, rewards, and a polished platform layout similar to popular game launchers (e.g. Steam, Epic, game portals).

**Audience:** Autonomous AI agent. Each step is atomic, has clear file paths, acceptance criteria, and no ambiguous dependencies.

**Prerequisites:**
- Repo state: `arena-race/webapp` exists with React + Vite + ethers; single-page flow (wallet connect, queue, match, enter, play, submit result) in `src/App.tsx`.
- Game server running at `http://localhost:3000` (queue + match APIs).
- Reference: [README.md](../README.md), [PRODUCTION_READY_LOCAL_DEVELOPMENT_PLAN.md](PRODUCTION_READY_LOCAL_DEVELOPMENT_PLAN.md).

**Out of scope for this plan:** Backend auth server, OAuth/social login, server-side user DB. Identity = connected wallet (MetaMask / WalletConnect-style). Optional: persist “display name” in localStorage keyed by wallet.

---

## Document structure

| Phase | Goal |
|-------|------|
| **P1** | Project setup: routing, layout shell, design tokens |
| **P2** | Auth / account: wallet connect as login, account page |
| **P3** | Dashboard: overview, quick stats, recent activity |
| **P4** | Wallets: balance, chain, disconnect, multi-chain hint |
| **P5** | Rewards: payouts, leaderboard placeholder, achievements placeholder |
| **P6** | Polish: nav, responsive, accessibility, error boundaries |

Execute phases in order. Within each phase, complete steps in the order listed. Mark steps done only when the “Done when” criterion is satisfied.

---

## For autonomous agents

- **Paths:** All paths are relative to the repo root (e.g. `arena-race/webapp/src/...`). Use the same path format when creating or editing files regardless of OS.
- **Optional choices:** When a step offers Option A vs B, choose as follows unless the user specifies otherwise:
  - P2.4 (gate when not connected): **Option A** — do not gate routes; show "Connect wallet" prompts where needed. Add a one-line comment in the router: `// Auth: no route gate; unconnected users see connect prompts per GAME_PLATFORM_UI_EXECUTION_PLAN P2.4 Option A.`
  - P5.2 (payouts source): **Option A** if chain event reading is available (escrow contract, `queryFilter` or equivalent); otherwise show the **empty state** ("Payout history will appear here after you complete matches" + link to Play). Document in one comment in `Rewards.tsx`: `// Payouts: chain events (Option A) | empty state (no backend).`
- **Verification:** After each step, run `npm run build` from `arena-race/webapp`; it must succeed. After each phase, optionally start the dev server (`npm run dev`), open `http://localhost:5173`, and confirm the phase's "Done when" with a quick manual check (e.g. navigate to each route, connect wallet on Play).
- **No contract or game-server changes** unless a step explicitly asks (e.g. P5.2 Option B). Keep `GAME_SERVER_URL` as `http://localhost:3000` for local development.

---

## Local development and testing

This plan is written for **local development and testing** only.

- **Assumptions:**
  - Hardhat node (or equivalent) at `http://127.0.0.1:8545`; chain id `31337`.
  - Game server at `http://localhost:3000` (queue + match APIs).
  - Webapp dev server at `http://localhost:5173` (Vite default).
  - Config: `arena-race/webapp/public/deployed-local.json`; in the app, load it from **`/deployed-local.json`** (Vite serves `public/` at `/`). Use cache-bust query (e.g. `?t=${Date.now()}`) when needed to avoid stale config after redeploy.
- **How to run the full stack** (for manual verification): See [README.md](../README.md) — start node, deploy contracts, game server, signer, then webapp. No production env vars or secrets are required for this plan.
- **Testing:** No automated E2E is required by this plan. Verification is build success plus optional manual click-through. Add or run E2E only if the user requests it.

---

# Phase P1 — Project Setup (Routing, Layout, Design Tokens)

**Goal:** Add client-side routing and a reusable platform layout so all future pages live inside a consistent shell. Introduce design tokens (colors, spacing, typography) for a cohesive look.

---

### Step P1.1 — Install React Router

- [ ] In `arena-race/webapp/`, run: `npm install react-router-dom`.
- [ ] Add types if needed: `npm install -D @types/react-router-dom` only if TypeScript complains about missing types (React Router 6 ships with types).

**Done when:** `package.json` lists `react-router-dom`; `npm run build` succeeds.

---

### Step P1.2 — Design tokens (CSS variables)

- [ ] Create or extend `arena-race/webapp/src/index.css` with design tokens as CSS custom properties under `:root`:
  - **Colors:** `--bg-primary`, `--bg-secondary`, `--bg-card`, `--border`, `--text-primary`, `--text-secondary`, `--text-muted`, `--accent`, `--accent-hover`, `--success`, `--error`, `--nav-bg`, `--nav-text`.
  - **Spacing:** `--space-xs` through `--space-xl` (e.g. 4px, 8px, 12px, 16px, 24px, 32px).
  - **Typography:** `--font-sans`, `--font-mono`, `--text-sm`, `--text-base`, `--text-lg`, `--text-xl`, `--font-medium`, `--font-semibold`.
  - **Radii:** `--radius-sm`, `--radius-md`, `--radius-lg`.
- [ ] Use a dark theme by default (e.g. dark background, light text) so the app feels like a game launcher.
- [ ] Replace hardcoded colors in existing `index.css` (e.g. `#0f0f12`, `#18181b`, `#3b82f6`) with these variables where it makes sense.

**Done when:** All tokens are defined; at least one existing component or global style uses them; no regression in current UI appearance.

---

### Step P1.3 — Layout component (shell)

- [ ] Create `arena-race/webapp/src/components/Layout.tsx`.
  - **Structure:** A top **header** (logo/brand + primary nav + wallet/account area), a **main** content area, and an optional **footer** (links, chain id, “Arena Race”).
  - **Props:** `children: React.ReactNode`. No routing inside Layout; routing is in the parent.
  - **Header:** Placeholder logo/text “Arena Race”; nav links: “Dashboard”, “Play”, “Rewards”, “Wallet” (or “Account”) — use `<Link to="...">` from `react-router-dom`. Right side: slot for “Connect wallet” or wallet summary (address shorthand, balance). This slot will be filled in P2.
  - Use design tokens for background, border, text (e.g. `var(--nav-bg)`, `var(--text-primary)`).
- [ ] Create `arena-race/webapp/src/components/Layout.css` (or use CSS modules `Layout.module.css`) for layout-specific styles (flexbox/grid for header/main/footer).

**Done when:** `Layout` renders header + main + footer; nav links and a placeholder for wallet exist; importing Layout in App and wrapping content shows the new shell.

---

### Step P1.4 — Router and route list

**Execution order (agent):** Complete P1.5 first (extract game UI into `pages/Play.tsx`), then return to P1.4 to add the router and routes that reference Play and the placeholder pages. That way `/play` can render the extracted component immediately.

- [ ] In `arena-race/webapp/src/App.tsx` (or a new `arena-race/webapp/src/AppRouter.tsx` if you prefer to keep App minimal):
  - Wrap the app with `BrowserRouter`.
  - Define routes (e.g. `createBrowserRouter` + `RouterProvider`, or `<Routes>` + `<Route>`):
    - `/` → Dashboard (placeholder page for now: “Dashboard” heading and short welcome text).
    - `/play` → Current game flow (existing queue, match, enter, board, submit result). Move the current single-page content into a **Play** page component.
    - `/rewards` → Rewards page (placeholder: “Rewards” heading).
    - `/wallet` → Wallet page (placeholder: “Wallet” heading).
    - `/account` → Account page (placeholder: “Account” heading).
  - Wrap all route content with `Layout` so every page has the same header and footer.
- [ ] Ensure the existing game flow still works at `/play` (wallet connect, queue, match create/enter, start match, moves, submit result).

**Done when:** Navigating to `/`, `/play`, `/rewards`, `/wallet`, `/account` shows the correct page inside Layout; `/play` contains the full current flow and it is functional.

---

### Step P1.5 — Move game flow into Play page

**Execution order (agent):** Do this step before P1.4. Create `Play.tsx` and move the game UI here first; then in P1.4 add the router and routes that render Play.

- [ ] Extract the current in-App game UI (wallet connect state, queue, match ID, create/enter, board, moves, submit result) into a dedicated component, e.g. `arena-race/webapp/src/pages/Play.tsx` (or `PlayPage.tsx`).
- [ ] Keep shared state (provider, address, deployed config, chainId) either:
  - In App and pass down via props/context, or
  - In a small “wallet context” (see P2) that both Layout and Play use.
- [ ] App (or AppRouter) renders only router + Layout; the Play route renders `<Play />` (or the extracted component) inside Layout.

**Done when:** Full game flow works from `/play`; no duplicate wallet logic; Layout shows on all routes.

---

**Phase P1 sign-off:** Routing works; Layout wraps all pages; design tokens exist; Play page contains the complete game. _________________ Date: __________

---

# Phase P2 — Auth / Account (Wallet as Login)

**Goal:** Treat “Connect wallet” as login. Show account/wallet info in the header and provide an Account page (wallet, chain, optional display name).

---

### Step P2.1 — Wallet context

- [ ] Create `arena-race/webapp/src/context/WalletContext.tsx` (or `WalletContext.tsx`).
  - State: `provider`, `address`, `chainId`, `deployed` (from `deployed-local.json` or similar), `usdcBalance`, and setters/refresh.
  - Expose: `connectWallet`, `disconnectWallet`, `refreshAccount` (re-fetch balance, chain), and a function to load `deployed` config (e.g. fetch `/deployed-local.json` with cache-bust).
  - Provider wraps the router (so Layout and all pages can use `useWallet()` or similar).
- [ ] Move wallet connection logic from the old App/Play into this context (ethers `BrowserProvider`, `window.ethereum`, request accounts, switch chain if needed).
- [ ] Persist nothing sensitive; optional: store “last connected chain id” in localStorage to suggest the right network on next connect.

**Done when:** Any component can call `useWallet()` (or the chosen hook name) to get `address`, `chainId`, `connectWallet`, `disconnectWallet`, etc.; connecting in Play updates the context; Layout can read the same state.

---

### Step P2.2 — Header wallet slot

- [ ] In `Layout.tsx`, use the wallet context:
  - If not connected: show a “Connect wallet” button that calls `connectWallet()` from context.
  - If connected: show shortened address (e.g. `0x1234…5678`), optional USDC balance (e.g. “1,234 USDC”), and a “Disconnect” or dropdown with “Disconnect” and “Account” link. Clicking “Account” navigates to `/account`.
- [ ] Style the header wallet area with design tokens; make it clearly visible (e.g. right-aligned in header).

**Done when:** Header shows Connect when disconnected and address/balance/Disconnect when connected; Disconnect clears the wallet state.

---

### Step P2.3 — Account page content

- [ ] Implement `arena-race/webapp/src/pages/Account.tsx` (or `AccountPage.tsx`).
  - If not connected: show “Connect your wallet to see your account” and a Connect button.
  - If connected: show:
    - Wallet address (full, with copy button).
    - Network name and chain id (e.g. “Localhost 8545 (31337)”).
    - USDC balance (from context).
    - Optional: “Display name” field stored in `localStorage` keyed by `address` (e.g. `arena_displayname_${address}`). No backend.
  - Link back to Dashboard or Play in the nav.

**Done when:** Account page shows wallet and network info when connected; display name persists in localStorage per address; copy address works.

---

### Step P2.4 — Redirect or gate when not connected (optional)

- [ ] Option A: Do not gate routes; show “Connect wallet” prompts on Dashboard/Play/Rewards/Wallet when needed.
- [ ] Option B: Redirect `/account` and `/wallet` to `/` (or a “Connect to continue” splash) when `address` is null. Document which option is chosen in a one-line comment in the router or Layout.

**Done when:** Behavior is consistent and documented; no broken redirect loops.

---

**Phase P2 sign-off:** Wallet context powers header and Account page; Connect/Disconnect work; Account page shows wallet and optional display name. _________________ Date: __________

---

# Phase P3 — Dashboard

**Goal:** A landing page that feels like a game dashboard: overview, key stats, and recent activity.

---

### Step P3.1 — Dashboard page shell

- [ ] Replace the Dashboard placeholder with a real `arena-race/webapp/src/pages/Dashboard.tsx`.
  - Title: “Dashboard” or “Home”.
  - Short welcome line (e.g. “Welcome to Arena Race” or “Welcome back, {displayName or address shorthand}” when connected).
  - Use Layout and design tokens; keep the page responsive (works on small and large screens).

**Done when:** Dashboard page renders a welcome and clear section structure.

---

### Step P3.2 — Stats cards (when connected)

- [ ] When wallet is connected, show 2–4 **stat cards** in a grid (e.g. 2x2 or 4 in a row on desktop):
  - **USDC balance** (from WalletContext).
  - **Matches played** (optional: from game server if you add `GET /player/stats?wallet=0x...` in a later step; otherwise show “—” or “0” and a note “Play matches to see stats”).
  - **Wins / Top-2 finishes** (optional: same as above or placeholder “—”).
  - **Current tier** (e.g. “Bronze” — can be fixed for MVP or from queue tier).
- [ ] If not connected, show a single card or line: “Connect your wallet to see your stats” and a Connect button.

**Done when:** Dashboard shows at least USDC balance when connected; other stats are placeholders or wired to an API if implemented.

---

### Step P3.3 — Recent activity / Quick actions

- [ ] **Recent activity:** A section “Recent activity” or “Recent matches”. Options:
  - If game server exposes something like `GET /player/matches?wallet=0x...` (to be added in backend), use it to list last 5–10 matches (match id, result, date).
  - Otherwise show “No recent matches” and a link to “Go to Play” (`/play`).
- [ ] **Quick actions:** Buttons or links: “Find a match (Play)”, “View rewards”, “Wallet”. Each navigates to the correct route.

**Done when:** Dashboard has a recent-activity section (data or empty state) and quick action links; navigation works.

---

**Phase P3 sign-off:** Dashboard shows welcome, stats (at least USDC), recent activity or empty state, and quick actions. _________________ Date: __________

---

# Phase P4 — Wallets Page

**Goal:** A dedicated Wallet page: balance, chain, disconnect, and clarity on which network is required.

---

### Step P4.1 — Wallet page content

- [ ] Implement `arena-race/webapp/src/pages/Wallet.tsx`.
  - If not connected: “Connect your wallet to view balance and network.” + Connect button.
  - If connected:
    - **Network:** Name + chain id (e.g. “Localhost 8545”, “Chain ID: 31337”). If chain id is not the deployed one (e.g. 31337 for local), show a warning and a “Switch network” button that calls the wallet context to request the correct chain.
    - **USDC balance:** Large, readable (e.g. “1,234.56 USDC”). Refresh button to re-fetch from context.
    - **Escrow address** (read-only): Short note “Contract: 0x…abc” with copy, so users can verify they’re on the right deployment.
    - **Disconnect** button.
  - Use cards/sections and design tokens.

**Done when:** Wallet page shows network, USDC balance, optional escrow hint, and disconnect; “Switch network” works when on wrong chain.

---

### Step P4.2 — MetaMask balance note

- [ ] Add a short, dismissible or static note on the Wallet page: “MetaMask may not update custom token balances on Localhost. The balance above is read from the chain and is correct.” (Reuse or adapt from existing webapp copy if present.)

**Done when:** Note is visible on Wallet page.

---

**Phase P4 sign-off:** Wallet page is the single place for balance, network, and disconnect; wrong-network warning and switch work. _________________ Date: __________

---

# Phase P5 — Rewards

**Goal:** A Rewards area: payouts history (or placeholder), leaderboard placeholder, and achievements placeholder.

---

### Step P5.1 — Rewards page structure

- [ ] Implement `arena-race/webapp/src/pages/Rewards.tsx` with three sections (can be tabs or stacked):
  1. **Payouts** — list of past payouts for the connected wallet.
  2. **Leaderboard** — placeholder (e.g. “Coming soon” or a static “Top 10” mock).
  3. **Achievements** — placeholder (e.g. “Coming soon” or 2–3 mock badges).

**Done when:** Rewards page has three distinct sections; when not connected, show “Connect wallet to see payouts” for the Payouts section.

---

### Step P5.2 — Payouts (source of truth)

- [ ] **Option A (no backend):** For local/dev, payouts can be read from chain events (Escrow `ResultSubmitted` or similar) or from a static list. If reading from chain, use the escrow contract and filter by wallet (e.g. past events). Show columns: Match ID (short), placement, amount (USDC), date (block timestamp if available).
- [ ] **Option B (backend):** Add `GET /player/payouts?wallet=0x...` on the game server that returns last N payouts (e.g. from DB or from indexing contract events). Frontend calls this and displays the table.
- [ ] Implement at least Option A or B; document in a one-line comment which one is used. If neither is feasible in the current codebase, show “Payout history will appear here after you complete matches” and a link to Play.

**Done when:** Payouts section shows either real data (chain or API) or a clear empty-state message with link to Play.

---

### Step P5.3 — Leaderboard and achievements placeholders

- [ ] **Leaderboard:** Section title “Leaderboard”. Content: “Coming soon” or a small table with mock data (e.g. “Rank – Wallet – Wins” with 3–5 fake rows). No backend required for placeholder.
- [ ] **Achievements:** Section title “Achievements”. Content: “Coming soon” or 2–3 mock achievement cards (e.g. “First Win”, “10 Matches”, “Bronze Tier”) with icons or labels. No backend required.

**Done when:** Leaderboard and Achievements sections exist and look intentional; no broken links or errors.

---

**Phase P5 sign-off:** Rewards page has Payouts (data or empty state), Leaderboard placeholder, and Achievements placeholder. _________________ Date: __________

---

# Phase P6 — Polish (Nav, Responsive, A11y, Errors)

**Goal:** Consistent navigation, mobile-friendly layout, basic accessibility, and graceful error handling.

---

### Step P6.1 — Navigation and active state

- [ ] In Layout, ensure nav links point to: `/` (Dashboard), `/play` (Play), `/rewards` (Rewards), `/wallet` (Wallet), `/account` (Account).
- [ ] Indicate the current route (e.g. `NavLink` with `className` for active, or bold/highlight the current page name). Use `useLocation()` or `<NavLink>` from react-router-dom.

**Done when:** Current page is visually indicated in the nav; all links work.

---

### Step P6.2 — Responsive layout

- [ ] Use CSS (flexbox/grid) so that:
  - Header: on small screens, nav can wrap or collapse into a hamburger menu (simple implementation: stacked nav links below logo).
  - Main content: max-width and padding so it doesn’t stretch too wide on large screens; cards stack on small screens.
- [ ] Test at 360px width and 1280px width; no horizontal scroll unless intentional (e.g. code block).

**Done when:** Layout and Dashboard/Play/Wallet/Rewards/Account pages are usable on narrow and wide viewports.

---

### Step P6.3 — Error boundary

- [ ] Add a React Error Boundary (class component or a small library) that wraps the main route content (e.g. inside Layout). On error: show a friendly message (“Something went wrong”) and a “Reload” or “Go to Dashboard” button.
- [ ] File: e.g. `arena-race/webapp/src/components/ErrorBoundary.tsx`.

**Done when:** Throwing an error in any page shows the boundary UI instead of a blank screen; user can recover.

---

### Step P6.4 — Accessibility basics

- [ ] Ensure main landmarks: `<header>`, `<main>`, `<nav>`, `<footer>` where appropriate.
- [ ] Buttons and links have clear, focusable states (visible outline or border on `:focus-visible` using design tokens).
- [ ] Page titles: set `<title>` per route (e.g. “Dashboard – Arena Race”, “Play – Arena Race”) via React Helmet or `document.title` in a `useEffect` in each page.

**Done when:** Landmarks are present; focus is visible; document title changes with the route.

---

**Phase P6 sign-off:** Nav shows active state; layout is responsive; Error Boundary and basic a11y are in place. _________________ Date: __________

---

# Optional extensions (post-MVP)

- **Backend:** `GET /player/stats?wallet=0x...`, `GET /player/matches?wallet=0x...`, `GET /player/payouts?wallet=0x...` so Dashboard and Rewards use real data.
- **Leaderboard:** Persist match results by wallet in game server; expose `GET /leaderboard?limit=50`; wire Rewards leaderboard section to it.
- **Achievements:** Define achievement rules (e.g. “first win”, “10 matches”); compute in backend or client from match history; show in Rewards.
- **Theming:** Toggle light/dark using the same design tokens (swap variable values in `:root`).
- **WalletConnect:** Add WalletConnect or other wallet providers alongside MetaMask in WalletContext.

---

# Execution checklist (agent)

1. Start with Phase P1; complete every step and sign off before P2. **Within P1, do step P1.5 before P1.4** (extract Play page first, then add router).
2. After each step, verify “Done when” (e.g. run `npm run build`, run app, click through flows).
3. Do not change contract or game-server behavior unless a step explicitly asks for a new API (e.g. P5.2 Option B).
4. Keep existing game flow at `/play` working after every change (queue → match → enter → play → result).
5. Use the repo’s existing stack: React, Vite, TypeScript, ethers, `deployed-local.json`; add only `react-router-dom` and any small libs (e.g. for Error Boundary or document title) as needed.
6. Commit after each phase with a message like: `feat(webapp): P1 – routing, layout, design tokens`.

---

## Verification summary (is this plan ready for an agent?)

| Criterion | Status |
|-----------|--------|
| Phases and steps are ordered and dependency-clear | Yes; P1.5 before P1.4 called out explicitly. |
| Every step has a concrete "Done when" | Yes. |
| File paths are explicit and repo-root-relative | Yes (`arena-race/webapp/src/...`). |
| Optional choices have a default for the agent | Yes (For autonomous agents: P2.4 Option A, P5.2 Option A or empty state). |
| Verification command is specified | Yes (`npm run build` from `arena-race/webapp`; optional manual check). |
| Local-only assumptions and ports are documented | Yes (Local development and testing: 8545, 3000, 5173, deployed-local.json). |
| No production or external APIs required | Yes; config from local JSON, game server localhost. |
| Contract/game-server unchanged unless stated | Yes (checklist item 3). |

---

**End of document.**
