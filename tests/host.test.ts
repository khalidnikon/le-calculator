import { afterEach, describe, expect, it, vi } from 'vitest';
import { display, initialState } from '../src/engine';
import { EngineHost } from '../src/ui/engineHost';

/** A worker that never answers, like one stuck in a long iterative solve. */
class StuckWorker {
  static last: StuckWorker | null = null;
  terminated = false;
  onmessage: ((e: MessageEvent) => void) | null = null;
  constructor() {
    StuckWorker.last = this;
  }
  postMessage(): void {}
  terminate(): void {
    this.terminated = true;
  }
}

afterEach(() => vi.unstubAllGlobals());

describe('worker host', () => {
  it('ON|OFF during an evaluation terminates the worker and shows Error 8', async () => {
    vi.stubGlobal('Worker', StuckWorker);
    const host = new EngineHost(initialState());
    const first = StuckWorker.last!;
    void host.press('CPT');
    expect(host.busy).toBe(true);
    const queued = host.press('D5');
    await host.press('ONOFF');
    await queued;
    expect(first.terminated).toBe(true);
    expect(StuckWorker.last).not.toBe(first);
    expect(host.busy).toBe(false);
    expect(display(host.state).value).toBe('Error 8');
  });

  it('runs synchronously when Workers are unavailable', async () => {
    const host = new EngineHost(initialState());
    await host.press('D4');
    expect(display(host.state).value).toBe('4');
  });
});
