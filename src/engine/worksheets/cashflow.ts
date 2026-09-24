import { HP, chk, div, type Dec } from '../decimal';
import { CalcError } from '../errors';
import { rootClosestToZero } from '../solver';
import type { State } from '../state';
import { numVar } from './helpers';
import type { VarDef, WorksheetDef } from './types';

export const MAX_FLOWS = 32;

const pad = (n: number) => String(n).padStart(2, '0');

function validFreq(x: Dec): void {
  // PRD: F range 0.5–9,999, else Error 4.
  if (x.lt('0.5') || x.gt(9999)) throw new CalcError(4);
}

function flowIndex(varId: string): number {
  return Number(varId.slice(1)) - 1;
}

export const cfWorksheet: WorksheetDef = {
  id: 'cf',
  markGroup: 'cf',
  vars: (s) => {
    const cf = s.ws.cf;
    const vars: VarDef[] = [numVar('cf', 'CF0', 'CFo', 'enter')];
    cf.flows.forEach((fl, j) => {
      const n = pad(j + 1);
      vars.push({
        id: `C${n}`, label: `C${n}`, kind: 'enter', insDel: true,
        get: () => fl.c,
        enter: (st, x) => { st.ws.cf.flows[j].c = x.toString(); },
      });
      vars.push({
        id: `F${n}`, label: `F${n}`, kind: 'enter', insDel: true,
        get: () => fl.f,
        enter: (st, x) => { validFreq(x); st.ws.cf.flows[j].f = x.toString(); },
      });
    });
    if (cf.flows.length < MAX_FLOWS) {
      const n = pad(cf.flows.length + 1);
      vars.push({
        id: `C${n}`, label: `C${n}`, kind: 'enter', insDel: true,
        get: () => '0',
        enter: (st, x) => { st.ws.cf.flows.push({ c: x.toString(), f: '1' }); },
      });
    }
    return vars;
  },
  clear: clearCf,
  ins: (s, varId) => {
    if (varId === 'CF0') return;
    const j = flowIndex(varId);
    // FLAG (not in PRD): inserting when 32 flows exist is ignored.
    if (s.ws.cf.flows.length >= MAX_FLOWS || j > s.ws.cf.flows.length) return;
    s.ws.cf.flows.splice(j, 0, { c: '0', f: '1' });
  },
  del: (s, varId) => {
    if (varId === 'CF0') return;
    const j = flowIndex(varId);
    if (j < s.ws.cf.flows.length) s.ws.cf.flows.splice(j, 1);
  },
};

/**
 * FLAG (PRD Open items → Cash Flow defaults): 2ND CLR WORK in any of the CF,
 * NPV or IRR worksheets clears the whole cash-flow data set to zeros.
 */
function clearCf(s: State): void {
  s.ws.cf = {
    CF0: '0', flows: [], I: '0', NPV: '0', NFV: '0', PB: '0', DPB: '0',
    IRR: '0', RI: '0', MOD: '0',
  };
  s.marks.cf = {};
}

interface Group { c: HP; n: HP; start: HP }

function groups(s: State): { cf0: HP; gs: Group[]; total: HP } {
  const cf = s.ws.cf;
  let start = new HP(0);
  const gs = cf.flows.map((fl) => {
    const g = { c: new HP(fl.c), n: new HP(fl.f), start };
    start = start.plus(g.n);
    return g;
  });
  return { cf0: new HP(cf.CF0), gs, total: start };
}

/** Present value at periodic rate i of c paid at periods start+1 .. start+n. */
function groupPV(g: Group, i: HP): HP {
  if (i.isZero()) return g.c.times(g.n);
  const v = div(new HP(1), new HP(1).plus(i));
  return g.c.times(v.pow(g.start)).times(new HP(1).minus(v.pow(g.n))).div(i);
}

function npvAt(s: State, i: HP): HP {
  const { cf0, gs } = groups(s);
  return gs.reduce((acc, g) => acc.plus(groupPV(g, i)), cf0);
}

function npvFloat(s: State, i: number): number {
  const cf = s.ws.cf;
  let acc = Number(cf.CF0);
  let start = 0;
  for (const fl of cf.flows) {
    const c = Number(fl.c);
    const n = Number(fl.f);
    if (i === 0) acc += c * n;
    else {
      const v = 1 / (1 + i);
      acc += (c * Math.pow(v, start) * (1 - Math.pow(v, n))) / i;
    }
    start += n;
  }
  return acc;
}

function rateI(s: State): HP {
  const i = new HP(s.ws.cf.I).div(100);
  if (i.lte(-1)) throw new CalcError(1);
  return i;
}

export function computeNPV(s: State): HP {
  return chk(npvAt(s, rateI(s)));
}

export function computeNFV(s: State): HP {
  const i = rateI(s);
  const { total } = groups(s);
  return chk(npvAt(s, i).times(new HP(1).plus(i).pow(total)));
}

/**
 * Payback (PB) and discounted payback (DPB).
 * FLAG (guidebook formula not available): payback is the first time the
 * cumulative (discounted) cash flow reaches zero, interpolated within the
 * period group where it happens; CFo ≥ 0 gives 0. No payback → Error 7.
 */
function payback(s: State, discounted: boolean): HP {
  const { cf0, gs } = groups(s);
  const i = discounted ? rateI(s) : new HP(0);
  let cum = cf0;
  if (cum.gte(0)) return new HP(0);
  for (const g of gs) {
    const pv = groupPV(g, i);
    if (g.c.gt(0) && cum.plus(pv).gte(0)) {
      if (i.isZero()) return g.start.plus(div(cum.neg(), g.c));
      const v = div(new HP(1), new HP(1).plus(i));
      const inner = new HP(1).minus(cum.neg().times(i).div(g.c.times(v.pow(g.start))));
      if (inner.lte(0)) throw new CalcError(7);
      return g.start.plus(div(inner.ln(), v.ln()));
    }
    cum = cum.plus(pv);
  }
  throw new CalcError(7);
}

export function computeIRR(s: State): HP {
  const { cf0, gs } = groups(s);
  const nz = [cf0, ...gs.map((g) => g.c)].filter((c) => !c.isZero());
  if (!nz.some((c) => c.isNegative()) || !nz.some((c) => c.isPositive())) throw new CalcError(5);
  const i = rootClosestToZero((r) => npvFloat(s, r), (r) => npvAt(s, r));
  return i.times(100);
}

/**
 * Modified IRR.
 * FLAG (guidebook formula not available): negative flows are discounted at
 * I (the NPV rate) and positive flows compounded at RI to the last period.
 */
export function computeMOD(s: State): HP {
  const { cf0, gs, total } = groups(s);
  if (total.isZero()) throw new CalcError(1);
  const iF = rateI(s);
  const r = new HP(s.ws.cf.RI).div(100);
  if (r.lte(-1)) throw new CalcError(1);
  let pvNeg = cf0.isNegative() ? cf0 : new HP(0);
  let fvPos = cf0.isPositive() ? cf0.times(new HP(1).plus(r).pow(total)) : new HP(0);
  for (const g of gs) {
    if (g.c.isNegative()) pvNeg = pvNeg.plus(groupPV(g, iF));
    else if (g.c.isPositive()) {
      const growth = r.isZero()
        ? g.n
        : new HP(1).plus(r).pow(g.n).minus(1).div(r);
      fvPos = fvPos.plus(g.c.times(growth).times(new HP(1).plus(r).pow(total.minus(g.start).minus(g.n))));
    }
  }
  const ratio = div(fvPos, pvNeg.neg());
  if (ratio.lte(0)) throw new CalcError(5);
  return chk(ratio.pow(div(new HP(1), total)).minus(1).times(100));
}

export const npvWorksheet: WorksheetDef = {
  id: 'npv',
  markGroup: 'cf',
  vars: () => [
    numVar('cf', 'I', 'I', 'enter'),
    numVar('cf', 'NPV', 'NPV', 'compute', { compute: computeNPV }),
    numVar('cf', 'NFV', 'NFV', 'auto', { compute: computeNFV }),
    numVar('cf', 'PB', 'PB', 'auto', { compute: (s) => payback(s, false) }),
    numVar('cf', 'DPB', 'DPB', 'auto', { compute: (s) => payback(s, true) }),
  ],
  clear: clearCf,
};

export const irrWorksheet: WorksheetDef = {
  id: 'irr',
  markGroup: 'cf',
  vars: () => [
    numVar('cf', 'IRR', 'IRR', 'compute', { compute: computeIRR }),
    numVar('cf', 'RI', 'RI', 'enter'),
    numVar('cf', 'MOD', 'MOD', 'auto', { compute: computeMOD }),
  ],
  clear: clearCf,
};
