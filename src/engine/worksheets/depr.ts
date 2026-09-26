import { HP, ser, type Dec } from '../decimal';
import { dateToDays, days360, daysToYmd, inRange, parseDateEntry } from '../dates';
import { CalcError } from '../errors';
import { displayedValue } from '../format';
import { defaultWs, type DeprMethod, type State } from '../state';
import { numVar } from './helpers';
import type { VarDef, WorksheetDef } from './types';

/** SLF/DBF are offered only when the Eur date or separator format is on (PRD). */
export function deprMethods(s: State): DeprMethod[] {
  const base: DeprMethod[] = ['SL', 'SYD', 'DB', 'DBX'];
  return s.fmt.date === 'EUR' || s.fmt.sep === 'EUR' ? [...base, 'SLF', 'DBF'] : base;
}

function methodVar(s: State): VarDef {
  const m = s.ws.depr.method;
  const pctKey = m === 'DB' ? 'dbPct' : m === 'DBX' ? 'dbxPct' : null;
  const v: VarDef = {
    id: 'method',
    label: m,
    kind: 'setting',
    get: (st) => (pctKey ? st.ws.depr[pctKey] : null),
    cycle: (st) => {
      const list = deprMethods(st);
      const i = list.indexOf(st.ws.depr.method);
      st.ws.depr.method = list[(i + 1) % list.length];
    },
  };
  if (pctKey) {
    v.enter = (st, x) => {
      if (x.lte(0)) throw new CalcError(4);
      st.ws.depr[pctKey] = ser(x);
    };
  }
  return v;
}

const nonNegative = (x: Dec) => { if (x.isNegative()) throw new CalcError(4); };
const positive = (x: Dec) => { if (x.lte(0)) throw new CalcError(4); };

function rnd(x: HP, s: State): HP {
  return new HP(displayedValue(x.toSignificantDigits(13).toString(), s.fmt));
}

/**
 * FLAG (guidebook formula not available): French declining-balance
 * coefficients by useful life (3–4 → 1.25, 5–6 → 1.75, over 6 → 2.25; under
 * 3 → 1). Unverified against the guidebook.
 */
function dbfCoefficient(life: HP): HP {
  if (life.gt(6)) return new HP('2.25');
  if (life.gte(5)) return new HP('1.75');
  if (life.gte(3)) return new HP('1.25');
  return new HP(1);
}

/**
 * First-year fraction. M01's fractional part is the fraction of the first
 * month (PRD), so M01 = 3.5 gives (13 − 3.5)/12.
 * FLAG (not in PRD): SLF uses DT1 instead, as (30/360 days from DT1 to Dec 31 + 1) / 360.
 */
function firstFraction(s: State): HP {
  const d = s.ws.depr;
  if (d.method === 'SLF') {
    const { y } = daysToYmd(d.DT1);
    return new HP(days360(d.DT1, dateToDays(y, 12, 31)) + 1).div(360);
  }
  return new HP(13).minus(d.M01).div(12);
}

/**
 * Depreciation schedule up to year YR. DEP, RBV and RDV are rounded to the
 * display decimals each year (PRD).
 * FLAG (guidebook formulas not available): the year in which the asset life
 * ends takes the remaining depreciable value; later years depreciate 0; DBX
 * and DBF switch to straight line over the remaining life when that is larger.
 */
export function computeDepr(s: State): void {
  const d = s.ws.depr;
  const cst = new HP(d.CST);
  const sal = new HP(d.SAL);
  const life = new HP(d.LIF);
  const yr = Number(d.YR);
  if (sal.gt(cst)) throw new CalcError(2);
  // PRD: LIF must be an integer except for SL and SLF. FLAG: Error 2 otherwise.
  if (d.method !== 'SL' && d.method !== 'SLF' && !life.isInteger()) throw new CalcError(2);
  const f1 = firstFraction(s);
  const base = cst.minus(sal);
  const lastYear = life.minus(f1).lte(0) ? 1 : life.minus(f1).ceil().plus(1).toNumber();

  const W = life.floor();
  const F = life.minus(W);
  const sydSum = W.times(W.plus(1)).div(2).plus(W.plus(1).times(F));
  const lifeYearSyd = (k: number): HP => {
    const w = life.minus(k).plus(1);
    if (w.lte(0) || sydSum.isZero()) return new HP(0);
    return base.times(w).div(sydSum);
  };

  let rbv = cst;
  let dep = new HP(0);
  for (let y = 1; y <= yr; y++) {
    const remaining = rbv.minus(sal);
    if (y > lastYear || remaining.lte(0)) {
      dep = new HP(0);
      continue;
    }
    let raw: HP;
    switch (d.method) {
      case 'SL':
      case 'SLF': {
        const annual = base.div(life);
        raw = y === 1 ? annual.times(f1) : annual;
        break;
      }
      case 'SYD':
        raw = y === 1
          ? lifeYearSyd(1).times(f1)
          : new HP(1).minus(f1).times(lifeYearSyd(y - 1)).plus(f1.times(lifeYearSyd(y)));
        break;
      case 'DB':
      case 'DBX':
      case 'DBF': {
        const rate = d.method === 'DBF'
          ? dbfCoefficient(life).div(life)
          : new HP(d.method === 'DB' ? d.dbPct : d.dbxPct).div(100).div(life);
        raw = y === 1 ? cst.times(rate).times(f1) : rbv.times(rate);
        if (d.method !== 'DB') {
          const lifeLeft = y === 1 ? life : life.minus(f1).minus(y - 2);
          const sl = lifeLeft.lte(1)
            ? remaining
            : y === 1 ? base.div(life).times(f1) : remaining.div(lifeLeft);
          if (sl.gt(raw)) raw = sl;
        }
        break;
      }
    }
    dep = y === lastYear ? remaining : rnd(HP.min(raw, remaining), s);
    rbv = rbv.minus(dep);
  }
  d.DEP = ser(rnd(dep, s));
  d.RBV = ser(rnd(rbv, s));
  d.RDV = ser(rnd(rbv.minus(sal), s));
}

function outVar(id: 'DEP' | 'RBV' | 'RDV'): VarDef {
  return { id, label: id, kind: 'auto', get: (s) => s.ws.depr[id], compute: computeDepr };
}

export const deprWorksheet: WorksheetDef = {
  id: 'depr',
  vars: (s) => {
    const vars: VarDef[] = [
      methodVar(s),
      numVar('depr', 'LIF', 'LIF', 'enter', { validate: positive }),
      numVar('depr', 'M01', 'M01', 'enter', {
        validate: (x) => { if (x.lt(1) || x.gte(13)) throw new CalcError(4); },
      }),
    ];
    if (s.ws.depr.method === 'SLF') {
      vars.push({
        id: 'DT1', label: 'DT1', kind: 'enter', type: 'date',
        get: (st) => st.ws.depr.DT1,
        enter: (st, x) => {
          const days = parseDateEntry(x, st.fmt.date);
          if (!inRange(days)) throw new CalcError(6);
          st.ws.depr.DT1 = days;
        },
      });
    }
    const yr = numVar('depr', 'YR', 'YR', 'both', {
      // FLAG (not in PRD): YR must be a whole number; otherwise Error 4.
      validate: (x) => { if (x.lte(0) || !x.isInteger()) throw new CalcError(4); },
    });
    // PRD: CPT on YR increments it.
    yr.compute = (st) => { st.ws.depr.YR = String(Number(st.ws.depr.YR) + 1); };
    vars.push(
      numVar('depr', 'CST', 'CST', 'enter', { validate: nonNegative }),
      numVar('depr', 'SAL', 'SAL', 'enter', { validate: nonNegative }),
      yr,
      outVar('DEP'), outVar('RBV'), outVar('RDV'),
    );
    return vars;
  },
  clear: (s) => {
    s.ws.depr = defaultWs().depr;
  },
};
