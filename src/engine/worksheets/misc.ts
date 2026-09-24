import { HP, ser, type Dec } from '../decimal';
import { days360, inRange, parseDateEntry } from '../dates';
import { CalcError } from '../errors';
import { defaultFormats, defaultWs, type State } from '../state';
import { numVar, settingVar } from './helpers';
import type { VarDef, WorksheetDef } from './types';

function dateVar(id: 'DT1' | 'DT2', s: State): VarDef {
  const act = s.ws.date.basis === 'ACT';
  const v: VarDef = {
    id, label: id,
    // PRD: 360 mode can compute DBD but not dates.
    kind: act ? 'both' : 'enter',
    type: 'date',
    get: (st) => st.ws.date[id],
    enter: (st, x) => {
      const days = parseDateEntry(x, st.fmt.date);
      if (!inRange(days)) throw new CalcError(6);
      st.ws.date[id] = days;
    },
  };
  if (act) {
    v.compute = (st) => {
      const w = st.ws.date;
      // FLAG (not in PRD): a fractional DBD is truncated to whole days.
      const dbd = Math.trunc(Number(w.DBD));
      const days = id === 'DT1' ? w.DT2 - dbd : w.DT1 + dbd;
      // PRD: computed date outside 1980–2079 → Error 4.
      if (!inRange(days)) throw new CalcError(4);
      w[id] = days;
    };
  }
  return v;
}

/** Date worksheet: DT1 is assumed earlier than DT2 (PRD). */
export const dateWorksheet: WorksheetDef = {
  id: 'date',
  vars: (s) => [
    dateVar('DT1', s),
    dateVar('DT2', s),
    numVar('date', 'DBD', 'DBD', 'both', {
      compute: (st) => {
        const w = st.ws.date;
        return new HP(w.basis === 'ACT' ? w.DT2 - w.DT1 : days360(w.DT1, w.DT2));
      },
    }),
    settingVar<'ACT' | '360'>(s, 'basis', ['ACT', '360'], (st) => st.ws.date.basis, (st, v) => { st.ws.date.basis = v; }),
  ],
  clear: (s) => { s.ws.date = defaultWs().date; },
};

/** Memory worksheet: M0–M9. Memory arithmetic is handled by the dispatcher. */
export const memWorksheet: WorksheetDef = {
  id: 'mem',
  vars: () => Array.from({ length: 10 }, (_, n): VarDef => ({
    id: `M${n}`, label: `M${n}`, kind: 'enter',
    get: (s) => s.mem[n],
    enter: (s, x: Dec) => { s.mem[n] = ser(x); },
  })),
  clear: (s) => { s.mem = s.mem.map(() => '0'); },
};

/** 2ND FORMAT: DEC, angle, date, separators, calculation method. */
export const formatWorksheet: WorksheetDef = {
  id: 'format',
  vars: (s) => [
    {
      id: 'DEC', label: 'DEC', kind: 'enter',
      get: (st) => String(st.fmt.dec),
      enter: (st, x) => {
        // PRD: DEC outside 0–9 → Error 4. FLAG: non-integers also Error 4.
        if (!x.isInteger() || x.lt(0) || x.gt(9)) throw new CalcError(4);
        st.fmt.dec = x.toNumber();
      },
    },
    settingVar<'DEG' | 'RAD'>(s, 'angle', ['DEG', 'RAD'], (st) => st.fmt.angle, (st, v) => { st.fmt.angle = v; }),
    settingVar<'US' | 'EUR'>(s, 'date', ['US', 'EUR'], (st) => st.fmt.date, (st, v) => { st.fmt.date = v; },
      (v) => (v === 'US' ? 'US 12-31-1990' : 'EUR 31-12-1990')),
    settingVar<'US' | 'EUR'>(s, 'sep', ['US', 'EUR'], (st) => st.fmt.sep, (st, v) => { st.fmt.sep = v; },
      (v) => (v === 'US' ? 'US 1,000.00' : 'EUR 1.000,00')),
    settingVar<'CHN' | 'AOS'>(s, 'calc', ['CHN', 'AOS'], (st) => st.fmt.calc, (st, v) => { st.fmt.calc = v; },
      (v) => (v === 'CHN' ? 'Chn' : 'AOS')),
  ],
  clear: (s) => { s.fmt = defaultFormats(); },
};
