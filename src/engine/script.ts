import { isKey, SECOND_FNS, type Key } from './keys';
import { press } from './press';
import { initialState, type State } from './state';

/**
 * Keystroke scripts, used by the tests and the replay panel.
 * Tokens are separated by spaces. Numbers expand to digit keys (commas are
 * ignored); a 2ND function name expands to 2ND + its key.
 *   "2ND P/Y 12 ENTER 2ND QUIT 360 N"   or   "P/Y 12 ENTER QUIT 360 N"
 */
const ALIASES: Record<string, Key> = {
  '↑': 'UP', '↓': 'DOWN', 'ON/OFF': 'ONOFF', 'ON|OFF': 'ONOFF',
  '→': 'BKSP', 'I/Y': 'IY', '(': 'LPAREN', ')': 'RPAREN',
  'y^x': 'YX', 'yˣ': 'YX', '÷': 'DIV', '/': 'DIV', '%': 'PCT',
  '√x': 'SQRT', 'x²': 'SQ', 'x^2': 'SQ', '1/x': 'RECIP', '×': 'MUL', '*': 'MUL',
  '-': 'SUB', '−': 'SUB', '+': 'ADD', '=': 'EQ', 'CE/C': 'CEC', 'CE|C': 'CEC',
  '.': 'DOT', '+/-': 'NEG', '+|-': 'NEG', '+|−': 'NEG',
};

const SECOND_ALIASES: Record<string, Key> = {
  'xP/Y': 'N', 'P/Y': 'IY', 'CLR_TVM': 'FV', 'CLRTVM': 'FV', 'nCr': 'DIV', 'nPr': 'MUL',
  'x!': 'RECIP', 'e^x': 'LN', 'eˣ': 'LN', 'Δ%': 'D5', 'CLR_WORK': 'CEC', 'CLRWORK': 'CEC',
};

const SECOND_BY_NAME: Record<string, Key> = Object.fromEntries(
  Object.entries(SECOND_FNS).map(([k, fn]) => [fn, k as Key]),
);

export function parseScript(script: string): Key[] {
  const keys: Key[] = [];
  for (const raw of script.trim().split(/\s+/)) {
    if (!raw) continue;
    const tok = raw.replace(/,/g, '');
    if (/^\d*\.?\d+$|^\d+\.$/.test(tok)) {
      for (const ch of tok) keys.push(ch === '.' ? 'DOT' : (`D${ch}` as Key));
      continue;
    }
    if (tok === '2ND') { keys.push('2ND'); continue; }
    if (ALIASES[raw]) { keys.push(ALIASES[raw]); continue; }
    if (isKey(tok)) { keys.push(tok); continue; }
    const second = SECOND_ALIASES[raw] ?? SECOND_BY_NAME[tok];
    if (second) {
      // "2ND P/Y" and bare "P/Y" both work
      if (keys[keys.length - 1] !== '2ND') keys.push('2ND');
      keys.push(second);
      continue;
    }
    throw new Error(`Unknown token: ${raw}`);
  }
  return keys;
}

export function run(script: string, state: State = initialState()): State {
  return parseScript(script).reduce(press, state);
}
