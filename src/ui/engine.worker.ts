/// <reference lib="webworker" />
import { press, type Key, type State } from '../engine';

/**
 * Runs the engine off the main thread so long iterative solves (I/Y, IRR,
 * YLD, MOD, PB, DPB) can be cancelled by terminating the worker (Error 8).
 */
self.onmessage = (e: MessageEvent<{ seq: number; state: State; key: Key }>) => {
  const { seq, state, key } = e.data;
  try {
    (self as unknown as Worker).postMessage({ seq, state: press(state, key) });
  } catch (err) {
    (self as unknown as Worker).postMessage({ seq, error: String(err) });
  }
};
