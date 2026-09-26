import { HP, div, type Dec } from '../decimal';
import { CalcError } from '../errors';
import { defaultWs, type State } from '../state';
import { numVar } from './helpers';
import type { WorksheetDef } from './types';

const h = (v: string) => new HP(v);

function pos(x: HP): HP {
  // FLAG (not in PRD): a non-positive base for a fractional power / log in
  // these worksheets is treated as "no solution" (Error 5).
  if (x.lte(0)) throw new CalcError(5);
  return x;
}

/** % Change / Compound interest: NEW = OLD × (1 + %CH/100)^#PD. */
export const pctWorksheet: WorksheetDef = {
  id: 'pct',
  vars: () => [
    numVar('pct', 'OLD', 'OLD', 'both', {
      compute: (s) => { const p = s.ws.pct; return div(h(p.NEW), growth(s)); },
    }),
    numVar('pct', 'NEW', 'NEW', 'both', {
      compute: (s) => h(s.ws.pct.OLD).times(growth(s)),
    }),
    numVar('pct', 'PCH', '%CH', 'both', {
      compute: (s) => {
        const p = s.ws.pct;
        const ratio = pos(div(h(p.NEW), h(p.OLD)));
        return ratio.pow(div(new HP(1), h(p.PD))).minus(1).times(100);
      },
    }),
    numVar('pct', 'PD', '#PD', 'both', {
      compute: (s) => {
        const p = s.ws.pct;
        const ratio = pos(div(h(p.NEW), h(p.OLD)));
        const g = pos(new HP(1).plus(h(p.PCH).div(100)));
        return div(ratio.ln(), g.ln());
      },
    }),
  ],
  clear: (s) => { s.ws.pct = defaultWs().pct; },
};

function growth(s: State): HP {
  const p = s.ws.pct;
  const g = new HP(1).plus(h(p.PCH).div(100));
  if (g.lte(0) && !h(p.PD).isInteger()) throw new CalcError(5);
  return g.pow(h(p.PD));
}

const cyPositive = (x: Dec) => { if (x.lte(0)) throw new CalcError(4); };

/** Interest conversion: EFF = 100((1 + NOM/(100·C/Y))^C/Y − 1). */
export const iconvWorksheet: WorksheetDef = {
  id: 'iconv',
  vars: () => [
    numVar('iconv', 'NOM', 'NOM', 'both', {
      compute: (s) => {
        const c = s.ws.iconv;
        const base = pos(new HP(1).plus(h(c.EFF).div(100)));
        return base.pow(div(new HP(1), h(c.CY))).minus(1).times(h(c.CY)).times(100);
      },
    }),
    numVar('iconv', 'EFF', 'EFF', 'both', {
      compute: (s) => {
        const c = s.ws.iconv;
        const base = pos(new HP(1).plus(div(h(c.NOM), h(c.CY).times(100))));
        return base.pow(h(c.CY)).minus(1).times(100);
      },
    }),
    numVar('iconv', 'CY', 'C/Y', 'enter', { validate: cyPositive }),
  ],
  clear: (s) => { s.ws.iconv = defaultWs().iconv; },
};

/** Profit margin: MAR = (SEL − CST)/SEL × 100. */
export const profitWorksheet: WorksheetDef = {
  id: 'profit',
  vars: () => [
    numVar('profit', 'CST', 'CST', 'both', {
      compute: (s) => h(s.ws.profit.SEL).times(new HP(1).minus(h(s.ws.profit.MAR).div(100))),
    }),
    numVar('profit', 'SEL', 'SEL', 'both', {
      compute: (s) => div(h(s.ws.profit.CST), new HP(1).minus(h(s.ws.profit.MAR).div(100))),
    }),
    numVar('profit', 'MAR', 'MAR', 'both', {
      compute: (s) => div(h(s.ws.profit.SEL).minus(h(s.ws.profit.CST)), h(s.ws.profit.SEL)).times(100),
    }),
  ],
  clear: (s) => { s.ws.profit = defaultWs().profit; },
};

/** Breakeven: PFT = P·Q − (FC + VC·Q). */
export const brkevnWorksheet: WorksheetDef = {
  id: 'brkevn',
  vars: () => {
    const b = (s: State) => {
      const w = s.ws.brkevn;
      return { FC: h(w.FC), VC: h(w.VC), P: h(w.P), PFT: h(w.PFT), Q: h(w.Q) };
    };
    return [
      numVar('brkevn', 'FC', 'FC', 'both', {
        compute: (s) => { const v = b(s); return v.P.times(v.Q).minus(v.VC.times(v.Q)).minus(v.PFT); },
      }),
      numVar('brkevn', 'VC', 'VC', 'both', {
        compute: (s) => { const v = b(s); return div(v.P.times(v.Q).minus(v.FC).minus(v.PFT), v.Q); },
      }),
      numVar('brkevn', 'P', 'P', 'both', {
        compute: (s) => { const v = b(s); return div(v.FC.plus(v.PFT), v.Q).plus(v.VC); },
      }),
      numVar('brkevn', 'PFT', 'PFT', 'both', {
        compute: (s) => { const v = b(s); return v.P.times(v.Q).minus(v.FC.plus(v.VC.times(v.Q))); },
      }),
      numVar('brkevn', 'Q', 'Q', 'both', {
        compute: (s) => { const v = b(s); return div(v.FC.plus(v.PFT), v.P.minus(v.VC)); },
      }),
    ];
  },
  clear: (s) => { s.ws.brkevn = defaultWs().brkevn; },
};
