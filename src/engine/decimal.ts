import Decimal from 'decimal.js';
import { CalcError } from './errors';

/**
 * Stored-value arithmetic: 13 significant digits (PRD "Core engine").
 * Every value that lands in state goes through `finalize`, which rounds to
 * 13 significant digits and enforces the ±9.9999999999999E99 range (Error 1).
 */
export const Dec = Decimal.clone({
  precision: 13,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -7,
  toExpPos: 21,
  maxE: 9e15,
  minE: -9e15,
});
export type Dec = Decimal;

/**
 * Working precision for worksheet formulas and solvers.
 * FLAG (not in guidebook/PRD): the guidebook does not say what internal
 * precision worksheet formulas use. We compute with extra guard digits and
 * round the stored result to 13 significant digits.
 */
export const HP = Decimal.clone({
  precision: 34,
  rounding: Decimal.ROUND_HALF_EVEN,
  toExpNeg: -7,
  toExpPos: 21,
  maxE: 9e15,
  minE: -9e15,
});
export type HP = Decimal;

export const MAX_MAGNITUDE = new Dec('9.9999999999999e99');
/**
 * FLAG (not in guidebook/PRD): results with magnitude below 1E-99 are
 * flushed to zero (the lower end of the displayable exponent range).
 */
export const MIN_MAGNITUDE = new Dec('1e-99');

export const ZERO = '0';

/** Round to 13 significant digits and range-check. Throws Error 1 on overflow. */
export function finalize(v: Decimal.Value): Dec {
  const d = new Dec(v);
  if (!d.isFinite()) throw new CalcError(1);
  const r = d.toSignificantDigits(13, Decimal.ROUND_HALF_UP);
  if (r.abs().gt(MAX_MAGNITUDE)) throw new CalcError(1);
  if (!r.isZero() && r.abs().lt(MIN_MAGNITUDE)) return new Dec(0);
  // normalise negative zero
  if (r.isZero()) return new Dec(0);
  return r;
}

/** Serialize a value for state storage (after finalize). */
export function ser(v: Decimal.Value): string {
  return finalize(v).toString();
}

export function d(v: Decimal.Value): Dec {
  return new Dec(v);
}

export function hp(v: Decimal.Value): HP {
  return new HP(v);
}

export function isInt(v: Decimal): boolean {
  return v.isInteger();
}

/** Division that raises Error 1 on a zero divisor (including internal divisions). */
export function div<T extends Decimal>(a: T, b: Decimal.Value): T {
  const bb = new (a.constructor as typeof Decimal)(b);
  if (bb.isZero()) throw new CalcError(1);
  return a.div(bb) as T;
}

/** Guard an intermediate high-precision result: non-finite → Error 1. */
export function chk<T extends Decimal>(v: T): T {
  if (!v.isFinite()) throw new CalcError(1);
  return v;
}

/** Round to a number of decimal places (display rounding: half up). */
export function roundDp(v: Decimal.Value, dp: number): Dec {
  return new Dec(v).toDecimalPlaces(dp, Decimal.ROUND_HALF_UP);
}

export { Decimal };
