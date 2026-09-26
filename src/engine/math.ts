import Decimal from 'decimal.js';
import { Dec, HP, div, finalize, isInt } from './decimal';
import { CalcError } from './errors';
import type { BinOp } from './state';

/** AOS priority (PRD "Calculation methods"): nCr/nPr → yˣ → ×÷ → +−. */
export const AOS_PRIORITY: Record<BinOp, number> = {
  NCR: 4, NPR: 4, YX: 3, MUL: 2, DIV: 2, ADD: 1, SUB: 1,
};

export function binary(op: BinOp, a: Dec, b: Dec): Dec {
  switch (op) {
    case 'ADD': return finalize(a.plus(b));
    case 'SUB': return finalize(a.minus(b));
    case 'MUL': return finalize(a.times(b));
    case 'DIV': return finalize(div(a, b));
    case 'YX': return power(a, b);
    case 'NCR': return combinations(a, b);
    case 'NPR': return permutations(a, b);
  }
}

/**
 * yˣ. Negative y is allowed only for integer x or x = 1/(odd integer) (Error 2).
 * FLAG (not in PRD): 0^0 returns 1; 0 to a negative power is a division by zero (Error 1).
 */
export function power(y: Dec, x: Dec): Dec {
  if (y.isZero()) {
    if (x.isZero()) return new Dec(1);
    if (x.isNegative()) throw new CalcError(1);
    return new Dec(0);
  }
  if (y.isPositive()) return finalize(new HP(y).pow(new HP(x)));
  const ay = new HP(y).abs();
  if (isInt(x)) {
    const r = ay.pow(new HP(x));
    return finalize(x.mod(2).isZero() ? r : r.neg());
  }
  const inv = finalize(new Dec(1).div(x));
  if (isInt(inv) && !inv.mod(2).isZero()) return finalize(ay.pow(new HP(x)).neg());
  throw new CalcError(2);
}

/** x! for integers 0–69 (Error 2 otherwise). */
export function factorial(x: Dec): Dec {
  if (!isInt(x) || x.lt(0) || x.gt(69)) throw new CalcError(2);
  let r = new HP(1);
  for (let i = 2; i <= x.toNumber(); i++) r = r.times(i);
  return finalize(r);
}

/**
 * nCr / nPr. PRD: "need n, r > 0".
 * FLAG (not in PRD): non-integers or r > n also give Error 2.
 */
function checkNr(n: Dec, r: Dec): void {
  if (!isInt(n) || !isInt(r) || n.lte(0) || r.lte(0) || r.gt(n)) throw new CalcError(2);
}

export function combinations(n: Dec, r: Dec): Dec {
  checkNr(n, r);
  const k = Decimal.min(r, n.minus(r)).toNumber();
  let acc = new HP(1);
  for (let i = 1; i <= k; i++) {
    acc = acc.times(new HP(n).minus(k).plus(i)).div(i);
    if (acc.gt('1e100')) throw new CalcError(1);
  }
  return finalize(acc.toDecimalPlaces(0, Decimal.ROUND_HALF_UP));
}

export function permutations(n: Dec, r: Dec): Dec {
  checkNr(n, r);
  let acc = new HP(1);
  const rn = r.toNumber();
  for (let i = 0; i < rn; i++) {
    acc = acc.times(new HP(n).minus(i));
    if (acc.gt('1e100')) throw new CalcError(1);
  }
  return finalize(acc);
}

export function ln(x: Dec): Dec {
  if (x.lte(0)) throw new CalcError(2);
  return finalize(new HP(x).ln());
}

export function exp(x: Dec): Dec {
  if (x.gt(231)) throw new CalcError(1);
  return finalize(new HP(x).exp());
}

export function sqrt(x: Dec): Dec {
  if (x.isNegative()) throw new CalcError(2);
  return finalize(new HP(x).sqrt());
}

export function square(x: Dec): Dec {
  return finalize(x.times(x));
}

export function reciprocal(x: Dec): Dec {
  return finalize(div(new Dec(1), x));
}

const PI = HP.acos(-1);

export type TrigFn = 'SIN' | 'COS' | 'TAN';

/**
 * Trig functions with INV and HYP.
 * FLAG (not in PRD): in DEG mode, exact multiples of 90° return exact values;
 * tan(±90°) is Error 1; out-of-domain inverse arguments are Error 2.
 */
export function trig(fn: TrigFn, x: Dec, inv: boolean, hyp: boolean, angle: 'DEG' | 'RAD'): Dec {
  const hx = new HP(x);
  if (hyp) {
    if (!inv) {
      if (fn === 'SIN') return finalize(hx.sinh());
      if (fn === 'COS') return finalize(hx.cosh());
      return finalize(hx.tanh());
    }
    if (fn === 'SIN') return finalize(hx.asinh());
    if (fn === 'COS') {
      if (hx.lt(1)) throw new CalcError(2);
      return finalize(hx.acosh());
    }
    if (hx.abs().gte(1)) throw new CalcError(2);
    return finalize(hx.atanh());
  }
  if (inv) {
    let r: HP;
    if (fn === 'SIN') {
      if (hx.abs().gt(1)) throw new CalcError(2);
      r = hx.asin();
    } else if (fn === 'COS') {
      if (hx.abs().gt(1)) throw new CalcError(2);
      r = hx.acos();
    } else {
      r = hx.atan();
    }
    return finalize(angle === 'DEG' ? r.times(180).div(PI) : r);
  }
  if (angle === 'DEG') {
    const a = hx.mod(360);
    const a360 = a.isNegative() ? a.plus(360) : a;
    if (a360.mod(90).isZero()) {
      const q = a360.div(90).toNumber();
      const s = [0, 1, 0, -1][q];
      const c = [1, 0, -1, 0][q];
      if (fn === 'SIN') return new Dec(s);
      if (fn === 'COS') return new Dec(c);
      if (c === 0) throw new CalcError(1);
      return new Dec(0);
    }
    const rad = a360.times(PI).div(180);
    return finalize(fn === 'SIN' ? rad.sin() : fn === 'COS' ? rad.cos() : rad.tan());
  }
  return finalize(fn === 'SIN' ? hx.sin() : fn === 'COS' ? hx.cos() : hx.tan());
}

/**
 * Seeded RAND.
 * FLAG (not in PRD): TI's generator is undocumented; this is mulberry32 with
 * two draws per value, giving a number in [0, 1) with 10 digits.
 */
export function nextRand(seed: number): { value: Dec; seed: number } {
  let s = seed >>> 0;
  const draw = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0);
  };
  const hi = draw() % 100000;
  const lo = draw() % 100000;
  const value = new Dec(`0.${String(hi).padStart(5, '0')}${String(lo).padStart(5, '0')}`);
  return { value: finalize(value), seed: s };
}

export function seedFrom(x: Dec): number {
  const str = x.toString();
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
