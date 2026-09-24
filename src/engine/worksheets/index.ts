import type { WsId } from '../state';
import { amortWorksheet } from './amort';
import { bondWorksheet } from './bond';
import { cfWorksheet, irrWorksheet, npvWorksheet } from './cashflow';
import { deprWorksheet } from './depr';
import { dateWorksheet, formatWorksheet, memWorksheet } from './misc';
import { brkevnWorksheet, iconvWorksheet, pctWorksheet, profitWorksheet } from './simple';
import { dataWorksheet, statWorksheet } from './stat';
import { bgnWorksheet, pyWorksheet } from './tvm';
import type { WorksheetDef } from './types';

export const WORKSHEETS: Record<WsId, WorksheetDef> = {
  py: pyWorksheet,
  bgn: bgnWorksheet,
  amort: amortWorksheet,
  cf: cfWorksheet,
  npv: npvWorksheet,
  irr: irrWorksheet,
  bond: bondWorksheet,
  depr: deprWorksheet,
  data: dataWorksheet,
  stat: statWorksheet,
  pct: pctWorksheet,
  iconv: iconvWorksheet,
  date: dateWorksheet,
  profit: profitWorksheet,
  brkevn: brkevnWorksheet,
  mem: memWorksheet,
  format: formatWorksheet,
};

export type { VarDef, WorksheetDef } from './types';
