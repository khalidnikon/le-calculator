import { HP, chk, div, ser, type Dec } from '../decimal';
import { CalcError } from '../errors';
import { defaultWs, type StatMethod, type State } from '../state';
import { settingVar } from './helpers';
import type { VarDef, WorksheetDef } from './types';

export const MAX_POINTS = 50;
const pad = (n: number) => String(n).padStart(2, '0');

export const dataWorksheet: WorksheetDef = {
  id: 'data',
  vars: (s) => {
    const pts = s.ws.data.pts;
    const vars: VarDef[] = [];
    pts.forEach((p, j) => {
      const n = pad(j + 1);
      vars.push({
        id: `X${n}`, label: `X${n}`, kind: 'enter', insDel: true,
        get: () => p.x,
        enter: (st, x) => { st.ws.data.pts[j].x = ser(x); },
      });
      vars.push({
        id: `Y${n}`, label: `Y${n}`, kind: 'enter', insDel: true,
        get: () => p.y,
        enter: (st, x) => { st.ws.data.pts[j].y = ser(x); },
      });
    });
    if (pts.length < MAX_POINTS) {
      const n = pad(pts.length + 1);
      vars.push({
        id: `X${n}`, label: `X${n}`, kind: 'enter', insDel: true,
        get: () => '0',
        // PRD: Y defaults to 1 (frequency in 1-V).
        enter: (st, x) => { st.ws.data.pts.push({ x: ser(x), y: '1' }); },
      });
    }
    return vars;
  },
  clear: (s) => { s.ws.data.pts = []; },
  ins: (s, varId) => {
    const j = Number(varId.slice(1)) - 1;
    if (s.ws.data.pts.length >= MAX_POINTS || j > s.ws.data.pts.length) return;
    s.ws.data.pts.splice(j, 0, { x: '0', y: '1' });
  },
  del: (s, varId) => {
    const j = Number(varId.slice(1)) - 1;
    if (j < s.ws.data.pts.length) s.ws.data.pts.splice(j, 1);
  },
};

interface Sums { n: HP; sx: HP; sx2: HP; sy: HP; sy2: HP; sxy: HP }

function lnOrErr(v: HP): HP {
  if (v.lte(0)) throw new CalcError(2);
  return v.ln();
}

/**
 * Sums over the data, transformed for the regression model.
 * FLAG (not in PRD): for Ln, EXP and PWR every statistic (means, sums,
 * deviations) is reported on the transformed values (ln x and/or ln y).
 */
function sums(s: State): Sums {
  const m = s.ws.stat.method;
  const out: Sums = {
    n: new HP(0), sx: new HP(0), sx2: new HP(0), sy: new HP(0), sy2: new HP(0), sxy: new HP(0),
  };
  for (const p of s.ws.data.pts) {
    let x = new HP(p.x);
    let y = new HP(p.y);
    if (m === '1-V') {
      out.n = out.n.plus(y);
      out.sx = out.sx.plus(y.times(x));
      out.sx2 = out.sx2.plus(y.times(x).times(x));
      continue;
    }
    if (m === 'Ln' || m === 'PWR') x = lnOrErr(x);
    if (m === 'EXP' || m === 'PWR') y = lnOrErr(y);
    out.n = out.n.plus(1);
    out.sx = out.sx.plus(x);
    out.sx2 = out.sx2.plus(x.times(x));
    out.sy = out.sy.plus(y);
    out.sy2 = out.sy2.plus(y.times(y));
    out.sxy = out.sxy.plus(x.times(y));
  }
  return out;
}

function ss(sum: HP, sum2: HP, n: HP): HP {
  const v = sum2.minus(div(sum.times(sum), n));
  return v.isNegative() ? new HP(0) : v;
}

function slope(t: Sums): HP {
  return div(t.n.times(t.sxy).minus(t.sx.times(t.sy)), t.n.times(t.sx2).minus(t.sx.times(t.sx)));
}

/** Regression coefficients in the model's own form (a, b). */
function coefficients(s: State, t: Sums): { a: HP; b: HP } {
  const m = s.ws.stat.method;
  const b0 = slope(t);
  const a0 = div(t.sy.minus(b0.times(t.sx)), t.n);
  if (m === 'EXP') return { a: a0.exp(), b: b0.exp() };
  if (m === 'PWR') return { a: a0.exp(), b: b0 };
  return { a: a0, b: b0 };
}

export function statValue(s: State, id: string): HP {
  const t = sums(s);
  switch (id) {
    case 'n': return t.n;
    case 'xbar': return div(t.sx, t.n);
    case 'Sx': return ss(t.sx, t.sx2, t.n).div(nonZero(t.n.minus(1))).sqrt();
    case 'sx': return div(ss(t.sx, t.sx2, t.n), t.n).sqrt();
    case 'ybar': return div(t.sy, t.n);
    case 'Sy': return ss(t.sy, t.sy2, t.n).div(nonZero(t.n.minus(1))).sqrt();
    case 'sy': return div(ss(t.sy, t.sy2, t.n), t.n).sqrt();
    case 'a': return coefficients(s, t).a;
    case 'b': return coefficients(s, t).b;
    case 'r': {
      const num = t.n.times(t.sxy).minus(t.sx.times(t.sy));
      const den = t.n.times(t.sx2).minus(t.sx.times(t.sx)).times(t.n.times(t.sy2).minus(t.sy.times(t.sy)));
      if (den.lte(0)) throw new CalcError(1);
      return num.div(den.sqrt());
    }
    case 'SX': return t.sx;
    case 'SX2': return t.sx2;
    case 'SY': return t.sy;
    case 'SY2': return t.sy2;
    case 'SXY': return t.sxy;
  }
  throw new Error(`unknown stat ${id}`);
}

function nonZero(v: HP): HP {
  if (v.lte(0)) throw new CalcError(1);
  return v;
}

function predictY(s: State, x: HP): HP {
  const { a, b } = coefficients(s, sums(s));
  switch (s.ws.stat.method) {
    case 'Ln': return a.plus(b.times(lnOrErr(x)));
    case 'EXP': return a.times(b.pow(x));
    case 'PWR': return a.times(x.pow(b));
    default: return a.plus(b.times(x));
  }
}

function predictX(s: State, y: HP): HP {
  const { a, b } = coefficients(s, sums(s));
  switch (s.ws.stat.method) {
    case 'Ln': return div(y.minus(a), b).exp();
    case 'EXP': return div(lnOrErr(div(y, a)), lnOrErr(b));
    case 'PWR': return div(y, a).pow(div(new HP(1), b));
    default: return div(y.minus(a), b);
  }
}

const LABELS: [string, string][] = [
  ['n', 'n'], ['xbar', 'x̄'], ['Sx', 'Sx'], ['sx', 'σx'],
  ['ybar', 'ȳ'], ['Sy', 'Sy'], ['sy', 'σy'], ['a', 'a'], ['b', 'b'], ['r', 'r'],
  ['Xp', "X'"], ['Yp', "Y'"],
  ['SX', 'ΣX'], ['SX2', 'ΣX²'], ['SY', 'ΣY'], ['SY2', 'ΣY²'], ['SXY', 'ΣXY'],
];
const ONE_VAR = new Set(['n', 'xbar', 'Sx', 'sx', 'SX', 'SX2']);

const METHODS: StatMethod[] = ['LIN', 'Ln', 'EXP', 'PWR', '1-V'];

export const statWorksheet: WorksheetDef = {
  id: 'stat',
  vars: (s) => {
    const oneVar = s.ws.stat.method === '1-V';
    const vars: VarDef[] = [
      settingVar<StatMethod>(s, 'method', METHODS, (st) => st.ws.stat.method, (st, v) => {
        st.ws.stat.method = v;
        st.ws.stat.out = {};
      }),
    ];
    for (const [id, label] of LABELS) {
      if (oneVar && !ONE_VAR.has(id)) continue;
      if (id === 'Xp' || id === 'Yp') {
        vars.push({
          id, label, kind: 'both',
          get: (st) => st.ws.stat[id],
          enter: (st, x: Dec) => { st.ws.stat[id] = ser(x); },
          compute: (st) => {
            st.ws.stat[id] = ser(chk(id === 'Yp' ? predictY(st, new HP(st.ws.stat.Xp)) : predictX(st, new HP(st.ws.stat.Yp))));
          },
        });
        continue;
      }
      vars.push({
        id, label, kind: 'auto',
        get: (st) => st.ws.stat.out[id] ?? '0',
        compute: (st) => { st.ws.stat.out[id] = ser(chk(statValue(st, id))); },
      });
    }
    return vars;
  },
  clear: (s) => { s.ws.stat = defaultWs().stat; },
};
