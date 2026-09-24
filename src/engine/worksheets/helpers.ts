import type Decimal from 'decimal.js';
import { ser, type Dec } from '../decimal';
import type { State, WsData } from '../state';
import type { VarDef, VarKind } from './types';

type NumKeys<T> = { [P in keyof T]: T[P] extends string ? P : never }[keyof T] & string;

export interface NumVarOpts {
  validate?: (x: Dec, s: State) => void;
  compute?: (s: State) => Decimal;
  /** Called after a successful ENTER (e.g. P/Y also sets C/Y). */
  afterEnter?: (s: State) => void;
}

/** A numeric worksheet variable backed by `s.ws[ws][prop]`. */
export function numVar<W extends keyof WsData>(
  ws: W,
  prop: NumKeys<WsData[W]>,
  label: string,
  kind: VarKind,
  opts: NumVarOpts = {},
): VarDef {
  const rec = (s: State) => s.ws[ws] as unknown as Record<string, string>;
  const def: VarDef = {
    id: prop,
    label,
    kind,
    get: (s) => rec(s)[prop],
  };
  if (kind === 'enter' || kind === 'both') {
    def.enter = (s, x) => {
      opts.validate?.(x, s);
      rec(s)[prop] = ser(x);
      opts.afterEnter?.(s);
    };
  }
  if (opts.compute) {
    const compute = opts.compute;
    def.compute = (s) => {
      rec(s)[prop] = ser(compute(s));
    };
  }
  return def;
}

/** A 2ND SET toggle between values; the label is the current setting text. */
export function settingVar<T extends string | number>(
  s: State,
  id: string,
  options: readonly T[],
  get: (s: State) => T,
  set: (s: State, v: T) => void,
  label: (v: T) => string = (v) => String(v),
): VarDef {
  return {
    id,
    label: label(get(s)),
    kind: 'setting',
    get: () => null,
    cycle: (st) => {
      const i = options.indexOf(get(st));
      set(st, options[(i + 1) % options.length]);
    },
  };
}
