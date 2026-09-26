import { Dec, ser } from './decimal';
import { CalcError } from './errors';
import { displayedValue } from './format';
import { DIGIT_KEYS, SECOND_FNS, type Fn, type Key } from './keys';
import {
  AOS_PRIORITY, binary, exp, factorial, ln, nextRand, reciprocal, seedFrom, sqrt, square, trig,
} from './math';
import { initialState, type BinOp, type Frame, type Mark, type State, type WsId } from './state';
import { WORKSHEETS, type VarDef, type WorksheetDef } from './worksheets';
import { clearTvm, computeTvm, TVM_VARS, type TvmVar } from './worksheets/tvm';

/** PRD: 15 levels of parentheses, 8 pending operations; more is Error 3. */
export const MAX_PAREN_LEVELS = 15;
export const MAX_PENDING_OPS = 8;
/** PRD: display holds up to 10 keyed digits. */
export const MAX_ENTRY_DIGITS = 10;

const BIN_OPS: Partial<Record<Fn, BinOp>> = {
  ADD: 'ADD', SUB: 'SUB', MUL: 'MUL', DIV: 'DIV', YX: 'YX', NCR: 'NCR', NPR: 'NPR',
};

const WS_KEYS: Partial<Record<Fn, WsId>> = {
  PY: 'py', BGN: 'bgn', AMORT: 'amort', CF: 'cf', NPV: 'npv', IRR: 'irr',
  BOND: 'bond', DEPR: 'depr', DATA: 'data', STAT: 'stat', DPCT: 'pct',
  ICONV: 'iconv', DATE: 'date', PROFIT: 'profit', BRKEVN: 'brkevn',
  MEM: 'mem', FORMAT: 'format',
};

/** Keys that keep a 2ND K constant alive (PRD: "any key other than a digit or = clears it"). */
const KEEPS_CONSTANT = new Set<Fn>(['D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'DOT', 'NEG', 'BKSP', 'EQ']);

/**
 * The engine: one pure function from (state, key) to the next state.
 * Errors leave every other part of the state as it was before the key.
 */
export function press(state: State, key: Key): State {
  const s = structuredClone(state);
  try {
    handle(s, key);
    return s;
  } catch (e) {
    let code: number;
    if (e instanceof CalcError) code = e.code;
    else if (e instanceof Error && e.message.includes('DecimalError')) code = 1;
    else throw e;
    const f = structuredClone(state);
    f.error = code;
    f.entry = null;
    f.second = false;
    f.inv = false;
    f.hyp = false;
    f.cptArmed = false;
    f.prefix = null;
    f.kPending = null;
    f.valueOnly = false;
    return f;
  }
}

/** The state after an ON|OFF press during a running computation (Error 8). */
export function cancelled(state: State): State {
  const f = structuredClone(state);
  f.error = 8;
  f.entry = null;
  f.second = false;
  f.cptArmed = false;
  return f;
}

function handle(s: State, key: Key): void {
  if (key === 'ONOFF') return onOff(s);
  if (key === '2ND') {
    if (s.error === null) s.second = !s.second;
    return;
  }
  // FLAG (not in PRD): 2ND on a key without a 2ND function acts as the primary key.
  const fn: Fn = s.second ? ((SECOND_FNS as Partial<Record<Key, Fn>>)[key] ?? (key as Fn)) : (key as Fn);
  s.second = false;

  if (s.error !== null) {
    // FLAG (not in PRD): while an error shows, only CE|C and ON|OFF do anything.
    if (fn === 'CEC') clearError(s);
    return;
  }
  if (s.resetPrompt) {
    if (fn === 'ENTER') doReset(s);
    else if (fn === 'QUIT') s.resetPrompt = false;
    return;
  }
  dispatch(s, fn);
}

function dispatch(s: State, fn: Fn): void {
  s.valueOnly = false;
  if (s.mode === 'std' && !['CPT', 'STO', 'RCL', 'INV', 'HYP'].includes(fn)) {
    s.label = null;
    s.labelMark = null;
  }
  if (s.constant && !KEEPS_CONSTANT.has(fn)) s.constant = null;

  if (s.prefix && handlePrefix(s, fn)) return;

  if (s.cptArmed) {
    s.cptArmed = false;
    if ((TVM_VARS as string[]).includes(fn)) return computeTvmKey(s, fn as TvmVar);
    if (fn === 'CPT') return;
  }

  // FLAG (not in PRD): INV modifies SIN/COS/TAN (with or without HYP), LN and
  // eˣ only; any other key simply clears it.
  if (fn === 'INV') { s.inv = !s.inv; return; }
  if (fn === 'HYP') { s.hyp = !s.hyp; return; }
  const inv = s.inv;
  const hyp = s.hyp;
  s.inv = false;
  s.hyp = false;

  const digit = DIGIT_KEYS[fn as Key];
  if (digit !== undefined) return typeChar(s, digit);
  const op = BIN_OPS[fn];
  if (op) return binaryKey(s, op);
  const ws = WS_KEYS[fn];
  if (ws) return enterWorksheet(s, ws);
  if ((TVM_VARS as string[]).includes(fn)) return storeTvmKey(s, fn as TvmVar);

  switch (fn) {
    case 'DOT': return typeChar(s, '.');
    case 'NEG': return negate(s);
    case 'BKSP': return backspace(s);
    case 'LPAREN': return lparen(s);
    case 'RPAREN': return rparen(s);
    case 'EQ': return equals(s);
    case 'PCT': return percent(s);
    case 'K': return constantKey(s);
    case 'SQ': return result(s, square(x(s)));
    case 'SQRT': return result(s, sqrt(x(s)));
    case 'RECIP': return result(s, reciprocal(x(s)));
    case 'FACT': return result(s, factorial(x(s)));
    case 'LN': return result(s, inv ? exp(x(s)) : ln(x(s)));
    case 'EX': return result(s, inv ? ln(x(s)) : exp(x(s)));
    case 'SIN':
    case 'COS':
    case 'TAN':
      return result(s, trig(fn, x(s), inv, hyp, s.fmt.angle));
    case 'ROUND': return result(s, displayedValue(s.x, s.fmt));
    case 'RAND': {
      const r = nextRand(s.rand);
      s.rand = r.seed;
      return result(s, r.value);
    }
    case 'ANS': return result(s, new Dec(s.lastAns));
    case 'XPY': return result(s, binary('MUL', x(s), new Dec(s.ws.tvm.PY)));
    case 'STO':
    case 'RCL':
      s.entry = null;
      s.prefix = { kind: fn, op: null };
      return;
    case 'CEC': return clearEntry(s);
    case 'CLRTVM':
      clearTvm(s);
      if (s.mode === 'std') setX(s, new Dec(0));
      return;
    case 'CLRWORK': return clearWork(s);
    case 'CPT': return cptKey(s);
    case 'ENTER': return enterKey(s);
    case 'SET': return setKey(s);
    case 'UP': return move(s, -1);
    case 'DOWN': return move(s, 1);
    case 'INS':
    case 'DEL':
      return insDel(s, fn);
    case 'QUIT': return quit(s);
    case 'RESET':
      s.resetPrompt = true;
      return;
  }
}

/* ---------- number entry ---------- */

function x(s: State): Dec {
  return new Dec(s.x);
}

function setX(s: State, v: Dec): void {
  s.x = ser(v);
  s.entry = null;
  s.opJustPressed = false;
  s.scratch = true;
}

function result(s: State, v: Dec): void {
  setX(s, v);
}

function typeChar(s: State, ch: string): void {
  let e = s.entry;
  if (e === null) {
    e = ch === '.' ? '0.' : ch;
  } else {
    const digits = e.replace(/[-.]/g, '').length;
    if (ch === '.') {
      if (e.includes('.')) return;
      e += '.';
    } else {
      if (digits >= MAX_ENTRY_DIGITS) return;
      if (e === '0') e = ch;
      else if (e === '-0') e = '-' + ch;
      else e += ch;
    }
  }
  s.entry = e;
  s.x = ser(e === '-' ? '0' : e);
  s.opJustPressed = false;
  s.scratch = true;
}

/** +|− toggles the sign of the number being keyed, or negates the displayed value. */
function negate(s: State): void {
  if (s.entry !== null) {
    s.entry = s.entry.startsWith('-') ? s.entry.slice(1) : '-' + s.entry;
    s.x = ser(s.entry);
    return;
  }
  result(s, x(s).neg());
}

function backspace(s: State): void {
  if (s.entry === null) return;
  const e = s.entry.slice(0, -1);
  if (e === '' || e === '-') {
    s.entry = null;
    s.x = '0';
    return;
  }
  s.entry = e;
  s.x = ser(e.endsWith('.') ? e.slice(0, -1) : e);
}

/* ---------- pending math (Chn / AOS) ---------- */

function prec(s: State, op: BinOp): number {
  return s.fmt.calc === 'AOS' ? AOS_PRIORITY[op] : 1;
}

function reduce(s: State, f: Frame, until: number): void {
  while (f.ops.length && prec(s, f.ops[f.ops.length - 1]) >= until) {
    const b = new Dec(f.vals.pop()!);
    const a = new Dec(f.vals.pop()!);
    const op = f.ops.pop()!;
    f.vals.push(ser(binary(op, a, b)));
  }
}

function pendingOps(s: State): number {
  return s.frames.reduce((n, f) => n + f.ops.length, 0);
}

function top(s: State): Frame {
  return s.frames[s.frames.length - 1];
}

function binaryKey(s: State, op: BinOp): void {
  if (s.mode === 'mem') {
    // Memory worksheet: the operator applies to the selected memory on ENTER.
    s.memOp = op;
    s.entry = null;
    s.scratch = true;
    return;
  }
  const f = top(s);
  if (s.opJustPressed && f.ops.length) {
    // FLAG (not in PRD): a second operator in a row replaces the first.
    f.ops[f.ops.length - 1] = op;
    return;
  }
  f.vals.push(s.x);
  reduce(s, f, prec(s, op));
  f.ops.push(op);
  if (pendingOps(s) > MAX_PENDING_OPS) throw new CalcError(3);
  s.x = f.vals[f.vals.length - 1];
  s.entry = null;
  s.opJustPressed = true;
  s.scratch = true;
}

function lparen(s: State): void {
  if (s.frames.length - 1 >= MAX_PAREN_LEVELS) throw new CalcError(3);
  s.frames.push({ vals: [], ops: [] });
  s.entry = null;
  s.opJustPressed = false;
  s.scratch = true;
}

function rparen(s: State): void {
  if (s.frames.length === 1) return;
  const f = s.frames.pop()!;
  f.vals.push(s.x);
  reduce(s, f, -Infinity);
  setX(s, new Dec(f.vals[0]));
}

/** = completes all pending operations and closes all open parentheses. */
function equals(s: State): void {
  if (s.mode === 'mem') return;
  const k = s.kPending;
  const typed = s.x;
  const anyPending = s.frames.length > 1 || s.frames[0].ops.length > 0;
  if (anyPending) {
    let v = s.x;
    for (let i = s.frames.length - 1; i >= 0; i--) {
      const f = s.frames[i];
      f.vals.push(v);
      reduce(s, f, -Infinity);
      v = f.vals[0];
    }
    s.frames = [{ vals: [], ops: [] }];
    setX(s, new Dec(v));
  } else if (s.constant) {
    setX(s, applyConstant(s, x(s)));
  } else {
    setX(s, x(s));
  }
  if (k) {
    s.constant = { op: k.op, c: k.c ?? typed, pct: k.pct };
    s.kPending = null;
  }
  s.lastAns = s.x;
}

/**
 * Constant (2ND K): n [op] 2ND K c = stores op and c.
 * FLAG (not in PRD): the add-on / discount % form is n ± 2ND K c % =, after
 * which each value v gives v ± v·c/100 (× gives v·c/100, ÷ gives v ÷ (c/100)).
 */
function applyConstant(s: State, v: Dec): Dec {
  const k = s.constant!;
  const c = new Dec(k.c);
  if (!k.pct) return binary(k.op, v, c);
  const part = binary('DIV', binary('MUL', v, c), new Dec(100));
  switch (k.op) {
    case 'ADD': return binary('ADD', v, part);
    case 'SUB': return binary('SUB', v, part);
    case 'MUL': return part;
    case 'DIV': return binary('DIV', v, binary('DIV', c, new Dec(100)));
    default: return binary(k.op, v, c);
  }
}

function constantKey(s: State): void {
  const f = top(s);
  if (!f.ops.length) return;
  s.kPending = { op: f.ops[f.ops.length - 1], pct: false, c: null };
}

/**
 * %: x ÷ 100, or — with a pending + or − — that percent of the left operand
 * (add-on / discount).
 * FLAG (guidebook text not available): exact % semantics are from general
 * TI calculator behavior, not the guidebook.
 */
function percent(s: State): void {
  if (s.kPending) {
    s.kPending.pct = true;
    s.kPending.c = s.x;
  }
  const f = top(s);
  const last = f.ops[f.ops.length - 1];
  if (f.ops.length && !s.opJustPressed && (last === 'ADD' || last === 'SUB')) {
    const left = new Dec(f.vals[f.vals.length - 1]);
    return result(s, binary('DIV', binary('MUL', left, x(s)), new Dec(100)));
  }
  result(s, binary('DIV', x(s), new Dec(100)));
}

/* ---------- memory ---------- */

function handlePrefix(s: State, fn: Fn): boolean {
  const p = s.prefix!;
  const digit = DIGIT_KEYS[fn as Key];
  if (digit !== undefined) {
    const n = Number(digit);
    s.prefix = null;
    if (p.kind === 'STO') {
      // Changes only the memory, not the display, and does not complete pending math.
      s.mem[n] = p.op ? ser(binary(p.op, new Dec(s.mem[n]), x(s))) : s.x;
      s.entry = null;
    } else {
      setX(s, new Dec(s.mem[n]));
    }
    return true;
  }
  if (p.kind === 'STO' && !p.op && (fn === 'ADD' || fn === 'SUB' || fn === 'MUL' || fn === 'DIV' || fn === 'YX')) {
    p.op = fn;
    return true;
  }
  if (p.kind === 'STO' && !p.op && fn === 'RAND') {
    s.rand = seedFrom(x(s));
    s.prefix = null;
    return true;
  }
  if (p.kind === 'RCL' && (TVM_VARS as string[]).includes(fn)) {
    s.prefix = null;
    const v = fn as TvmVar;
    setX(s, new Dec(s.ws.tvm[v]));
    showTvm(s, v, s.marks.tvm?.[v] ?? null);
    return true;
  }
  // any other key cancels STO/RCL and then acts normally
  s.prefix = null;
  return false;
}

/* ---------- TVM keys ---------- */

function showTvm(s: State, v: TvmVar, mark: Mark | null): void {
  if (s.mode === 'std') {
    s.label = v;
    s.labelMark = mark;
  } else {
    // PRD: worksheet modes show only the value.
    s.valueOnly = true;
  }
}

/**
 * N, I/Y, PV, PMT, FV store the displayed value from any mode.
 * FLAG (not in PRD): storing clears pending math.
 */
function storeTvmKey(s: State, v: TvmVar): void {
  const val = x(s);
  s.ws.tvm[v] = ser(val);
  s.marks.tvm = invalidate(s.marks.tvm);
  s.marks.tvm[v] = 'entered';
  s.frames = [{ vals: [], ops: [] }];
  setX(s, val);
  s.lastAns = s.x;
  showTvm(s, v, 'entered');
}

/** CPT then a TVM key computes it (standard mode only). */
function computeTvmKey(s: State, v: TvmVar): void {
  const val = ser(computeTvm(s, v));
  s.ws.tvm[v] = val;
  s.marks.tvm = s.marks.tvm ?? {};
  s.marks.tvm[v] = 'computed';
  s.frames = [{ vals: [], ops: [] }];
  setX(s, new Dec(val));
  s.lastAns = val;
  showTvm(s, v, 'computed');
}

function invalidate(marks: Record<string, Mark> | undefined): Record<string, Mark> {
  const out: Record<string, Mark> = {};
  for (const [k, m] of Object.entries(marks ?? {})) if (m === 'entered') out[k] = m;
  return out;
}

/* ---------- worksheets ---------- */

export function worksheetDef(s: State): WorksheetDef | null {
  return s.mode === 'std' ? null : WORKSHEETS[s.mode];
}

export function markGroup(def: WorksheetDef): string {
  return def.markGroup ?? def.id;
}

export function currentVar(s: State): { def: WorksheetDef; vars: VarDef[]; v: VarDef; index: number } | null {
  const def = worksheetDef(s);
  if (!def) return null;
  const vars = def.vars(s);
  let index = vars.findIndex((v) => v.id === s.nav[def.id]);
  if (index < 0) index = 0;
  return { def, vars, v: vars[index], index };
}

function groupMarks(s: State, def: WorksheetDef): Record<string, Mark> {
  const g = markGroup(def) as WsId;
  s.marks[g] = s.marks[g] ?? {};
  return s.marks[g]!;
}

function resetMath(s: State): void {
  s.frames = [{ vals: [], ops: [] }];
  s.entry = null;
  s.opJustPressed = false;
  s.kPending = null;
  s.memOp = null;
}

/** Show the current variable: auto-compute variables compute when scrolled to. */
function viewVar(s: State): void {
  const cur = currentVar(s)!;
  const { def, v } = cur;
  s.nav[def.id] = v.id;
  if (v.kind === 'auto' && v.compute) {
    v.compute(s);
    groupMarks(s, def)[v.id] = 'computed';
    const val = v.get(s);
    if (typeof val === 'string') s.lastAns = val;
  }
  const val = v.get(s);
  s.x = typeof val === 'string' ? val : '0';
  s.entry = null;
  s.scratch = false;
  s.opJustPressed = false;
}

/** FLAG (not in PRD): opening a worksheet always starts at its first variable. */
function enterWorksheet(s: State, id: WsId): void {
  resetMath(s);
  s.mode = id;
  s.cptArmed = false;
  const def = WORKSHEETS[id];
  s.nav[id] = def.vars(s)[0].id;
  viewVar(s);
}

function move(s: State, dir: 1 | -1): void {
  const cur = currentVar(s);
  if (!cur) return;
  resetMath(s);
  const { def, vars, index } = cur;
  // FLAG (not in PRD): scrolling wraps around at either end.
  const next = vars[(index + dir + vars.length) % vars.length];
  s.nav[def.id] = next.id;
  viewVar(s);
}

/** FLAG (not in PRD): ENTER stores the displayed value and discards pending math. */
function enterKey(s: State): void {
  const cur = currentVar(s);
  const enter = cur?.v.enter;
  if (!cur || !enter) return;
  const { def, v } = cur;
  let val = x(s);
  if (s.mode === 'mem' && s.memOp) {
    const n = Number(v.id.slice(1));
    val = binary(s.memOp, new Dec(s.mem[n]), val);
  }
  enter(s, val);
  const marks = groupMarks(s, def);
  const kept = invalidate(marks);
  kept[v.id] = 'entered';
  s.marks[markGroup(def) as WsId] = kept;
  if (v.type !== 'date') s.lastAns = ser(val);
  resetMath(s);
  viewVar(s);
}

/** Variables whose CPT advances an input instead of computing a result. */
const ADVANCE_VARS = new Set(['P1', 'P2', 'YR']);

function cptKey(s: State): void {
  const cur = currentVar(s);
  if (!cur) {
    s.cptArmed = true;
    return;
  }
  const { def, v } = cur;
  if (!v.compute || v.kind === 'enter') return;
  v.compute(s);
  const marks = groupMarks(s, def);
  if (ADVANCE_VARS.has(v.id)) {
    s.marks[markGroup(def) as WsId] = invalidate(marks);
  } else {
    marks[v.id] = 'computed';
  }
  const val = v.get(s);
  if (typeof val === 'string') s.lastAns = val;
  resetMath(s);
  viewVar(s);
}

function setKey(s: State): void {
  const cur = currentVar(s);
  if (!cur || !cur.v.cycle) return;
  cur.v.cycle(s);
  s.marks[markGroup(cur.def) as WsId] = invalidate(groupMarks(s, cur.def));
  resetMath(s);
  viewVar(s);
}

function insDel(s: State, fn: 'INS' | 'DEL'): void {
  const cur = currentVar(s);
  if (!cur || !cur.v.insDel) return;
  const handler = fn === 'INS' ? cur.def.ins : cur.def.del;
  if (!handler) return;
  handler(s, cur.v.id);
  s.marks[markGroup(cur.def) as WsId] = {};
  resetMath(s);
  viewVar(s);
}

function clearWork(s: State): void {
  const def = worksheetDef(s);
  if (!def) return;
  def.clear(s);
  s.marks[markGroup(def) as WsId] = {};
  resetMath(s);
  viewVar(s);
}

function quit(s: State): void {
  resetMath(s);
  s.mode = 'std';
  s.cptArmed = false;
  s.label = null;
  s.labelMark = null;
  s.x = '0';
  s.scratch = false;
}

/* ---------- clearing ---------- */

/**
 * CE|C: first press clears the entry (or error); a press with nothing being
 * keyed clears the pending calculation.
 * FLAG (not in PRD): in a worksheet, CE|C also returns to the variable's value.
 */
function clearEntry(s: State): void {
  s.prefix = null;
  s.cptArmed = false;
  if (s.mode !== 'std') {
    resetMath(s);
    viewVar(s);
    return;
  }
  if (s.entry !== null) {
    s.entry = null;
    s.x = '0';
    return;
  }
  resetMath(s);
  s.x = '0';
}

function clearError(s: State): void {
  s.error = null;
  s.entry = null;
  if (s.mode === 'std') s.x = '0';
  else {
    resetMath(s);
    viewVar(s);
  }
}

/**
 * ON|OFF: clears display, error and pending math; keeps everything else.
 * FLAG (not in PRD): it also returns to standard mode.
 */
function onOff(s: State): void {
  resetMath(s);
  s.error = null;
  s.second = false;
  s.inv = false;
  s.hyp = false;
  s.prefix = null;
  s.cptArmed = false;
  s.resetPrompt = false;
  s.mode = 'std';
  s.label = null;
  s.labelMark = null;
  s.valueOnly = false;
  s.scratch = false;
  s.x = '0';
}

/** 2ND RESET, ENTER: everything back to defaults; shows RST 0.00. */
function doReset(s: State): void {
  const fresh = initialState();
  for (const k of Object.keys(s) as (keyof State)[]) delete (s as Partial<State>)[k];
  Object.assign(s, fresh);
  s.label = 'RST';
}
