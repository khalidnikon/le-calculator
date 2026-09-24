import Decimal from 'decimal.js';
import { HP, ser, type Dec } from '../decimal';
import { CalcError } from '../errors';
import { displayedValue } from '../format';
import type { State } from '../state';
import { numVar } from './helpers';
import { periodicRate, tvmValues } from './tvm';
import type { VarDef, WorksheetDef } from './types';

function validP(x: Dec): void {
  // FLAG (not in PRD): non-integer P1/P2 also give Error 4.
  if (!x.isInteger() || x.lt(1) || x.gt(9999)) throw new CalcError(4);
}

/** Round to the display decimals (amortization values are stored rounded). */
function rnd(x: Decimal.Value, s: State): HP {
  return new HP(displayedValue(new HP(x).toSignificantDigits(13).toString(), s.fmt));
}

/** Interest is rounded to 12 decimal places each period (PRD). */
function rnd12(x: HP): HP {
  return x.toDecimalPlaces(12, Decimal.ROUND_HALF_UP);
}

/**
 * BAL, PRN, INT for payments P1..P2.
 * PRD: uses PMT rounded to the display decimals; balance iterates per payment
 * with 12-decimal rounding of interest.
 * FLAG (guidebook formula not available): each period's interest is rounded
 * to 12 decimals and then to the display decimals — only this variant
 * reproduces the PRD golden BAL= 118,928.63 (12-decimal rounding alone gives
 * 118,928.64). The starting balance is PV rounded to the display decimals, and
 * in BGN mode the first payment carries no interest.
 */
export function computeAmort(s: State): void {
  const a = s.ws.amort;
  const p1 = Number(a.P1);
  const p2 = Number(a.P2);
  if (p2 < p1) throw new CalcError(2);
  const t = tvmValues(s);
  const i = periodicRate(t.IY, t.PY, t.CY);
  const pmt = rnd(t.PMT, s);
  let bal = rnd(t.PV, s);
  let intSum = new HP(0);
  let prnSum = new HP(0);
  for (let j = 1; j <= p2; j++) {
    const int = t.k === 1 && j === 1 ? new HP(0) : rnd(rnd12(i.times(bal).neg()), s);
    const prn = pmt.minus(int);
    bal = bal.plus(prn);
    if (j >= p1) {
      intSum = intSum.plus(int);
      prnSum = prnSum.plus(prn);
    }
  }
  a.BAL = ser(rnd(bal, s));
  a.PRN = ser(rnd(prnSum, s));
  a.INT = ser(rnd(intSum, s));
}

/** CPT on P1 or P2 advances the range by its own length (1–12 → 13–24). */
function advance(s: State): void {
  const a = s.ws.amort;
  const p1 = Number(a.P1);
  const p2 = Number(a.P2);
  const len = p2 - p1 + 1;
  const n1 = p2 + 1;
  const n2 = p2 + len;
  if (n1 > 9999 || n2 > 9999) throw new CalcError(4);
  a.P1 = String(n1);
  a.P2 = String(n2);
}

function pVar(id: 'P1' | 'P2'): VarDef {
  const v = numVar('amort', id, id, 'both', { validate: validP });
  v.compute = advance;
  return v;
}

function outVar(id: 'BAL' | 'PRN' | 'INT'): VarDef {
  return { id, label: id, kind: 'auto', get: (s) => s.ws.amort[id], compute: computeAmort };
}

export const amortWorksheet: WorksheetDef = {
  id: 'amort',
  vars: () => [pVar('P1'), pVar('P2'), outVar('BAL'), outVar('PRN'), outVar('INT')],
  clear: (s) => {
    s.ws.amort = { P1: '1', P2: '1', BAL: '0', PRN: '0', INT: '0' };
  },
};
