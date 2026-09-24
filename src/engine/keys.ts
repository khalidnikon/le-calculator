/**
 * Physical keys and their 2ND functions.
 *
 * FLAG (PRD Open items → "Key names"): the TI guidebook's key diagram was not
 * available while building this (the PDF host was unreachable). Key names and
 * the positions in KEY_LAYOUT are a best-effort reconstruction and must be
 * confirmed against the guidebook's key diagram.
 */
export const PHYSICAL_KEYS = [
  'CPT', 'ENTER', 'UP', 'DOWN', 'ONOFF',
  '2ND', 'CF', 'NPV', 'IRR', 'BKSP',
  'N', 'IY', 'PV', 'PMT', 'FV',
  'INV', 'LPAREN', 'RPAREN', 'YX', 'DIV',
  'PCT', 'SQRT', 'SQ', 'RECIP', 'MUL',
  'LN', 'D7', 'D8', 'D9', 'SUB',
  'STO', 'D4', 'D5', 'D6', 'ADD',
  'RCL', 'D1', 'D2', 'D3', 'EQ',
  'CEC', 'D0', 'DOT', 'NEG',
] as const;
export type Key = (typeof PHYSICAL_KEYS)[number];

export const SECOND_FNS = {
  CPT: 'QUIT',
  ENTER: 'SET',
  UP: 'DEL',
  DOWN: 'INS',
  N: 'XPY',
  IY: 'PY',
  PV: 'AMORT',
  PMT: 'BGN',
  FV: 'CLRTVM',
  INV: 'HYP',
  LPAREN: 'SIN',
  RPAREN: 'COS',
  YX: 'TAN',
  DIV: 'NCR',
  PCT: 'K',
  SQRT: 'ROUND',
  SQ: 'RAND',
  RECIP: 'FACT',
  MUL: 'NPR',
  LN: 'EX',
  D7: 'DATA',
  D8: 'STAT',
  D9: 'BOND',
  D4: 'DEPR',
  D5: 'DPCT',
  D6: 'BRKEVN',
  D1: 'DATE',
  D2: 'ICONV',
  D3: 'PROFIT',
  EQ: 'ANS',
  CEC: 'CLRWORK',
  D0: 'MEM',
  DOT: 'FORMAT',
  NEG: 'RESET',
} as const satisfies Partial<Record<Key, string>>;

export type SecondFn = (typeof SECOND_FNS)[keyof typeof SECOND_FNS];
export type Fn = Exclude<Key, '2ND'> | SecondFn;

/** Primary label printed on each key. */
export const PRIMARY_LABEL: Record<Key, string> = {
  CPT: 'CPT', ENTER: 'ENTER', UP: '↑', DOWN: '↓', ONOFF: 'ON|OFF',
  '2ND': '2ND', CF: 'CF', NPV: 'NPV', IRR: 'IRR', BKSP: '→',
  N: 'N', IY: 'I/Y', PV: 'PV', PMT: 'PMT', FV: 'FV',
  INV: 'INV', LPAREN: '(', RPAREN: ')', YX: 'yˣ', DIV: '÷',
  PCT: '%', SQRT: '√x', SQ: 'x²', RECIP: '1/x', MUL: '×',
  LN: 'LN', D7: '7', D8: '8', D9: '9', SUB: '−',
  STO: 'STO', D4: '4', D5: '5', D6: '6', ADD: '+',
  RCL: 'RCL', D1: '1', D2: '2', D3: '3', EQ: '=',
  CEC: 'CE|C', D0: '0', DOT: '.', NEG: '+|−',
};

/** 2ND label printed above each key. */
export const SECOND_LABEL: Record<SecondFn, string> = {
  QUIT: 'QUIT', SET: 'SET', DEL: 'DEL', INS: 'INS',
  XPY: 'xP/Y', PY: 'P/Y', AMORT: 'AMORT', BGN: 'BGN', CLRTVM: 'CLR TVM',
  HYP: 'HYP', SIN: 'SIN', COS: 'COS', TAN: 'TAN', NCR: 'nCr',
  K: 'K', ROUND: 'ROUND', RAND: 'RAND', FACT: 'x!', NPR: 'nPr',
  EX: 'eˣ', DATA: 'DATA', STAT: 'STAT', BOND: 'BOND',
  DEPR: 'DEPR', DPCT: 'Δ%', BRKEVN: 'BRKEVN',
  DATE: 'DATE', ICONV: 'ICONV', PROFIT: 'PROFIT', ANS: 'ANS',
  CLRWORK: 'CLR WORK', MEM: 'MEM', FORMAT: 'FORMAT', RESET: 'RESET',
};

/** Keypad rows (see the flag at the top of this file). */
export const KEY_LAYOUT: Key[][] = [
  ['CPT', 'ENTER', 'UP', 'DOWN', 'ONOFF'],
  ['2ND', 'CF', 'NPV', 'IRR', 'BKSP'],
  ['N', 'IY', 'PV', 'PMT', 'FV'],
  ['INV', 'LPAREN', 'RPAREN', 'YX', 'DIV'],
  ['PCT', 'SQRT', 'SQ', 'RECIP', 'MUL'],
  ['LN', 'D7', 'D8', 'D9', 'SUB'],
  ['STO', 'D4', 'D5', 'D6', 'ADD'],
  ['RCL', 'D1', 'D2', 'D3', 'EQ'],
  ['CEC', 'D0', 'DOT', 'NEG'],
];

export const DIGIT_KEYS: Partial<Record<Key, string>> = {
  D0: '0', D1: '1', D2: '2', D3: '3', D4: '4',
  D5: '5', D6: '6', D7: '7', D8: '8', D9: '9',
};

export function isKey(k: string): k is Key {
  return (PHYSICAL_KEYS as readonly string[]).includes(k);
}
