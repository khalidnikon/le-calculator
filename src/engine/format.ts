import Decimal from 'decimal.js';
import { Dec } from './decimal';
import type { Formats } from './state';

/** Display width in digits (PRD: "displays up to 10"). */
export const DISPLAY_DIGITS = 10;

/**
 * FLAG (PRD Open items → scientific notation): exact layout is not described.
 * We show the mantissa (at most this many decimals), a space, then the exponent.
 */
export const SCI_MANTISSA_MAX_DECIMALS = 7;

function group(intPart: string, sep: string): string {
  let out = '';
  for (let i = 0; i < intPart.length; i++) {
    const fromEnd = intPart.length - i;
    out += intPart[i];
    if (fromEnd > 1 && fromEnd % 3 === 1) out += sep;
  }
  return out;
}

function withSeparators(plain: string, fmt: Formats): string {
  const neg = plain.startsWith('-');
  const body = neg ? plain.slice(1) : plain;
  const [ip, fp] = body.split('.');
  const thousands = fmt.sep === 'US' ? ',' : '.';
  const point = fmt.sep === 'US' ? '.' : ',';
  let s = group(ip, thousands);
  if (fp !== undefined) s += point + fp;
  return (neg ? '-' : '') + s;
}

function sci(v: Decimal, fmt: Formats): string {
  const md = fmt.dec === 9 ? SCI_MANTISSA_MAX_DECIMALS : Math.min(fmt.dec, SCI_MANTISSA_MAX_DECIMALS);
  let e = v.abs().log(10).floor().toNumber();
  let m = v.div(new Dec(10).pow(e)).toDecimalPlaces(md, Decimal.ROUND_HALF_UP);
  if (m.abs().gte(10)) {
    e += 1;
    m = v.div(new Dec(10).pow(e)).toDecimalPlaces(md, Decimal.ROUND_HALF_UP);
  }
  let ms = fmt.dec === 9 ? trimZeros(m.toFixed(md)) : m.toFixed(md);
  if (fmt.sep === 'EUR') ms = ms.replace('.', ',');
  return `${ms} ${e}`;
}

function trimZeros(s: string): string {
  if (!s.includes('.')) return s;
  s = s.replace(/0+$/, '');
  return s.endsWith('.') ? s.slice(0, -1) : s;
}

/**
 * Format a stored value for the display: round to 10 significant digits
 * (11th digit ≥ 5 rounds up), then to the DEC setting, which never changes
 * the stored value.
 */
export function formatNumber(value: Decimal.Value, fmt: Formats): string {
  const v = new Dec(value);
  const r = v.toSignificantDigits(DISPLAY_DIGITS, Decimal.ROUND_HALF_UP);
  if (r.isZero()) {
    return withSeparators(fmt.dec === 9 ? '0' : new Dec(0).toFixed(fmt.dec), fmt);
  }
  const a = r.abs();
  if (a.gte('1e10') || a.lt('1e-9')) return sci(r, fmt);

  const intDigits = a.gte(1) ? a.trunc().toString().length : 1;
  let plain: string;
  if (fmt.dec === 9) {
    plain = trimZeros(r.toFixed(DISPLAY_DIGITS - intDigits, Decimal.ROUND_HALF_UP));
  } else {
    const dp = Math.min(fmt.dec, DISPLAY_DIGITS - intDigits);
    plain = r.toFixed(dp, Decimal.ROUND_HALF_UP);
  }
  if (/^-0(\.0*)?$/.test(plain)) plain = plain.slice(1);
  return withSeparators(plain, fmt);
}

/** Format the raw digits being keyed (no rounding, no padding). */
export function formatEntry(entry: string, fmt: Formats): string {
  return withSeparators(entry, fmt);
}

/** The value shown after rounding to the display (used by ROUND and depreciation/amortization). */
export function displayedValue(value: Decimal.Value, fmt: Formats): Dec {
  const v = new Dec(value).toSignificantDigits(DISPLAY_DIGITS, Decimal.ROUND_HALF_UP);
  if (fmt.dec === 9) return v;
  return v.toDecimalPlaces(fmt.dec, Decimal.ROUND_HALF_UP);
}
