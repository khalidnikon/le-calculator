import type { Key } from '../engine';

/** PRD desktop shortcuts, plus a few letter keys listed in the cheat sheet. */
export const KEYBOARD_MAP: Record<string, Key> = {
  '0': 'D0', '1': 'D1', '2': 'D2', '3': 'D3', '4': 'D4',
  '5': 'D5', '6': 'D6', '7': 'D7', '8': 'D8', '9': 'D9',
  '.': 'DOT', ',': 'DOT',
  '+': 'ADD', '-': 'SUB', '*': 'MUL', '/': 'DIV',
  '(': 'LPAREN', ')': 'RPAREN',
  Enter: 'EQ', '=': 'EQ',
  Backspace: 'BKSP',
  Escape: 'CEC',
  ArrowUp: 'UP', ArrowDown: 'DOWN',
  '%': 'PCT', '^': 'YX',
  c: 'CPT', e: 'ENTER',
  n: 'N', i: 'IY', v: 'PV', m: 'PMT', f: 'FV',
  s: 'STO', r: 'RCL', o: 'ONOFF',
};

export const CHEAT_SHEET: [string, string][] = [
  ['0–9  .', 'digits, decimal point'],
  ['+ − * /', '+ − × ÷'],
  ['( )', 'parentheses'],
  ['Enter  =', '='],
  ['Backspace', '→ (delete last digit)'],
  ['Esc', 'CE|C'],
  ['↑ ↓', 'worksheet arrows'],
  ['Shift (tap alone)', '2ND'],
  ['%  ^', '%  yˣ'],
  ['c / e', 'CPT / ENTER'],
  ['n i v m f', 'N  I/Y  PV  PMT  FV'],
  ['s / r', 'STO / RCL'],
  ['o', 'ON|OFF'],
  ['?', 'this help'],
];
