# le-calculator

A single-page web financial calculator that aims to behave keystroke-for-keystroke
like the TI BA II Plus Professional, with an original look (no TI names, logos or
case design).

**Status:** the engine, all worksheets, the UI, persistence and offline support
are built and tested. Exact emulation is **not** verified yet: the TI guidebook
could not be read while building, so every behavior the PRD doesn't spell out
is marked `FLAG` in the code and listed in [docs/OPEN_ITEMS.md](docs/OPEN_ITEMS.md).

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Vitest: engine, golden table, every error code
npm run test:e2e   # Playwright: keypad/keyboard flows on desktop + mobile
npm run build      # static build in dist/ (PWA, works offline)
```

## Architecture

```
UI (React)  ──key──▶  EngineHost ──▶ Web Worker ──▶ press(state, key) → state
     ▲                    │                              │
     └──── display(state) ◀── localStorage (every key) ◀─┘
```

- `src/engine/` — pure TypeScript with no UI dependency.
  - `press.ts` — the single entry point `press(state, key)`: 2ND, Chn/AOS math,
    memory, constant K, CPT, worksheet navigation, errors, reset.
  - `display.ts` — the only path from state to the screen (label, value,
    indicators, entered/computed marks).
  - `decimal.ts` — decimal.js at 13 significant digits, range check (Error 1).
  - `format.ts` — 10-digit display rounding, DEC, separators, scientific notation.
  - `worksheets/` — one data definition per worksheet (variables, kinds, defaults,
    CLR WORK) plus its formulas: TVM (P/Y, BGN), AMORT, CF/NPV/IRR, BOND, DEPR,
    DATA/STAT, Δ%, ICONV, DATE, PROFIT, BRKEVN, MEM, FORMAT.
  - `solver.ts` — bracket scan and Illinois refinement for I/Y, IRR, YLD.
  - `script.ts` — keystroke scripts such as `P/Y 12 ENTER QUIT 360 N`, used by
    the tests and the in-app replay panel.
- `src/ui/` — React front end. `engineHost.ts` runs the engine in a Web Worker so
  ON|OFF can cancel a long solve (Error 8), and saves state after every key.

## Keyboard

Digits, `.`, `+ - * /`, `( )`, Enter for `=`, Backspace for →, Esc for CE|C,
↑/↓ for worksheet arrows, and Shift tapped alone for 2ND. Press `?` in the app
for the full list.
