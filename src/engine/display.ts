import { formatDate, weekday } from './dates';
import { formatEntry, formatNumber } from './format';
import { currentVar, markGroup } from './press';
import type { State, WsId } from './state';
import { TVM_LABEL, type TvmVar } from './worksheets/tvm';

export interface Indicators {
  second: boolean;
  inv: boolean;
  hyp: boolean;
  compute: boolean;
  enter: boolean;
  set: boolean;
  up: boolean;
  down: boolean;
  del: boolean;
  ins: boolean;
  bgn: boolean;
  rad: boolean;
}

export interface DisplayModel {
  /** Variable or status label on the left (may be empty). */
  label: string;
  /** "=" between label and value when a value is assigned. */
  assigned: boolean;
  /** Formatted value on the right. */
  value: string;
  /** Three-letter weekday for a computed date. */
  weekday: string | null;
  /**
   * FLAG (PRD Open items → display): the glyphs for the entered and computed
   * marks are not described in text; the UI renders ✓ and ✱.
   */
  entered: boolean;
  computed: boolean;
  error: boolean;
  ind: Indicators;
}

/** The formatter is the only path from engine state to the screen. */
export function display(s: State): DisplayModel {
  const ind: Indicators = {
    second: s.second,
    inv: s.inv,
    hyp: s.hyp,
    compute: false,
    enter: false,
    set: false,
    up: false,
    down: false,
    del: false,
    ins: false,
    bgn: s.ws.tvm.bgn,
    rad: s.fmt.angle === 'RAD',
  };
  const base = { weekday: null, entered: false, computed: false, error: false, ind };
  const shown = () => (s.entry !== null ? formatEntry(s.entry, s.fmt) : formatNumber(s.x, s.fmt));

  if (s.error !== null) {
    return { ...base, label: '', assigned: false, value: `Error ${s.error}`, error: true };
  }
  if (s.resetPrompt) {
    // FLAG (not in PRD): the reset prompt reads "RST ?" with the ENTER indicator.
    ind.enter = true;
    return { ...base, label: 'RST', assigned: false, value: '?' };
  }

  const cur = currentVar(s);
  if (!cur) {
    ind.compute = s.cptArmed;
    const label = s.label ? (TVM_LABEL[s.label as TvmVar] ?? s.label) : '';
    return {
      ...base,
      label,
      assigned: !!s.label && s.label !== 'RST' && s.entry === null,
      value: shown(),
      entered: s.labelMark === 'entered',
      computed: s.labelMark === 'computed',
    };
  }

  const { def, vars, v } = cur;
  ind.enter = !!v.enter;
  ind.compute = !!v.compute && v.kind !== 'enter';
  ind.set = v.kind === 'setting';
  ind.up = vars.length > 1;
  ind.down = vars.length > 1;
  ind.del = !!v.insDel && !!def.del;
  ind.ins = !!v.insDel && !!def.ins;

  if (s.valueOnly) return { ...base, label: '', assigned: false, value: shown() };

  const mark = s.marks[markGroup(def) as WsId]?.[v.id];
  if (s.scratch) return { ...base, label: v.label, assigned: false, value: shown() };

  const val = v.get(s);
  let value = '';
  let wd: string | null = null;
  if (typeof val === 'number') {
    value = formatDate(val, s.fmt.date);
    if (mark === 'computed') wd = weekday(val);
  } else if (typeof val === 'string') {
    value = formatNumber(val, s.fmt);
  }
  return {
    ...base,
    label: v.label,
    assigned: val !== null,
    value,
    weekday: wd,
    entered: mark === 'entered',
    computed: mark === 'computed',
  };
}
