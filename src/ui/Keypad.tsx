import { useEffect, useRef } from 'react';
import { KEY_LAYOUT, PRIMARY_LABEL, SECOND_FNS, SECOND_LABEL, type Key } from '../engine';

const REPEAT_KEYS = new Set<Key>(['UP', 'DOWN']);
const REPEAT_DELAY_MS = 400;
const REPEAT_EVERY_MS = 110;

function keyClass(k: Key): string {
  if (/^D\d$/.test(k) || k === 'DOT' || k === 'NEG') return 'key digit';
  if (['ADD', 'SUB', 'MUL', 'DIV', 'EQ'].includes(k)) return 'key op';
  if (k === '2ND') return 'key second';
  if (k === 'CPT' || k === 'ENTER') return 'key accent';
  if (k === 'ONOFF' || k === 'CEC') return 'key clear';
  return 'key fn';
}

export function Keypad({ onKey, armed }: { onKey: (k: Key) => void; armed: boolean }) {
  const timers = useRef<{ t?: ReturnType<typeof setTimeout>; i?: ReturnType<typeof setInterval> }>({});
  const stop = () => {
    clearTimeout(timers.current.t);
    clearInterval(timers.current.i);
    timers.current = {};
  };
  useEffect(() => stop, []);

  const down = (k: Key) => {
    try { navigator.vibrate?.(8); } catch { /* not supported */ }
    onKey(k);
    if (REPEAT_KEYS.has(k)) {
      stop();
      timers.current.t = setTimeout(() => {
        timers.current.i = setInterval(() => onKey(k), REPEAT_EVERY_MS);
      }, REPEAT_DELAY_MS);
    }
  };

  return (
    <div className={`keypad${armed ? ' armed' : ''}`}>
      {KEY_LAYOUT.flat().map((k) => {
        const second = (SECOND_FNS as Partial<Record<Key, keyof typeof SECOND_LABEL>>)[k];
        const secondLabel = second ? SECOND_LABEL[second] : '';
        return (
          <div key={k} className={`key-cell${k === 'EQ' ? ' tall' : ''}`}>
            <span className="key-second" aria-hidden="true">{secondLabel}</span>
            <button
              type="button"
              className={keyClass(k)}
              data-key={k}
              aria-label={secondLabel ? `${PRIMARY_LABEL[k]} (2nd: ${secondLabel})` : PRIMARY_LABEL[k]}
              onPointerDown={(e) => {
                e.preventDefault();
                down(k);
              }}
              onPointerUp={stop}
              onPointerLeave={stop}
              onPointerCancel={stop}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                  onKey(k);
                }
              }}
            >
              {PRIMARY_LABEL[k]}
            </button>
          </div>
        );
      })}
    </div>
  );
}
