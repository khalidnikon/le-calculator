import { HP } from './decimal';
import { CalcError } from './errors';

/**
 * FLAG (PRD Open items → solver tolerance and iteration cap): the guidebook
 * states neither. These are our choices.
 */
export const SOLVER_MAX_ITERATIONS = 200;
/** Relative bracket width at which a root is accepted. */
export const SOLVER_TOLERANCE = new HP('1e-22');

/**
 * FLAG (PRD Open items → IRR search): the starting guess is not stated. We
 * scan this grid of periodic rates for sign changes, refine every bracket, and
 * return the root closest to zero.
 */
export function rateGrid(): number[] {
  const g: number[] = [-0.9999, -0.999];
  for (let r = -0.99; r < 1; r += 0.005) g.push(Math.round(r * 1e6) / 1e6);
  for (let r = 1; r <= 1e4; r *= 1.1) g.push(r);
  return g;
}

/**
 * Illinois (modified regula falsi) on a bracket [a, b] with f(a)·f(b) < 0,
 * in high precision. Throws Error 7 when the iteration cap is hit.
 */
export function refine(f: (x: HP) => HP, a0: number, b0: number): HP {
  let a = new HP(a0);
  let b = new HP(b0);
  let fa = f(a);
  let fb = f(b);
  if (fa.isZero()) return a;
  if (fb.isZero()) return b;
  let side = 0;
  for (let i = 0; i < SOLVER_MAX_ITERATIONS; i++) {
    const c = a.times(fb).minus(b.times(fa)).div(fb.minus(fa));
    const fc = f(c);
    if (fc.isZero()) return c;
    if (fc.isNegative() === fb.isNegative()) {
      b = c;
      fb = fc;
      if (side === -1) fa = fa.div(2);
      side = -1;
    } else {
      a = c;
      fa = fc;
      if (side === 1) fb = fb.div(2);
      side = 1;
    }
    const scale = HP.max(1, c.abs());
    if (b.minus(a).abs().lte(SOLVER_TOLERANCE.times(scale))) return c;
  }
  throw new CalcError(7);
}

/**
 * Find every sign change of `fFloat` over `grid`, refine each with `fHP`,
 * and return the root closest to zero. No bracket → Error 7.
 */
export function rootClosestToZero(
  fFloat: (x: number) => number,
  fHP: (x: HP) => HP,
  grid: number[] = rateGrid(),
): HP {
  const brackets: [number, number][] = [];
  let px = grid[0];
  let pf = fFloat(px);
  for (let k = 1; k < grid.length; k++) {
    const x = grid[k];
    const fx = fFloat(x);
    if (Number.isFinite(pf) && Number.isFinite(fx) && !Number.isNaN(pf) && !Number.isNaN(fx)) {
      if (pf === 0) brackets.push([px, px]);
      else if (Math.sign(pf) !== Math.sign(fx) && fx !== 0) brackets.push([px, x]);
    }
    px = x;
    pf = fx;
  }
  if (Number.isFinite(pf) && pf === 0) brackets.push([px, px]);
  if (brackets.length === 0) throw new CalcError(7);
  let best: HP | null = null;
  for (const [a, b] of brackets) {
    const r = a === b ? new HP(a) : refine(fHP, a, b);
    if (best === null || r.abs().lt(best.abs())) best = r;
  }
  return best!;
}
