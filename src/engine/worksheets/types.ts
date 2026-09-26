import type { Dec } from '../decimal';
import type { State, WsId } from '../state';

/**
 * Shared worksheet model (PRD "Worksheets → Shared model").
 * - enter:   ENTER stores the display value.
 * - compute: CPT computes.
 * - auto:    computes when scrolled to.
 * - both:    enter-or-compute.
 * - setting: cycled with 2ND SET (may also accept ENTER when `enter` is set, e.g. DB %).
 */
export type VarKind = 'enter' | 'compute' | 'auto' | 'both' | 'setting';

export interface VarDef {
  id: string;
  /** Display label; for settings, the current setting text. */
  label: string;
  kind: VarKind;
  /** 'date' values are stored as day numbers and entered as mm.ddyy / dd.mmyy. */
  type?: 'num' | 'date';
  /** Stored value (decimal string or day number) or null for a pure setting. */
  get(s: State): string | number | null;
  enter?(s: State, x: Dec): void;
  compute?(s: State): void;
  cycle?(s: State): void;
  /** CF / DATA rows support 2ND INS and 2ND DEL. */
  insDel?: boolean;
}

export interface WorksheetDef {
  id: WsId;
  vars(s: State): VarDef[];
  /** 2ND CLR WORK */
  clear(s: State): void;
  ins?(s: State, varId: string): void;
  del?(s: State, varId: string): void;
  /**
   * Variables that share marks with this worksheet (CF/NPV/IRR share one data set).
   * Defaults to the worksheet's own id.
   */
  markGroup?: WsId | 'tvm';
}
