# Open items

The PRD says the TI BA II Plus Professional guidebook is the source of truth,
and that any behavior it doesn't specify should be logged here and flagged in
code. **The guidebook PDF could not be read while building this version**:
the network policy of the build environment blocked `education.ti.com`. So
every formula and behavior not stated in the PRD itself is a reconstruction and
is marked `FLAG` in the source (`grep -rn FLAG src`). Each item below must be
checked against the PDF or a physical unit before claiming exact emulation.

## From the PRD (still open)

- [ ] **Key names and positions** — `src/engine/keys.ts` (`KEY_LAYOUT`,
  `SECOND_FNS`). The layout and which key carries which 2ND function are best
  effort, not taken from the guidebook's key diagram.
- [ ] **Comparison symbols in the Error 4 table.** Implemented literally from
  the PRD. In particular Bond `CPN ≤ 0` is Error 4, so a zero-coupon bond
  can't be entered (`bond.ts`).
- [ ] **Guidebook typos.** The bond golden test uses 6-12-2006 → 12-31-2007
  (the dates the PRD says the keystrokes use). With these dates the test
  reproduces PRI 98.56, AI 3.15 and DUR 1.44.
- [ ] **Cash Flow defaults.** All zeros; 2ND CLR WORK in CF, NPV or IRR
  clears the whole cash-flow data set.
- [ ] **% Change #PD default.** Set to 1.
- [ ] **Solver tolerance and iteration cap.** `SOLVER_MAX_ITERATIONS = 200`,
  `SOLVER_TOLERANCE = 1e-22` relative (`solver.ts`).
- [ ] **Scientific notation, negative sign, cursor.** Mantissa up to 7
  decimals (DEC-limited), a space, then the exponent (`1.23 12`). Values
  ≥ 1E10 or < 1E-9 switch to scientific notation. The minus sign is a leading
  `-`. Keyed digits show as typed (`5`, `5.`), with separators.
- [ ] **IRR search.** No starting guess is stated. We scan a fixed grid of
  periodic rates from −99.99% to 1,000,000% for sign changes, refine each
  bracket (Illinois method), and return the root closest to zero.

## New: contradictions found while testing

- [ ] **Cash-flow golden row doesn't reproduce.** For CFo −7,000; 3,000×1;
  5,000×4; 4,000×1; I = 20, the PRD expects NPV 7,266.44 and IRR 52.71. A
  separate hand calculation (Python, per-period discounting) gives
  **NPV 7,625.99 and IRR 55.63**, the same as the engine. A search over
  nearby flow patterns found no plausible setup that gives both PRD numbers.
  The PRD row is kept as an expected-failure test
  (`tests/golden.test.ts`). Re-derive the setup from the guidebook.
- [ ] **Amortization rounding.** The PRD says "12-decimal rounding of
  interest". Rounding to 12 decimals alone gives BAL 118,928.64. The golden
  118,928.63 comes out only when each period's interest is rounded to 12
  decimals and then to the display decimals, so that is what is implemented.
- [ ] **Bond duration.** Textbook modified duration (against the dirty price)
  gives 1.39 for the golden bond. The PRD's 1.44 comes out when DUR =
  −(dPRI/dY) ÷ PRI (against the clean price), so that is what is implemented.

## New: behaviors the PRD doesn't specify (our choices)

Standard mode
- [ ] While an error shows, only CE|C and ON|OFF act. The first CE|C
  clears the error but keeps pending math; a second CE|C clears it.
- [ ] A second operator key in a row replaces the first.
- [ ] `%`: x ÷ 100. With a pending + or −, it becomes that percent of the left
  operand (add-on / discount).
- [ ] Constant K add-on / discount form: `n ± 2ND K c % =`.
- [ ] INV modifies SIN/COS/TAN (and HYP), LN and eˣ only. INV yˣ (roots) is
  not implemented.
- [ ] 2ND on a key with no 2ND function acts as the primary key.
- [ ] 0^0 = 1. nCr and nPr give Error 2 for non-integers or r > n.
  Out-of-domain inverse trig is Error 2. tan(±90°) is Error 1.
- [ ] RAND uses mulberry32 (TI's generator is undocumented). `STO RAND`
  seeds it from the displayed value.
- [ ] Results smaller than 1E-99 flush to 0.
- [ ] Worksheet formulas run at 34 digits; results are stored at 13.
- [ ] Display rounding goes first to 10 significant digits (PRD rule), then to
  the DEC setting.

TVM and worksheets
- [ ] Storing with N/I/Y/PV/PMT/FV clears pending math.
- [ ] ENTER stores the displayed value and discards pending math.
- [ ] Opening a worksheet starts at its first variable. Scrolling wraps
  around at both ends.
- [ ] In a worksheet, CE|C returns to the variable's stored value.
- [ ] ON|OFF also returns to standard mode.
- [ ] The reset prompt reads `RST ?`.
- [ ] Entered and computed marks are drawn as ✓ and ✱.
- [ ] Amortization: starting balance is PV rounded to display decimals. In BGN
  mode the first payment carries no interest. Non-integer P1/P2 is Error 4.
- [ ] Cash flow: INS at 32 flows is ignored. PB/DPB interpolate within the
  period group where the cumulative flow crosses zero; CFo ≥ 0 gives 0. MOD
  discounts negative flows at I and compounds positive flows at RI.
- [ ] Bond: when RDT is a month end, coupon dates are month ends.
  AI = (CPN/M)·(A/E) per 100 par. For one period to redemption, the SIA
  single-period formulas are used.
- [ ] Two-digit years: 80–99 → 19xx, 00–79 → 20xx. 30/360 day count:
  D1 = 31 → 30; D2 = 31 and D1 ≥ 30 → 30; no February rule.
- [ ] Date: a fractional DBD is truncated when computing a date.
- [ ] Depreciation: the year the life ends takes the remaining depreciable
  value. DBX and DBF switch to straight line when that is larger. DBF
  coefficients by life are 1.25 / 1.75 / 2.25. SLF prorates the first year
  from DT1 on a 30/360 basis; its DT1 default is 12-31-1990. A non-integer
  LIF outside SL/SLF is Error 2. A non-integer YR is Error 4.
- [ ] Statistics: for Ln, EXP and PWR, all statistics are reported on the
  transformed values. n < 2 for Sx/Sy is Error 1.
- [ ] %Change, ICONV: a non-positive base for a log or fractional power is
  Error 5.

## Acceptance criteria status

- [ ] All guidebook examples pass as automated tests. **Not done**: only the
  PRD golden table is encoded, because the guidebook couldn't be read.
- [x] Every error code has at least one test that triggers it
  (`tests/errors.test.ts`).
- [x] Formats change display only; stored values stay at 13 digits.
- [x] Reload restores full state, including pending math (Vitest + Playwright).
- [x] Iterative solves can be canceled and show Error 8 (the worker host is
  unit-tested with a worker that never answers).
- [ ] Side-by-side check on a physical unit (50 random sequences). Needs
  hardware.
