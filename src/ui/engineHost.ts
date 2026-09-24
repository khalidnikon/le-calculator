import { cancelled, initialState, press, type Key, type State } from '../engine';

export const STORAGE_KEY = 'le-calculator/state/v1';

/** How long a key may run before the UI shows the busy indicator. */
const BUSY_DELAY_MS = 120;

export function loadState(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState();
    const saved = JSON.parse(raw) as State;
    if (saved?.v !== 1) return initialState();
    const base = initialState();
    return { ...base, ...saved, ws: { ...base.ws, ...saved.ws }, fmt: { ...base.fmt, ...saved.fmt } };
  } catch {
    return initialState();
  }
}

export function saveState(s: State): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // storage unavailable (private mode, quota): the calculator still works
  }
}

type Listener = () => void;

/**
 * Owns the engine state on the UI side. Every key goes to a Web Worker;
 * while it is working only ON|OFF is accepted, and it cancels (Error 8).
 */
export class EngineHost {
  state: State;
  busy = false;
  busyVisible = false;
  private worker: Worker | null = null;
  private seq = 0;
  private listeners = new Set<Listener>();
  private busyTimer: ReturnType<typeof setTimeout> | null = null;
  private waiters: (() => void)[] = [];
  private queue: { key: Key; resolve: () => void }[] = [];

  constructor(state: State = loadState()) {
    this.state = state;
    this.spawn();
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }

  private spawn(): void {
    if (typeof Worker === 'undefined') return;
    try {
      this.worker = new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e: MessageEvent<{ seq: number; state?: State; error?: string }>) => {
        if (e.data.seq !== this.seq) return;
        if (e.data.state) this.commit(e.data.state);
        else {
          console.error(e.data.error);
          this.finish();
        }
      };
    } catch {
      this.worker = null;
    }
  }

  private commit(next: State): void {
    this.state = next;
    saveState(next);
    this.finish();
  }

  private finish(): void {
    this.busy = false;
    this.busyVisible = false;
    if (this.busyTimer) clearTimeout(this.busyTimer);
    this.busyTimer = null;
    this.emit();
    const w = this.waiters;
    this.waiters = [];
    w.forEach((fn) => fn());
    const next = this.queue.shift();
    if (next && !this.busy) void this.run(next.key).then(next.resolve);
  }

  /**
   * Resolves once the key has been processed. Keys pressed while the worker
   * is busy are queued; ON|OFF instead cancels the running evaluation.
   */
  press(key: Key): Promise<void> {
    if (this.busy) {
      if (key === 'ONOFF') {
        this.cancel();
        return Promise.resolve();
      }
      return new Promise((resolve) => this.queue.push({ key, resolve }));
    }
    return this.run(key);
  }

  private run(key: Key): Promise<void> {
    if (!this.worker) {
      this.commit(press(this.state, key));
      return Promise.resolve();
    }
    this.busy = true;
    this.seq++;
    this.busyTimer = setTimeout(() => {
      this.busyVisible = true;
      this.emit();
    }, BUSY_DELAY_MS);
    this.worker.postMessage({ seq: this.seq, state: this.state, key });
    return new Promise((resolve) => this.waiters.push(resolve));
  }

  /** ON|OFF during an evaluation: stop the worker and show Error 8. */
  cancel(): void {
    const dropped = this.queue;
    this.queue = [];
    dropped.forEach((q) => q.resolve());
    this.worker?.terminate();
    this.seq++;
    this.spawn();
    this.commit(cancelled(this.state));
  }

  replace(state: State): void {
    this.commit(state);
  }
}
