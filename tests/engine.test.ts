import { describe, expect, it } from 'vitest';
import { display, initialState, press, run } from '../src/engine';
import { screen, value } from './helpers';

describe('number entry and display', () => {
  it('shows keyed digits as typed', () => {
    expect(value('1234.5')).toBe('1,234.5');
    expect(value('0.')).toBe('0.');
  });
  it('limits entry to 10 digits', () => {
    expect(value('12345678901')).toBe('1,234,567,890');
  });
  it('backspace deletes the last keyed digit', () => {
    expect(value('123 →')).toBe('12');
    expect(value('1 → →')).toBe('0.00');
  });
  it('+|− toggles sign during entry', () => {
    expect(value('5 +/-')).toBe('-5');
    expect(value('5 +/- +/-')).toBe('5');
  });
  it('switches to scientific notation beyond 10 digits', () => {
    expect(value('99999 × 99999 × 99 =')).toBe('9.90 11');
  });
});

describe('formats change display only', () => {
  it('DEC 4 shows more places, stored value unchanged', () => {
    const s = run('FORMAT 4 ENTER QUIT 2 ÷ 3 =');
    expect(display(s).value).toBe('0.6667');
    expect(s.x).toBe('0.6666666666667');
  });
  it('DEC 9 is floating', () => {
    expect(value('FORMAT 9 ENTER QUIT 1 ÷ 8 =')).toBe('0.125');
    expect(value('FORMAT 9 ENTER QUIT 2 ÷ 3 =')).toBe('0.666666667');
  });
  it('Eur separators', () => {
    expect(value('FORMAT ↓ ↓ ↓ SET QUIT 1234567.891')).toBe('1.234.567,891');
    expect(value('FORMAT ↓ ↓ ↓ SET QUIT 1234567.891 =')).toBe('1.234.567,89');
  });
  it('stored values keep 13 significant digits', () => {
    expect(run('2 ÷ 3 =').x).toBe('0.6666666666667');
  });
});

describe('math', () => {
  it('Chn evaluates left to right, AOS by priority', () => {
    expect(value('2 + 3 yˣ 2 =')).toBe('25.00');
    expect(value('FORMAT ↓ ↓ ↓ ↓ SET QUIT 2 + 3 yˣ 2 =')).toBe('11.00');
  });
  it('= closes all open parentheses', () => {
    expect(value('2 × ( 3 + ( 4 × 5 =')).toBe('46.00');
  });
  it('parentheses in Chn', () => {
    expect(value('2 × ( 3 + 4 ) =')).toBe('14.00');
  });
  it('unary functions', () => {
    expect(value('5 x²')).toBe('25.00');
    expect(value('16 √x')).toBe('4.00');
    expect(value('4 1/x')).toBe('0.25');
    expect(value('5 x!')).toBe('120.00');
    expect(value('1 LN')).toBe('0.00');
    expect(value('1 e^x')).toBe('2.72');
    expect(value('10 nPr 3 =')).toBe('720.00');
  });
  it('trig with DEG, RAD, INV and HYP', () => {
    expect(value('30 SIN')).toBe('0.50');
    expect(value('0.5 INV SIN')).toBe('30.00');
    expect(value('90 COS')).toBe('0.00');
    expect(value('1 HYP SIN')).toBe('1.18');
    expect(value('FORMAT ↓ SET QUIT 1 SIN')).toBe('0.84');
    expect(value('180 SIN')).toBe('0.00');
  });
  it('percent', () => {
    expect(value('453 × 4 % =')).toBe('18.12');
    expect(value('453 + 4 % =')).toBe('471.12');
    expect(value('50 %')).toBe('0.50');
  });
  it('ROUND replaces the stored value with the displayed one', () => {
    const s = run('2 ÷ 3 = ROUND');
    expect(s.x).toBe('0.67');
    expect(value('2 ÷ 3 = ROUND × 3 =')).toBe('2.01');
  });
  it('ANS recalls the last answer', () => {
    expect(value('3 + 4 = CE/C ANS')).toBe('7.00');
  });
  it('RAND is seeded with STO RAND', () => {
    const a = value('FORMAT 9 ENTER QUIT 5 STO RAND RAND');
    const b = value('FORMAT 9 ENTER QUIT 5 STO RAND RAND');
    expect(a).toBe(b);
    expect(Number(a)).toBeGreaterThanOrEqual(0);
    expect(Number(a)).toBeLessThan(1);
  });
  it('CE/C: first press clears the entry, second clears pending math', () => {
    expect(value('3 + 4 CE/C 5 =')).toBe('8.00');
    expect(value('3 + 4 CE/C CE/C 5 =')).toBe('5.00');
  });
  it('2ND is one-shot and pressing it again cancels', () => {
    expect(display(run('2ND')).ind.second).toBe(true);
    expect(display(run('2ND 2ND')).ind.second).toBe(false);
  });
});

describe('memory', () => {
  it('STO and RCL', () => {
    expect(value('42 STO 3 CE/C RCL 3')).toBe('42.00');
  });
  it('memory arithmetic changes only memory, not display or pending math', () => {
    const s = run('10 STO 1 2 + 5 STO + 1');
    expect(s.mem[1]).toBe('15');
    expect(display(s).value).toBe('5.00');
    expect(display(run('= ', s)).value).toBe('7.00');
  });
  it('memory worksheet: ENTER stores, op then ENTER does arithmetic', () => {
    const s = run('MEM ↓ ↓ 7 ENTER × 3 ENTER');
    expect(s.mem[2]).toBe('21');
    expect(screen('', s)).toBe('M2= 21.00');
  });
  it('clear all memories: 2ND MEM, 2ND CLR WORK', () => {
    const s = run('5 STO 4 MEM CLR_WORK');
    expect(s.mem.every((m) => m === '0')).toBe(true);
  });
});

describe('constant (2ND K)', () => {
  it('n × K c = then each value =', () => {
    const s = run('3 × K 5 =');
    expect(display(s).value).toBe('15.00');
    expect(value('4 =', s)).toBe('20.00');
    expect(value('4 = 6 =', s)).toBe('30.00');
  });
  it('any other key clears the constant', () => {
    const s = run('3 × K 5 = 4 = √x 9 =');
    expect(display(s).value).toBe('9.00');
  });
  it('add-on percent form', () => {
    const s = run('100 + K 10 % =');
    expect(display(s).value).toBe('110.00');
    expect(value('200 =', s)).toBe('220.00');
  });
});

describe('TVM', () => {
  it('setting P/Y also sets C/Y', () => {
    expect(screen('P/Y 12 ENTER ↓')).toBe('C/Y= 12.00');
  });
  it('2ND CLR TVM resets only the five TVM values', () => {
    const s = run('P/Y 12 ENTER QUIT 360 N 5 PV CLR_TVM');
    expect(s.ws.tvm).toMatchObject({ N: '0', PV: '0', PY: '12', CY: '12' });
  });
  it('xP/Y multiplies the display by P/Y', () => {
    expect(screen('P/Y 12 ENTER QUIT 30 xP/Y N')).toBe('N= 360.00');
  });
  it('RCL shows the label in standard mode, only the value in worksheets', () => {
    expect(screen('360 N CE/C RCL N')).toBe('N= 360.00');
    expect(screen('360 N DATE RCL N')).toBe('360.00');
  });
  it('BGN indicator', () => {
    expect(display(run('BGN SET QUIT')).ind.bgn).toBe(true);
  });
  it('PMT with I/Y = 0', () => {
    expect(screen('10 N 0 I/Y 1000 PV 0 FV CPT PMT')).toBe('PMT= -100.00');
  });
  it('N', () => {
    expect(screen('P/Y 12 ENTER QUIT 5.5 I/Y 75000 PV 425.84 +/- PMT 0 FV CPT N')).toBe('N= 360.00');
  });
  it('FV', () => {
    expect(screen('10 N 5 I/Y 100 +/- PV 0 PMT CPT FV')).toBe('FV= 162.89');
  });
});

describe('amortization', () => {
  const loan = 'P/Y 12 ENTER QUIT 360 N 6.125 I/Y 120000 PV 0 FV CPT PMT';
  it('PRN and INT for payments 1–9', () => {
    const s = run(`${loan} AMORT 1 ENTER ↓ 9 ENTER ↓`);
    expect(screen('↓', s)).toBe('PRN= -1,071.37');
    expect(screen('↓ ↓', s)).toBe('INT= -5,490.80');
  });
  it('CPT on P1 advances the range by its own length', () => {
    const s = run(`${loan} AMORT 1 ENTER ↓ 12 ENTER ↑ CPT`);
    expect(s.ws.amort).toMatchObject({ P1: '13', P2: '24' });
  });
});

describe('cash flow worksheet', () => {
  it('INS and DEL shift later flows', () => {
    let s = run('CF 100 +/- ENTER ↓ 10 ENTER ↓ ↓ 20 ENTER ↑ ↑ INS 5 ENTER');
    expect(s.ws.cf.flows.map((f) => f.c)).toEqual(['5', '10', '20']);
    s = run('DEL', s);
    expect(s.ws.cf.flows.map((f) => f.c)).toEqual(['10', '20']);
  });
  it('NFV and PB', () => {
    const s = run('CF 1000 +/- ENTER ↓ 400 ENTER ↓ 3 ENTER NPV 0 ENTER ↓ CPT');
    expect(screen('', s)).toBe('NPV= 200.00');
    expect(screen('↓ ↓', s)).toBe('PB= 2.50');
  });
  it('MOD', () => {
    const s = run('CF 1000 +/- ENTER ↓ 600 ENTER ↓ 2 ENTER NPV 10 ENTER IRR ↓ 10 ENTER ↓');
    // FV of 600, 600 at 10% = 1,260; (1260/1000)^(1/2) − 1 = 12.25%
    expect(screen('', s)).toBe('MOD= 12.25');
  });
});

describe('statistics', () => {
  const data = 'DATA 1 ENTER ↓ 2 ENTER ↓ 2 ENTER ↓ 4 ENTER ↓ 3 ENTER ↓ 6 ENTER';
  it('LIN regression', () => {
    const s = run(`${data} STAT`);
    expect(screen('')).toBe('0.00');
    expect(screen('↓', s)).toBe('n= 3.00');
    expect(screen('↓ ↓ ↓ ↓ ↓ ↓ ↓ ↓ ↓', s)).toBe('b= 2.00');
    expect(screen('↓ ↓ ↓ ↓ ↓ ↓ ↓ ↓ ↓ ↓', s)).toBe('r= 1.00');
    expect(screen("↓ ↓ ↓ ↓ ↓ ↓ ↓ ↓ ↓ ↓ ↓ 10 ENTER ↓ CPT", s)).toBe("Y'= 20.00");
  });
  it('1-V uses Y as frequency and hides two-variable results', () => {
    const s = run('DATA 5 ENTER ↓ 3 ENTER STAT SET SET SET SET');
    expect(screen('', s)).toBe('1-V');
    expect(screen('↓', s)).toBe('n= 3.00');
    expect(screen('↓ ↓ ↓ ↓ ↓ ↓', s)).toBe('ΣX²= 75.00');
  });
});

describe('date, profit, breakeven, % change, ICONV', () => {
  it('computed dates show a weekday', () => {
    expect(screen('DATE 9.0403 ENTER ↓ ↓ 58 ENTER ↑ CPT')).toBe('DT2= SAT 11-01-2003');
  });
  it('30/360 day count', () => {
    expect(screen('DATE 9.0403 ENTER ↓ 11.0103 ENTER ↓ ↓ SET ↑ CPT')).toBe('DBD= 57.00');
  });
  it('compound growth with #PD', () => {
    expect(screen('Δ% 100 ENTER ↓ ↓ 10 ENTER ↓ 2 ENTER ↑ ↑ CPT')).toBe('NEW= 121.00');
  });
  it('ICONV NOM from EFF', () => {
    expect(screen('ICONV ↓ 15.87 ENTER ↓ 4 ENTER ↑ ↑ CPT')).toBe('NOM= 15.00');
  });
  it('profit margin', () => {
    expect(screen('PROFIT 100 ENTER ↓ 125 ENTER ↓ CPT')).toBe('MAR= 20.00');
  });
  it('breakeven price', () => {
    expect(screen('BRKEVN 3000 ENTER ↓ 15 ENTER ↓ ↓ 0 ENTER ↓ 600 ENTER ↑ ↑ CPT')).toBe('P= 20.00');
  });
});

describe('depreciation methods', () => {
  const asset = 'DEPR ↓ 5 ENTER ↓ ↓ 10000 ENTER ↓ 1000 ENTER ↓ 1 ENTER ↓';
  it('SL', () => expect(screen(asset)).toBe('DEP= 1,800.00'));
  it('SYD', () => expect(screen(`DEPR SET ${asset.slice(5)}`)).toBe('DEP= 3,000.00'));
  it('DB 200%', () => expect(screen(`DEPR SET SET ${asset.slice(5)}`)).toBe('DEP= 4,000.00'));
  it('RBV and RDV, and CPT on YR increments it', () => {
    const s = run(`${asset} ↑ CPT ↓`);
    expect(s.ws.depr.YR).toBe('2');
    expect(screen('', s)).toBe('DEP= 1,800.00');
    expect(screen('↓', s)).toBe('RBV= 6,400.00');
    expect(screen('↓ ↓', s)).toBe('RDV= 5,400.00');
  });
  it('SLF/DBF only with Eur formats', () => {
    expect(screen('DEPR SET SET SET SET')).toBe('SL');
    expect(screen('FORMAT ↓ ↓ SET DEPR SET SET SET SET')).toBe('SLF');
  });
});

describe('worksheet model', () => {
  it('ENTER, COMPUTE and SET indicators', () => {
    expect(display(run('PROFIT')).ind).toMatchObject({ enter: true, compute: true, set: false });
    expect(display(run('BGN')).ind).toMatchObject({ enter: false, set: true });
    expect(display(run('NPV ↓')).ind).toMatchObject({ enter: false, compute: true });
  });
  it('entered mark after ENTER, computed after CPT; a change clears computed', () => {
    const s = run('PROFIT 100 ENTER ↓ 125 ENTER ↓ CPT');
    expect(display(s).computed).toBe(true);
    expect(display(run('↑ ↑', s)).entered).toBe(true);
    expect(display(run('↑ 90 ENTER ↓ ↓', s)).computed).toBe(false);
  });
  it('arrows wrap around', () => {
    expect(screen('PROFIT ↑')).toBe('MAR= 0.00');
  });
  it('QUIT returns to standard mode and worksheet data persists', () => {
    const s = run('PROFIT 100 ENTER QUIT');
    expect(display(s).value).toBe('0.00');
    expect(screen('PROFIT', s)).toBe('CST= 100.00');
  });
  it('CLR WORK resets the current worksheet only', () => {
    const s = run('PROFIT 100 ENTER QUIT BRKEVN 5 ENTER QUIT PROFIT CLR_WORK');
    expect(s.ws.profit.CST).toBe('0');
    expect(s.ws.brkevn.FC).toBe('5');
  });
  it('math inside a worksheet, then ENTER', () => {
    expect(screen('PROFIT 50 × 2 = ENTER')).toBe('CST= 100.00');
  });
});

describe('reset', () => {
  it('2ND RESET, ENTER restores defaults and shows RST 0.00', () => {
    const s = run('5 STO 1 P/Y 12 ENTER QUIT FORMAT 4 ENTER QUIT RESET');
    expect(screen('', s)).toBe('RST ?');
    const r = run('ENTER', s);
    expect(screen('', r)).toBe('RST 0.00');
    expect(r.mem[1]).toBe('0');
    expect(r.ws.tvm.PY).toBe('1');
    expect(r.fmt.dec).toBe(2);
  });
  it('2ND QUIT cancels', () => {
    const s = run('5 STO 1 RESET QUIT');
    expect(s.mem[1]).toBe('5');
    expect(s.resetPrompt).toBe(false);
  });
});

describe('persistence', () => {
  it('state survives a JSON round trip, including pending math', () => {
    const s = run('3 + ( 4 ×');
    const restored = JSON.parse(JSON.stringify(s));
    expect(value('5 =', restored)).toBe('23.00');
  });
  it('ON|OFF clears display, error and pending math but keeps the rest', () => {
    let s = run('7 STO 2 P/Y 4 ENTER QUIT 3 +');
    s = press(s, 'ONOFF');
    expect(display(s).value).toBe('0.00');
    expect(s.frames).toEqual([{ vals: [], ops: [] }]);
    expect(s.mem[2]).toBe('7');
    expect(s.ws.tvm.PY).toBe('4');
  });
  it('press is pure', () => {
    const s = initialState();
    const snapshot = JSON.stringify(s);
    press(s, 'D5');
    expect(JSON.stringify(s)).toBe(snapshot);
  });
});
