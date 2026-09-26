import { HP, chk, div, type Dec } from '../decimal';
import { CalcError } from '../errors';
import { rootClosestToZero } from '../solver';
import type { State } from '../state';
import { numVar, settingVar } from './helpers';
import type { WorksheetDef } from './types';

export type TvmVar = 'N' | 'IY' | 'PV' | 'PMT' | 'FV';
export const TVM_VARS: TvmVar[] = ['N', 'IY', 'PV', 'PMT', 'FV'];
export const TVM_LABEL: Record<TvmVar, string> = { N: 'N', IY: 'I/Y', PV: 'PV', PMT: 'PMT', FV: 'FV' };

interface TvmHP {
  N: HP; IY: HP; PV: HP; PMT: HP; FV: HP; PY: HP; CY: HP; k: number;
}

export function tvmValues(s: State): TvmHP {
  const t = s.ws.tvm;
  return {
    N: new HP(t.N), IY: new HP(t.IY), PV: new HP(t.PV), PMT: new HP(t.PMT), FV: new HP(t.FV),
    PY: new HP(t.PY), CY: new HP(t.CY), k: t.bgn ? 1 : 0,
  };
}

/** Periodic rate: i = (1 + I/Y ÷ (100 × C/Y))^(C/Y ÷ P/Y) − 1. */
export function periodicRate(iy: HP, py: HP, cy: HP): HP {
  const base = new HP(1).plus(div(iy, cy.times(100)));
  if (base.lte(0)) throw new CalcError(5);
  return chk(base.pow(div(cy, py)).minus(1));
}

/** Inverse of periodicRate: I/Y = 100 × C/Y × ((1 + i)^(P/Y ÷ C/Y) − 1). */
export function annualRate(i: HP, py: HP, cy: HP): HP {
  return chk(new HP(1).plus(i).pow(div(py, cy)).minus(1).times(cy).times(100));
}

/** Residual of the TVM equation at periodic rate i. */
function residual(t: TvmHP, i: HP): HP {
  if (i.isZero()) return t.PV.plus(t.PMT.times(t.N)).plus(t.FV);
  const g = new HP(1).plus(i.times(t.k));
  const v = new HP(1).plus(i).pow(t.N.neg());
  const a = new HP(1).minus(v).div(i);
  return t.PV.plus(g.times(t.PMT).times(a)).plus(t.FV.times(v));
}

function residualFloat(t: TvmHP, i: number): number {
  const N = t.N.toNumber(), PV = t.PV.toNumber(), PMT = t.PMT.toNumber(), FV = t.FV.toNumber();
  if (i === 0) return PV + PMT * N + FV;
  const v = Math.pow(1 + i, -N);
  return PV + (1 + i * t.k) * PMT * ((1 - v) / i) + FV * v;
}

/** Guidebook Appendix TVM formulas (standard annuity equation). */
export function computeTvm(s: State, which: TvmVar): HP {
  const t = tvmValues(s);
  if (which === 'IY') return computeIY(t);
  const i = periodicRate(t.IY, t.PY, t.CY);
  const g = new HP(1).plus(i.times(t.k));
  if (i.isZero()) {
    switch (which) {
      case 'N': return div(t.PV.plus(t.FV), t.PMT).neg();
      case 'PV': return t.PMT.times(t.N).plus(t.FV).neg();
      case 'PMT': return div(t.PV.plus(t.FV), t.N).neg();
      case 'FV': return t.PV.plus(t.PMT.times(t.N)).neg();
    }
  }
  if (which === 'N') {
    const num = g.times(t.PMT).minus(t.FV.times(i));
    const den = g.times(t.PMT).plus(t.PV.times(i));
    const arg = div(num, den);
    if (arg.lte(0)) throw new CalcError(5);
    return div(arg.ln(), new HP(1).plus(i).ln());
  }
  const v = chk(new HP(1).plus(i).pow(t.N.neg()));
  const a = div(new HP(1).minus(v), i);
  switch (which) {
    case 'PV': return g.times(t.PMT).times(a).plus(t.FV.times(v)).neg();
    case 'FV': return div(t.PV.plus(g.times(t.PMT).times(a)), v).neg();
    case 'PMT': return div(t.PV.plus(t.FV.times(v)), g.times(a)).neg();
  }
}

/** I/Y by iteration. Error 5 when PV, N×PMT and FV share a sign (no solution). */
function computeIY(t: TvmHP): HP {
  const signs = [t.PV, t.N.times(t.PMT), t.FV].filter((x) => !x.isZero()).map((x) => x.isNegative());
  if (signs.length === 0 || signs.every((x) => x === signs[0])) throw new CalcError(5);
  const i = rootClosestToZero((r) => residualFloat(t, r), (r) => residual(t, r));
  return annualRate(i, t.PY, t.CY);
}

function positive(x: Dec): void {
  if (x.lte(0)) throw new CalcError(4);
}

export const pyWorksheet: WorksheetDef = {
  id: 'py',
  vars: () => [
    numVar('tvm', 'PY', 'P/Y', 'enter', {
      validate: positive,
      // Guidebook: setting P/Y also sets C/Y.
      afterEnter: (s) => { s.ws.tvm.CY = s.ws.tvm.PY; },
    }),
    numVar('tvm', 'CY', 'C/Y', 'enter', { validate: positive }),
  ],
  clear: (s) => {
    s.ws.tvm.PY = '1';
    s.ws.tvm.CY = '1';
  },
};

export const bgnWorksheet: WorksheetDef = {
  id: 'bgn',
  vars: (s) => [
    settingVar<0 | 1>(s, 'mode', [0, 1],
      (st) => (st.ws.tvm.bgn ? 1 : 0),
      (st, v) => { st.ws.tvm.bgn = v === 1; },
      (v) => (v ? 'BGN' : 'END')),
  ],
  clear: (s) => { s.ws.tvm.bgn = false; },
};

export function clearTvm(s: State): void {
  for (const k of TVM_VARS) s.ws.tvm[k] = '0';
  s.marks.tvm = {};
}
