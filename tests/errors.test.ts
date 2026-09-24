import { describe, expect, it } from 'vitest';
import { cancelled, display, run } from '../src/engine';
import { value } from './helpers';

/** PRD: every error code has at least one test that triggers it. */
describe('Error 1 — overflow / divide by zero', () => {
  it('1 ÷ 0 =', () => expect(value('1 ÷ 0 =')).toBe('Error 1'));
  it('1/x of 0', () => expect(value('0 1/x')).toBe('Error 1'));
  it('result beyond ±9.9999999999999E99', () => expect(value('10 yˣ 99 × 10 =')).toBe('Error 1'));
  it('statistics with all X identical', () => {
    expect(value('DATA 2 ENTER ↓ 3 ENTER ↓ 2 ENTER ↓ 5 ENTER STAT ↓ ↓ ↓ ↓ ↓ ↓ ↓ ↓')).toBe('Error 1');
  });
});

describe('Error 2 — invalid argument', () => {
  it('x! of 70', () => expect(value('70 x!')).toBe('Error 2'));
  it('x! of 2.5', () => expect(value('2.5 x!')).toBe('Error 2'));
  it('LN of 0', () => expect(value('0 LN')).toBe('Error 2'));
  it('√ of a negative', () => expect(value('4 +/- √x')).toBe('Error 2'));
  it('negative y with non-integer x', () => expect(value('8 +/- yˣ 0.5 =')).toBe('Error 2'));
  it('negative y with 1/odd x is allowed', () => expect(value('8 +/- yˣ 3 1/x =')).toBe('-2.00'));
  it('amortization P2 < P1', () => expect(value('AMORT 5 ENTER ↓ 2 ENTER ↓')).toBe('Error 2'));
  it('depreciation SAL > CST', () => {
    expect(value('DEPR ↓ 5 ENTER ↓ ↓ 100 ENTER ↓ 200 ENTER ↓ ↓')).toBe('Error 2');
  });
});

describe('Error 3 — too many pending operations', () => {
  it('more than 15 parenthesis levels', () => {
    expect(value('( ( ( ( ( ( ( ( ( ( ( ( ( ( (')).not.toBe('Error 3');
    expect(value('( ( ( ( ( ( ( ( ( ( ( ( ( ( ( (')).toBe('Error 3');
  });
  it('more than 8 pending operations', () => {
    const eight = '1 + ( 1 + ( 1 + ( 1 + ( 1 + ( 1 + ( 1 + ( 1 +';
    expect(value(eight)).not.toBe('Error 3');
    expect(value(`${eight} ( 1 +`)).toBe('Error 3');
  });
});

describe('Error 4 — out of range', () => {
  it('P/Y ≤ 0', () => expect(value('P/Y 0 ENTER')).toBe('Error 4'));
  it('C/Y ≤ 0', () => expect(value('P/Y ↓ 0 ENTER')).toBe('Error 4'));
  it('P1 outside 1–9,999', () => expect(value('AMORT 10000 ENTER')).toBe('Error 4'));
  it('Fnn outside 0.5–9,999', () => expect(value('CF ↓ 100 ENTER ↓ 0.2 ENTER')).toBe('Error 4'));
  it('bond RV ≤ 0', () => expect(value('BOND ↓ ↓ ↓ 0 ENTER')).toBe('Error 4'));
  it('depreciation LIF ≤ 0', () => expect(value('DEPR ↓ 0 ENTER')).toBe('Error 4'));
  it('depreciation M01 ≥ 13', () => expect(value('DEPR ↓ ↓ 13 ENTER')).toBe('Error 4'));
  it('depreciation CST < 0', () => expect(value('DEPR ↓ ↓ ↓ 5 +/- ENTER')).toBe('Error 4'));
  it('ICONV C/Y ≤ 0', () => expect(value('ICONV ↓ ↓ 0 ENTER')).toBe('Error 4'));
  it('DEC outside 0–9', () => expect(value('FORMAT 10 ENTER')).toBe('Error 4'));
  it('computed date outside 1980–2079', () => {
    expect(value('DATE 1.0180 ENTER ↓ ↓ 10 ENTER ↑ ↑ ↓ CPT')).not.toBe('Error 4');
    expect(value('DATE ↓ 1.0180 ENTER ↓ 10 ENTER ↑ ↑ CPT')).toBe('Error 4');
  });
});

describe('Error 5 — no solution', () => {
  it('TVM I/Y when PV, N×PMT and FV share a sign', () => {
    expect(value('10 N 100 PV 10 PMT 100 FV CPT I/Y')).toBe('Error 5');
  });
  it('TVM N when the log argument is ≤ 0', () => {
    expect(value('10 I/Y 100 PV 1 PMT 100 FV CPT N')).toBe('Error 5');
  });
  it('IRR with no sign change', () => {
    expect(value('CF 100 ENTER ↓ 100 ENTER IRR CPT')).toBe('Error 5');
  });
});

describe('Error 6 — invalid date', () => {
  it('impossible date', () => expect(value('DATE 2.3003 ENTER')).toBe('Error 6'));
  it('bond: scrolling before entering values', () => {
    expect(value('BOND ↓ ↓ ↓ ↓ ↓ ↓ ↓ ↓')).toBe('Error 6');
  });
  it('bond: RDT on or before SDT', () => {
    expect(value('BOND 6.1206 ENTER ↓ 7 ENTER ↓ 6.1205 ENTER ↓ ↓ ↓ ↓ ↓ CPT')).toBe('Error 6');
  });
});

describe('Error 7 — iteration limit / no payback', () => {
  it('PB with no payback', () => {
    expect(value('CF 1000 +/- ENTER ↓ 100 ENTER NPV 10 ENTER ↓ ↓ ↓')).toBe('Error 7');
  });
});

describe('Error 8 — canceled', () => {
  it('ON during an evaluation (worker host calls cancelled())', () => {
    expect(display(cancelled(run('CF'))).value).toBe('Error 8');
  });
});

describe('clearing errors', () => {
  it('CE/C clears the error; other keys are ignored until then', () => {
    expect(value('1 ÷ 0 = 5')).toBe('Error 1');
    expect(value('1 ÷ 0 = CE/C')).toBe('0.00');
    // the first CE/C clears the error only; the second clears the pending 1 ÷
    expect(value('1 ÷ 0 = CE/C 5 =')).toBe('0.20');
    expect(value('1 ÷ 0 = CE/C CE/C 5 + 2 =')).toBe('7.00');
  });
  it('an error leaves stored data untouched', () => {
    const s = run('P/Y 12 ENTER 0 ENTER');
    expect(s.ws.tvm.PY).toBe('12');
  });
});
