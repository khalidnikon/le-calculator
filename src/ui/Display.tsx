import type { DisplayModel } from '../engine';

const INDICATORS: [keyof DisplayModel['ind'], string][] = [
  ['second', '2nd'],
  ['inv', 'INV'],
  ['hyp', 'HYP'],
  ['compute', 'COMPUTE'],
  ['enter', 'ENTER'],
  ['set', 'SET'],
  ['up', '↑'],
  ['down', '↓'],
  ['del', 'DEL'],
  ['ins', 'INS'],
  ['bgn', 'BGN'],
  ['rad', 'RAD'],
];

export function Display({ model, busy }: { model: DisplayModel; busy: boolean }) {
  const { ind } = model;
  return (
    <div className="lcd" role="status" aria-live="polite" data-testid="display">
      <div className="lcd-indicators">
        {INDICATORS.map(([k, text]) => (
          <span key={k} className={ind[k] ? 'on' : ''} data-ind={k}>
            {text}
          </span>
        ))}
      </div>
      <div className="lcd-main">
        <span className="lcd-label" data-testid="label">
          {model.label}
          {model.assigned ? '=' : ''}
        </span>
        <span className="lcd-marks" aria-hidden="true">
          <span className={model.entered ? 'on' : ''} title="entered">✓</span>
          <span className={model.computed ? 'on' : ''} title="computed">✱</span>
        </span>
        <span className="lcd-value" data-testid="value">
          {busy ? <span className="lcd-busy">working…</span> : (
            <>
              {model.weekday && <span className="lcd-weekday">{model.weekday}</span>}
              {model.value}
            </>
          )}
        </span>
      </div>
    </div>
  );
}
