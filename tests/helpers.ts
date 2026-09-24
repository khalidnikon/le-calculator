import { display, run, initialState, type State } from '../src/engine';

/** Replay a keystroke script and return "LABEL= value" the way the display shows it. */
export function screen(script: string, state: State = initialState()): string {
  const d = display(run(script, state));
  const label = d.label ? `${d.label}${d.assigned ? '=' : ''} ` : '';
  return `${label}${d.weekday ? d.weekday + ' ' : ''}${d.value}`.trim();
}

export function value(script: string, state: State = initialState()): string {
  return display(run(script, state)).value;
}
