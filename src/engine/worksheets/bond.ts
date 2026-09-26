import { HP, chk, div, type Dec } from '../decimal';
import { addMonths, days360, inRange, isMonthEnd, parseDateEntry } from '../dates';
import { CalcError } from '../errors';
import { refine, rateGrid } from '../solver';
import { defaultWs, type State } from '../state';
import { numVar, settingVar } from './helpers';
import type { VarDef, WorksheetDef } from './types';

function dateVar(id: 'SDT' | 'RDT'): VarDef {
  return {
    id, label: id, kind: 'enter', type: 'date',
    get: (s) => s.ws.bond[id],
    enter: (s, x) => {
      const days = parseDateEntry(x, s.fmt.date);
      if (!inRange(days)) throw new CalcError(6);
      s.ws.bond[id] = days;
    },
  };
}

/**
 * PRD: "Bond RV, CPN, or PRI ≤ 0" → Error 4.
 * FLAG (PRD Open items → comparison symbols): the ≤ bound is taken literally
 * and checked on ENTER, so a zero-coupon bond cannot be entered.
 */
function positive(x: Dec): void {
  if (x.lte(0)) throw new CalcError(4);
}

interface Setup {
  M: HP; E: HP; A: HP; DSC: HP; DSR: HP; N: number; C: HP; RV: HP;
}

/**
 * Coupon schedule. RDT is assumed to be a coupon date (PRD).
 * FLAG (not in PRD): when RDT is a month end, coupon dates are month ends.
 */
function setup(s: State): Setup {
  const b = s.ws.bond;
  if (!inRange(b.SDT) || !inRange(b.RDT) || b.RDT <= b.SDT) throw new CalcError(6);
  const months = 12 / b.freq;
  const eom = isMonthEnd(b.RDT);
  let k = 0;
  // step back from RDT until the coupon date is on or before SDT
  while (addMonths(b.RDT, -months * (k + 1), eom) > b.SDT) k++;
  const ncd = addMonths(b.RDT, -months * k, eom);
  const pcd = addMonths(b.RDT, -months * (k + 1), eom);
  const M = new HP(b.freq);
  let E: HP, A: HP, DSC: HP, DSR: HP;
  if (b.basis === 'ACT') {
    E = new HP(ncd - pcd);
    A = new HP(b.SDT - pcd);
    DSC = new HP(ncd - b.SDT);
    DSR = new HP(b.RDT - b.SDT);
  } else {
    E = new HP(360).div(M);
    A = new HP(days360(pcd, b.SDT));
    DSC = E.minus(A);
    DSR = new HP(days360(b.SDT, b.RDT));
  }
  return { M, E, A, DSC, DSR, N: k + 1, C: new HP(b.CPN), RV: new HP(b.RV) };
}

/** Clean price at annual yield y (decimal), guidebook Appendix bond formulas. */
function priceAt(u: Setup, y: HP): HP {
  const cpn = u.C.div(u.M);
  const accrued = cpn.times(u.A).div(u.E);
  const base = new HP(1).plus(y.div(u.M));
  if (base.lte(0)) throw new CalcError(5);
  if (u.N === 1) {
    return chk(div(u.RV.plus(cpn), new HP(1).plus(u.DSR.div(u.E).times(y.div(u.M)))).minus(accrued));
  }
  const frac = u.DSC.div(u.E);
  let p = u.RV.div(base.pow(new HP(u.N - 1).plus(frac)));
  for (let k = 1; k <= u.N; k++) p = p.plus(cpn.div(base.pow(new HP(k - 1).plus(frac))));
  return chk(p.minus(accrued));
}

function priceFloat(u: Setup, r: number): number {
  const M = u.M.toNumber();
  const cpn = u.C.toNumber() / M;
  const A = u.A.toNumber(), E = u.E.toNumber();
  const accrued = (cpn * A) / E;
  if (u.N === 1) return (u.RV.toNumber() + cpn) / (1 + (u.DSR.toNumber() / E) * r) - accrued;
  const frac = u.DSC.toNumber() / E;
  const base = 1 + r;
  let p = u.RV.toNumber() / Math.pow(base, u.N - 1 + frac);
  for (let k = 1; k <= u.N; k++) p += cpn / Math.pow(base, k - 1 + frac);
  return p - accrued;
}

export function computePRI(s: State): HP {
  return priceAt(setup(s), new HP(s.ws.bond.YLD).div(100));
}

export function computeYLD(s: State): HP {
  const u = setup(s);
  const target = new HP(s.ws.bond.PRI);
  if (u.N === 1) {
    const cpn = u.C.div(u.M);
    const dirty = target.plus(cpn.times(u.A).div(u.E));
    return div(u.RV.plus(cpn).minus(dirty), dirty).times(div(u.M.times(u.E), u.DSR)).times(100);
  }
  const tf = target.toNumber();
  const grid = rateGrid();
  // price is decreasing in yield: find the bracket, then refine in high precision
  let prev = grid[0];
  let fPrev = priceFloat(u, prev) - tf;
  for (let k = 1; k < grid.length; k++) {
    const r = grid[k];
    const f = priceFloat(u, r) - tf;
    if (Number.isFinite(fPrev) && Number.isFinite(f) && Math.sign(f) !== Math.sign(fPrev)) {
      const root = refine((x) => priceAt(u, x.times(u.M)).minus(target), prev, r);
      return root.times(u.M).times(100);
    }
    prev = r;
    fPrev = f;
  }
  throw new CalcError(7);
}

export function computeAI(s: State): HP {
  const u = setup(s);
  // FLAG (guidebook formula not available): AI per 100 of par = (CPN/M)·(A/E).
  return u.C.div(u.M).times(u.A).div(u.E);
}

/**
 * Modified duration (Professional): −(dPRI/dY) ÷ PRI, with Y as a decimal.
 * FLAG (guidebook formula not available): measuring against the clean price
 * reproduces the PRD golden DUR= 1.44; measuring against the dirty price
 * (textbook modified duration) gives 1.39 for the same bond.
 */
export function computeDUR(s: State): HP {
  const u = setup(s);
  const y = new HP(s.ws.bond.YLD).div(100);
  const base = new HP(1).plus(y.div(u.M));
  if (base.lte(0)) throw new CalcError(5);
  const price = priceAt(u, y);
  const cpn = u.C.div(u.M);
  let slope: HP; // −dPRI/dY
  if (u.N === 1) {
    const f = u.DSR.div(u.E);
    const den = new HP(1).plus(f.times(y.div(u.M)));
    slope = u.RV.plus(cpn).times(f.div(u.M)).div(den.times(den));
  } else {
    const frac = u.DSC.div(u.E);
    slope = new HP(0);
    for (let k = 1; k <= u.N; k++) {
      const t = new HP(k - 1).plus(frac);
      const cf = k === u.N ? cpn.plus(u.RV) : cpn;
      slope = slope.plus(cf.times(t).div(base.pow(t.plus(1))));
    }
    slope = slope.div(u.M);
  }
  return div(slope, price);
}

export const bondWorksheet: WorksheetDef = {
  id: 'bond',
  vars: (s) => [
    dateVar('SDT'),
    numVar('bond', 'CPN', 'CPN', 'enter', { validate: positive }),
    dateVar('RDT'),
    numVar('bond', 'RV', 'RV', 'enter', { validate: positive }),
    settingVar<'ACT' | '360'>(s, 'basis', ['ACT', '360'], (st) => st.ws.bond.basis, (st, v) => { st.ws.bond.basis = v; }),
    settingVar<1 | 2>(s, 'freq', [2, 1], (st) => st.ws.bond.freq, (st, v) => { st.ws.bond.freq = v; }, (v) => `${v}/Y`),
    numVar('bond', 'YLD', 'YLD', 'both', { compute: computeYLD }),
    numVar('bond', 'PRI', 'PRI', 'both', { compute: computePRI, validate: positive }),
    numVar('bond', 'AI', 'AI', 'auto', { compute: computeAI }),
    numVar('bond', 'DUR', 'DUR', 'auto', { compute: computeDUR }),
  ],
  clear: (s) => {
    s.ws.bond = defaultWs().bond;
  },
};
