import { describe, expect, it } from 'vitest';
import { run } from '../src/engine';
import { screen, value } from './helpers';

/**
 * PRD "Golden tests" table. Setups follow the table; keystrokes are ours
 * because the guidebook itself was not available while writing these.
 */
describe('golden: standard calculator', () => {
  it('Chn: 3 + 2 × 4 = 20', () => {
    expect(value('3 + 2 × 4 =')).toBe('20.00');
  });

  it('AOS: 3 + 2 × 4 = 11', () => {
    expect(value('FORMAT ↓ ↓ ↓ ↓ SET QUIT 3 + 2 × 4 =')).toBe('11.00');
  });

  it('rounding: 1 ÷ 3 × 3 = shows 1', () => {
    expect(value('1 ÷ 3 × 3 =')).toBe('1.00');
  });

  it('nCr: 52 nCr 5 = 2,598,960', () => {
    expect(value('52 nCr 5 =')).toBe('2,598,960.00');
  });
});

describe('golden: TVM', () => {
  it('I/Y = 5.50', () => {
    expect(screen('P/Y 12 ENTER QUIT 360 N 75000 PV 425.84 +/- PMT 0 FV CPT I/Y')).toBe('I/Y= 5.50');
  });

  it('PMT = -425.84', () => {
    expect(screen('P/Y 12 ENTER QUIT 360 N 5.5 I/Y 75000 PV 0 FV CPT PMT')).toBe('PMT= -425.84');
  });

  it('annuity due PV = 135,180.48', () => {
    expect(screen('BGN SET QUIT 10 N 10 I/Y 20000 +/- PMT 0 FV CPT PV')).toBe('PV= 135,180.48');
  });

  it('C/Y ≠ P/Y PMT = -203.13', () => {
    expect(screen('P/Y 12 ENTER ↓ 4 ENTER QUIT BGN SET QUIT 120 N 0.5 I/Y 0 PV 25000 FV CPT PMT'))
      .toBe('PMT= -203.13');
  });
});

describe('golden: worksheets', () => {
  it('amortization BAL = 118,928.63', () => {
    const s = run('P/Y 12 ENTER QUIT 360 N 6.125 I/Y 120000 PV 0 FV CPT PMT');
    expect(screen('AMORT 1 ENTER ↓ 9 ENTER ↓', s)).toBe('BAL= 118,928.63');
  });

  const CF_SETUP = 'CF CLR_WORK 7000 +/- ENTER ↓ 3000 ENTER ↓ 1 ENTER ↓ 5000 ENTER ↓ 4 ENTER ↓ 4000 ENTER ↓ 1 ENTER';

  /**
   * PRD Open items: the PRD's summary of this example (CFo −7,000; 3,000×1;
   * 5,000×4; 4,000×1; I 20) does not produce NPV 7,266.44 / IRR 52.71 under
   * the standard NPV formula. Checked independently: those flows give
   * NPV 7,625.99 and IRR 55.63. Re-derive the setup from the guidebook.
   */
  it.fails('cash flow NPV = 7,266.44 and IRR = 52.71 (PRD values; setup unverified)', () => {
    const s = run(CF_SETUP);
    expect(screen('NPV 20 ENTER ↓ CPT', s)).toBe('NPV= 7,266.44');
    expect(screen('IRR CPT', s)).toBe('IRR= 52.71');
  });

  it('cash flow NPV/IRR for the PRD setup match an independent calculation', () => {
    const s = run(CF_SETUP);
    expect(screen('NPV 20 ENTER ↓ CPT', s)).toBe('NPV= 7,625.99');
    expect(screen('IRR CPT', s)).toBe('IRR= 55.63');
  });

  it('bond PRI = 98.56, AI = 3.15, DUR = 1.44', () => {
    // Dates: 6-12-2006 and 12-31-2007 (PRD Open items: guidebook text says 2004/2005).
    const s = run('BOND 6.1206 ENTER ↓ 7 ENTER ↓ 12.3107 ENTER ↓ 100 ENTER ↓ SET ↓ ↓ 8 ENTER ↓ CPT');
    expect(screen('', s)).toBe('PRI= 98.56');
    expect(screen('↓', s)).toBe('AI= 3.15');
    expect(screen('↓ ↓', s)).toBe('DUR= 1.44');
  });

  it('depreciation SL DEP = 25,132.28', () => {
    expect(screen('DEPR ↓ 31.5 ENTER ↓ 3.5 ENTER ↓ 1000000 ENTER ↓ ↓ 1 ENTER ↓'))
      .toBe('DEP= 25,132.28');
  });

  it('% change %CH = 6.38', () => {
    expect(screen('Δ% 658 ENTER ↓ 700 ENTER ↓ CPT')).toBe('%CH= 6.38');
  });

  it('ICONV EFF = 15.87', () => {
    expect(screen('ICONV 15 ENTER ↓ ↓ 4 ENTER ↑ CPT')).toBe('EFF= 15.87');
  });

  it('date DBD = 58.00', () => {
    expect(screen('DATE 9.0403 ENTER ↓ 11.0103 ENTER ↓ CPT')).toBe('DBD= 58.00');
  });

  it('profit CST = 100.00', () => {
    expect(screen('PROFIT ↓ 125 ENTER ↓ 20 ENTER ↑ ↑ CPT')).toBe('CST= 100.00');
  });

  it('breakeven Q = 600.00', () => {
    expect(screen('BRKEVN 3000 ENTER ↓ 15 ENTER ↓ 20 ENTER ↓ 0 ENTER ↓ CPT')).toBe('Q= 600.00');
  });
});
