import type { Decimal } from 'decimal.js';
import { CalcError } from './errors';

/** Dates are stored as whole days since 1970-01-01 (UTC calendar, no time). */
const MS_PER_DAY = 86_400_000;

/** Valid range per PRD (Bond): 1-1-1980 to 12-31-2079. */
export const MIN_YEAR = 1980;
export const MAX_YEAR = 2079;

export interface Ymd {
  y: number;
  m: number;
  d: number;
}

export function dateToDays(y: number, m: number, d: number): number {
  return Math.round(Date.UTC(y, m - 1, d) / MS_PER_DAY);
}

export function daysToYmd(days: number): Ymd {
  const dt = new Date(days * MS_PER_DAY);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function isValidYmd(y: number, m: number, d: number): boolean {
  return Number.isInteger(y) && Number.isInteger(m) && Number.isInteger(d)
    && m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

export function inRange(days: number): boolean {
  const { y } = daysToYmd(days);
  return y >= MIN_YEAR && y <= MAX_YEAR;
}

/**
 * Parse a keyed date: mm.ddyy (US) or dd.mmyy (Eur). Invalid → Error 6.
 * FLAG (not in PRD): two-digit years map 80–99 → 1980–1999 and 00–79 →
 * 2000–2079, which follows from the 1980–2079 range.
 */
export function parseDateEntry(x: Decimal, fmt: 'US' | 'EUR'): number {
  if (x.isNegative() || x.decimalPlaces() > 4) throw new CalcError(6);
  const s = x.toFixed(4);
  const [ip, fp] = s.split('.');
  const a = Number(ip);
  const b = Number(fp.slice(0, 2));
  const yy = Number(fp.slice(2, 4));
  const y = yy >= 80 ? 1900 + yy : 2000 + yy;
  const m = fmt === 'US' ? a : b;
  const d = fmt === 'US' ? b : a;
  if (!isValidYmd(y, m, d)) throw new CalcError(6);
  return dateToDays(y, m, d);
}

export function formatDate(days: number, fmt: 'US' | 'EUR'): string {
  const { y, m, d } = daysToYmd(days);
  const dd = String(d).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  return fmt === 'US' ? `${m}-${dd}-${y}` : `${d}-${mm}-${y}`;
}

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
export function weekday(days: number): string {
  return WEEKDAYS[new Date(days * MS_PER_DAY).getUTCDay()];
}

/**
 * 30/360 day count.
 * FLAG (guidebook formula not available): if D1 is 31 it becomes 30; if D2 is
 * 31 and D1 is 30 or 31, D2 becomes 30. No special February rule.
 */
export function days360(a: number, b: number): number {
  const p = daysToYmd(a);
  const q = daysToYmd(b);
  let d1 = p.d;
  let d2 = q.d;
  if (d1 === 31) d1 = 30;
  if (d2 === 31 && d1 >= 30) d2 = 30;
  return (q.y - p.y) * 360 + (q.m - p.m) * 30 + (d2 - d1);
}

/**
 * Add whole months. When `endOfMonth` is set, the result is pinned to the last
 * day of the target month; otherwise the day is clamped to the month length.
 */
export function addMonths(days: number, months: number, endOfMonth: boolean): number {
  const { y, m, d } = daysToYmd(days);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const last = daysInMonth(ny, nm);
  return dateToDays(ny, nm, endOfMonth ? last : Math.min(d, last));
}

export function isMonthEnd(days: number): boolean {
  const { y, m, d } = daysToYmd(days);
  return d === daysInMonth(y, m);
}
