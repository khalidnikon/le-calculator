import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { display, parseScript, PRIMARY_LABEL, SECOND_FNS, SECOND_LABEL, type Key } from '../engine';
import { Display } from './Display';
import { EngineHost } from './engineHost';
import { Keypad } from './Keypad';
import { CHEAT_SHEET, KEYBOARD_MAP } from './keyboard';

const LOG_PREF_KEY = 'le-calculator/log-open';

function readPref(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writePref(key: string, on: boolean): void {
  try {
    localStorage.setItem(key, on ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export function App() {
  const host = useMemo(() => new EngineHost(), []);
  const snapshot = useSyncExternalStore(
    useCallback((fn) => host.subscribe(fn), [host]),
    () => host.state,
  );
  useSyncExternalStore(
    useCallback((fn) => host.subscribe(fn), [host]),
    () => host.busyVisible,
  );
  const model = display(snapshot);

  const [log, setLog] = useState<string[]>([]);
  const [logOpen, setLogOpen] = useState(() => readPref(LOG_PREF_KEY));
  const [helpOpen, setHelpOpen] = useState(false);
  const [script, setScript] = useState('');
  const pending2nd = useRef(false);

  const onKey = useCallback(
    (k: Key) => {
      const armed = host.state.second && k !== '2ND';
      const second = (SECOND_FNS as Partial<Record<Key, keyof typeof SECOND_LABEL>>)[k];
      setLog((l) => {
        if (k === '2ND') return [...l, '2ND'];
        const name = armed && second ? SECOND_LABEL[second] : PRIMARY_LABEL[k];
        return [...l, name].slice(-500);
      });
      return host.press(k);
    },
    [host],
  );

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if ((e.target as HTMLElement)?.closest?.('textarea, input')) return;
      if (e.key === 'Shift') {
        pending2nd.current = !e.repeat;
        return;
      }
      pending2nd.current = false;
      if (e.key === '?') {
        e.preventDefault();
        setHelpOpen((o) => !o);
        return;
      }
      if (helpOpen && e.key === 'Escape') {
        setHelpOpen(false);
        return;
      }
      const k = KEYBOARD_MAP[e.key];
      if (!k) return;
      if (e.repeat && k !== 'UP' && k !== 'DOWN') return;
      e.preventDefault();
      void onKey(k);
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift' && pending2nd.current) {
        pending2nd.current = false;
        void onKey('2ND');
      }
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, [onKey, helpOpen]);

  const replay = async () => {
    let keys: Key[];
    try {
      keys = parseScript(script);
    } catch (err) {
      alert(String(err instanceof Error ? err.message : err));
      return;
    }
    for (const k of keys) await onKey(k);
  };

  const toggleLog = () => {
    setLogOpen((o) => {
      writePref(LOG_PREF_KEY, !o);
      return !o;
    });
  };

  return (
    <main className="shell">
      <section className="calc" aria-label="Financial calculator">
        <header className="brand">
          <span className="brand-name">LEDGER·12</span>
          <span className="brand-sub">financial</span>
        </header>
        <Display model={model} busy={host.busyVisible} />
        <Keypad onKey={(k) => void onKey(k)} armed={snapshot.second} />
      </section>

      <nav className="toolbar" aria-label="Tools">
        <button type="button" onClick={() => setHelpOpen(true)}>Shortcuts ?</button>
        <button type="button" aria-pressed={logOpen} onClick={toggleLog}>Keystroke log</button>
      </nav>

      {logOpen && (
        <aside className="log" aria-label="Keystroke log">
          <div className="log-head">
            <strong>Keystrokes</strong>
            <button type="button" onClick={() => setLog([])}>Clear</button>
            <button type="button" onClick={() => void navigator.clipboard?.writeText(log.join(' '))}>Copy</button>
          </div>
          <p className="log-body" data-testid="log">{log.join(' ') || '—'}</p>
          <label className="log-replay">
            <span>Replay a script (e.g. <code>P/Y 12 ENTER QUIT 360 N</code>)</span>
            <textarea value={script} onChange={(e) => setScript(e.target.value)} rows={3} />
          </label>
          <button type="button" onClick={() => void replay()}>Replay</button>
        </aside>
      )}

      {helpOpen && (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" onClick={() => setHelpOpen(false)}>
          <div className="overlay-card" onClick={(e) => e.stopPropagation()}>
            <h2>Keyboard shortcuts</h2>
            <table>
              <tbody>
                {CHEAT_SHEET.map(([k, what]) => (
                  <tr key={k}>
                    <th scope="row"><kbd>{k}</kbd></th>
                    <td>{what}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button type="button" onClick={() => setHelpOpen(false)}>Close</button>
          </div>
        </div>
      )}
    </main>
  );
}
