# CLAUDE.md — Painel de Investimentos (FEFEL)

## Project Overview

A zero-dependency, client-side SPA for tracking a Brazilian stock portfolio on B3/Bovespa. All data persists in `localStorage`. Two external APIs are called directly from the browser:
- **brapi.dev** — real-time B3 stock quotes and fundamentals
- **Anthropic Claude API** — AI-generated daily financial market briefing

**Deployed as static files on Vercel** (see `vercel.json`).

---

## Repository Structure

```
/
├── index.html      # Full application: HTML structure + all embedded CSS
├── app.js          # All JavaScript logic (~295 lines)
└── vercel.json     # Vercel SPA routing rewrite config
```

No build system, no package manager, no transpilation — the browser runs the files directly.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Markup | HTML5 |
| Styling | CSS3, embedded in `<style>` inside `index.html` |
| Logic | Vanilla JavaScript (ES6+), single `app.js` file |
| Fonts | IBM Plex Mono (monospace), Sora (UI) — loaded from Google Fonts |
| State | `localStorage` under key `painel_v2` |
| Deployment | Vercel static hosting |

---

## Application Architecture

### State Management

All state lives in a single global `state` object:

```js
let state = loadState() || { apiKey: '', stocks: [], setupDone: false };
```

Shape of a stock entry in `state.stocks`:
```js
{
  id: Number,        // auto-incremented from NID (starts at 100)
  ticker: String,    // e.g. "PETR4"
  name: String,      // company name (from API or user input)
  qty: Number,       // quantity owned
  pm: Number,        // preço médio — average cost per share
  price: Number,     // current market price (null until fetched)
  chg: Number,       // today's % change (null until fetched)
  target: Number,    // analyst target price (null if unavailable)
  nameEdited: Boolean // true if user manually edited the name
}
```

State is saved to `localStorage` via `saveState()` on every mutation. The pattern for mutations is always:
```js
// mutate state
saveState();
renderAll();
```

### UI Sections (Tabs)

Three tabs managed by `switchTab(name)`:
- **Carteira** — portfolio overview with summary cards, pie chart, positions table
- **Jornal** — AI-generated daily market briefing
- **Operacao** — log buy/sell trades (updates `pm` and `qty` automatically)

### Key Functions

| Function | Purpose |
|----------|---------|
| `loadState()` / `saveState()` | Read/write state to `localStorage` |
| `renderAll()` | Re-renders cards, pie chart, and table |
| `renderCards()` | Summary metrics (total invested, current value, P&L) |
| `renderPie()` | SVG donut pie chart of portfolio allocation |
| `renderTable()` | Detailed positions table with per-stock metrics |
| `fetchAllPrices()` | Calls brapi.dev for all stocks sequentially |
| `fetchOne(stock)` | Fetches price/fundamentals for a single stock |
| `fetchJournal()` | Calls Claude API to generate a market briefing |
| `renderJournal(text)` | Parses and renders the Claude API text response into sections |
| `confirmOp()` | Processes a buy/sell trade, recalculates `pm` |
| `finishSetup()` | Completes the initial portfolio setup screen |
| `showToast(msg)` | Shows a non-intrusive notification for 3.5s |

### Utility Aliases

```js
const f2 = v => ...         // Format number as BRL with 2 decimal places
const fp = v => ...         // Format as ± percentage string
const $ = id => document.getElementById(id);
const abs = Math.abs;
```

### CSS Variables (defined in `:root`)

```css
--bg: #07111f       /* darkest background */
--bg2: #0c1929      /* card/panel background */
--bg3: #0e1e2e      /* slightly lighter panels */
--border: #1a2840   /* border color */
--gold: #f0b429     /* primary accent */
--green: #06d6a0    /* positive / buy */
--red: #ff6b6b      /* negative / sell */
--text: #cdd6e0     /* primary text */
--muted: #556070    /* secondary/muted text */
```

### Color Palette (for charts and stocks)

```js
const COLORS = ['#f0b429','#00d4ff','#a78bfa','#06d6a0','#ff6b6b','#fb923c','#f472b6','#34d399'];
```

Assigned per-stock by `index % COLORS.length`.

---

## External API Integration

### brapi.dev (Stock Quotes)

- **Endpoint**: `https://brapi.dev/api/quote/{TICKER}?token={API_KEY}&fundamental=true`
- **Auth**: User's personal API key stored in `state.apiKey`, saved to localStorage
- **Used fields**: `regularMarketPrice`, `regularMarketChangePercent`, `targetMeanPrice`, `shortName`
- **Key**: Free tier available at brapi.dev

### Anthropic Claude API (Market Journal)

- **Endpoint**: `https://api.anthropic.com/v1/messages`
- **Model**: `claude-sonnet-4-20250514`
- **Tool**: `web_search_20250305` (web search tool for current news)
- **Auth**: Hardcoded in the `fetch` call — **no Anthropic API key is stored in state or DOM**
- **Note**: The `fetchJournal()` call does NOT pass an `Authorization` header or `x-api-key`. This call will fail in production unless a proxy or Vercel edge function is added.

### Journal Parsing

The journal response is split into sections using all-caps keywords:
- `MERCADO HOJE`, `CENÁRIO BRASIL`, `CENÁRIO GLOBAL`
- Each stock ticker (e.g. `PETR4`) is also a section header

Sections are rendered as styled cards. Company sections get a special layout with a chip badge.

---

## Development Workflow

### Running Locally

No build step required. Simply serve the files with any static server:

```bash
npx serve .
# or
python3 -m http.server 8080
# or open index.html directly in a browser
```

### Deploying

Push to the repository. Vercel auto-deploys. The `vercel.json` rewrites all routes to `index.html` for SPA behavior.

### Making Changes

1. Edit `index.html` for markup/CSS changes
2. Edit `app.js` for logic changes
3. Test in browser (no compilation needed)
4. Commit and push

---

## Conventions & Patterns

### Naming

- Global state constants in SCREAMING_SNAKE_CASE: `SK`, `NID`, `COLORS`
- Short aliases for frequent operations: `$()`, `f2()`, `fp()`, `abs`
- Functions use camelCase with descriptive names: `fetchAllPrices`, `renderTable`, `openEditModal`
- IDs in HTML use kebab-case: `api-key-input`, `stocks-body`, `btn-update`
- Portuguese is used in UI text, toast messages, comments, and error strings

### Code Style

- Semicolons used throughout
- Short, dense lines are intentional — readability is sacrificed for compactness
- Inline event handlers in HTML (`onclick="..."`) rather than `addEventListener`
- State mutations always followed by `saveState(); renderAll();`
- No modules or imports — everything is global scope
- `NID` is initialized to 100 and incremented for each new stock ID

### Error Handling

- `try/catch` around all `localStorage` operations
- `try/catch` around all `fetch` calls — failures shown as toast messages
- Null checks on API response fields before assignment
- Fallback display value `'—'` when price data is unavailable

---

## Known Issues / Limitations

1. **Claude API CORS**: The `fetchJournal()` function calls the Anthropic API directly from the browser without an `Authorization` header — this will be blocked by CORS in production. A proxy or serverless function is needed.
2. **Sequential price fetching**: `fetchAllPrices()` awaits each stock one at a time — slow for large portfolios. Could use `Promise.all()`.
3. **No validation on ticker format**: Any string is accepted as a ticker.
4. **No tests**: There are no automated tests of any kind.
5. **`NID` not persisted**: On page reload, `NID` resets to 100. If IDs are reused this could cause collisions, but in practice stocks are identified by ticker in `confirmOp()`.
6. **CSS variable typos**: Some references in `app.js` use `var(–green)` (en-dash) instead of `var(--green)` (double hyphen). These fall back silently.

---

## File Reference

### `index.html`

- Lines 1–98: `<head>` with meta tags and all embedded CSS
- Lines 100–112: Setup screen markup (`#setup-screen`)
- Lines 113–191: Main app markup (`#main-content`) with tabs, cards, table, etc.
- Lines 193–205: Add/Edit stock modal overlay
- Line 206: Toast notification element
- Line 207: `<script src="app.js">` — loads all logic

### `app.js`

- Lines 1–15: Constants, state initialization, utilities
- Lines 17–29: `DOMContentLoaded` init
- Lines 31–80: Setup screen logic
- Lines 82–91: API key save
- Lines 93–100: Tab switching
- Lines 102–130: Price fetching (brapi.dev)
- Lines 132–186: Rendering (cards, pie, table, remove)
- Lines 188–210: Modal (add/edit stock)
- Lines 212–259: Trade operations (buy/sell)
- Lines 261–288: Journal generation and rendering (Claude API)
- Lines 290–295: Reset function

### `vercel.json`

Configures Vercel to rewrite all requests to `index.html` for SPA routing.
