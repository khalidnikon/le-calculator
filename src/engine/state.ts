import { dateToDays } from './dates';

export type BinOp = 'ADD' | 'SUB' | 'MUL' | 'DIV' | 'YX' | 'NCR' | 'NPR';

/** One parenthesis level of pending math. `vals.length === ops.length` while awaiting an operand. */
export interface Frame {
  vals: string[];
  ops: BinOp[];
}

export type WsId =
  | 'py' | 'bgn' | 'amort' | 'cf' | 'npv' | 'irr' | 'bond' | 'depr'
  | 'data' | 'stat' | 'pct' | 'iconv' | 'date' | 'profit' | 'brkevn'
  | 'mem' | 'format';

export type Mark = 'entered' | 'computed';

export interface Formats {
  /** 0–8 fixed; 9 = floating. */
  dec: number;
  angle: 'DEG' | 'RAD';
  date: 'US' | 'EUR';
  sep: 'US' | 'EUR';
  calc: 'CHN' | 'AOS';
}

export interface Flow {
  c: string;
  f: string;
}

export interface Point {
  x: string;
  y: string;
}

export type DeprMethod = 'SL' | 'SYD' | 'DB' | 'DBX' | 'SLF' | 'DBF';
export type StatMethod = 'LIN' | 'Ln' | 'EXP' | 'PWR' | '1-V';

export interface WsData {
  tvm: { N: string; IY: string; PV: string; PMT: string; FV: string; PY: string; CY: string; bgn: boolean };
  amort: { P1: string; P2: string; BAL: string; PRN: string; INT: string };
  cf: {
    CF0: string; flows: Flow[];
    I: string; NPV: string; NFV: string; PB: string; DPB: string;
    IRR: string; RI: string; MOD: string;
  };
  bond: {
    SDT: number; CPN: string; RDT: number; RV: string;
    basis: 'ACT' | '360'; freq: 1 | 2;
    YLD: string; PRI: string; AI: string; DUR: string;
  };
  depr: {
    method: DeprMethod; dbPct: string; dbxPct: string;
    LIF: string; M01: string; DT1: number; CST: string; SAL: string; YR: string;
    DEP: string; RBV: string; RDV: string;
  };
  data: { pts: Point[] };
  stat: {
    method: StatMethod; Xp: string; Yp: string;
    /** last auto-computed statistics, keyed by variable id */
    out: Record<string, string>;
  };
  pct: { OLD: string; NEW: string; PCH: string; PD: string };
  iconv: { NOM: string; EFF: string; CY: string };
  date: { DT1: number; DT2: number; DBD: string; basis: 'ACT' | '360' };
  profit: { CST: string; SEL: string; MAR: string };
  brkevn: { FC: string; VC: string; P: string; PFT: string; Q: string };
}

export interface ConstantK {
  op: BinOp;
  c: string;
  pct: boolean;
}

export interface State {
  v: 1;
  fmt: Formats;

  /** Modifiers */
  second: boolean;
  inv: boolean;
  hyp: boolean;

  /** Current display value (13-digit decimal string). */
  x: string;
  /** Raw keyed digits while a number is being typed, else null. */
  entry: string | null;
  error: number | null;

  mode: 'std' | WsId;
  /** Standard-mode label (e.g. "PMT" after storing/computing a TVM value, "RST"). */
  label: string | null;
  labelMark: Mark | null;
  /** Worksheet-mode TVM store/recall shows only the value until the next key. */
  valueOnly: boolean;
  /** Worksheet mode: the display shows x (typing or math) instead of the variable's stored value. */
  scratch: boolean;

  cptArmed: boolean;
  frames: Frame[];
  /** The previous key was a binary operator (another operator replaces it). */
  opJustPressed: boolean;

  lastAns: string;
  mem: string[];
  prefix: null | { kind: 'STO' | 'RCL'; op: BinOp | null };

  /** 2ND K was pressed and we are waiting for c then =. */
  kPending: null | { op: BinOp; pct: boolean; c: string | null };
  constant: ConstantK | null;

  /** RAND generator state (uint32). */
  rand: number;

  resetPrompt: boolean;

  ws: WsData;
  /** Current variable id per worksheet. */
  nav: Partial<Record<WsId, string>>;
  marks: Partial<Record<WsId | 'tvm', Record<string, Mark>>>;
  /** Pending memory-arithmetic operator in the Memory worksheet. */
  memOp: BinOp | null;
}

export const DEFAULT_DATE = dateToDays(1990, 12, 31);

export function defaultWs(): WsData {
  return {
    tvm: { N: '0', IY: '0', PV: '0', PMT: '0', FV: '0', PY: '1', CY: '1', bgn: false },
    amort: { P1: '1', P2: '1', BAL: '0', PRN: '0', INT: '0' },
    // FLAG (PRD Open items → Cash Flow defaults): guidebook does not list them; all 0.
    cf: {
      CF0: '0', flows: [],
      I: '0', NPV: '0', NFV: '0', PB: '0', DPB: '0',
      IRR: '0', RI: '0', MOD: '0',
    },
    bond: {
      SDT: DEFAULT_DATE, CPN: '0', RDT: DEFAULT_DATE, RV: '100',
      basis: 'ACT', freq: 2, YLD: '0', PRI: '0', AI: '0', DUR: '0',
    },
    depr: {
      method: 'SL', dbPct: '200', dbxPct: '200',
      // FLAG (not in PRD): DT1 default for SLF is not stated; we use 12-31-1990 like the Date worksheet.
      LIF: '1', M01: '1', DT1: DEFAULT_DATE, CST: '0', SAL: '0', YR: '1',
      DEP: '0', RBV: '0', RDV: '0',
    },
    data: { pts: [] },
    stat: { method: 'LIN', Xp: '0', Yp: '0', out: {} },
    // FLAG (PRD Open items → % Change #PD default): we use 1.
    pct: { OLD: '0', NEW: '0', PCH: '0', PD: '1' },
    iconv: { NOM: '0', EFF: '0', CY: '1' },
    date: { DT1: DEFAULT_DATE, DT2: DEFAULT_DATE, DBD: '0', basis: 'ACT' },
    profit: { CST: '0', SEL: '0', MAR: '0' },
    brkevn: { FC: '0', VC: '0', P: '0', PFT: '0', Q: '0' },
  };
}

export function defaultFormats(): Formats {
  return { dec: 2, angle: 'DEG', date: 'US', sep: 'US', calc: 'CHN' };
}

export function initialState(): State {
  return {
    v: 1,
    fmt: defaultFormats(),
    second: false,
    inv: false,
    hyp: false,
    x: '0',
    entry: null,
    error: null,
    mode: 'std',
    label: null,
    labelMark: null,
    valueOnly: false,
    scratch: false,
    cptArmed: false,
    frames: [{ vals: [], ops: [] }],
    opJustPressed: false,
    lastAns: '0',
    mem: Array.from({ length: 10 }, () => '0'),
    prefix: null,
    kPending: null,
    constant: null,
    // FLAG (not in PRD): RAND seed default and algorithm are not documented.
    rand: 0x2545f491,
    resetPrompt: false,
    ws: defaultWs(),
    nav: {},
    marks: {},
    memOp: null,
  };
}
