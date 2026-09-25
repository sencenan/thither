// browser-client.md "Fallback UI and settings" — the keystroke debounce: the call lands once the
// delay has passed with no further schedule; each schedule restarts the delay; a flush runs a
// pending call now.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { debounce } from '../debounce.ts';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('debounce', () => {
  it('calls once the delay has passed, not before', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 60);

    debounced.schedule();
    vi.advanceTimersByTime(59);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('each schedule restarts the delay, so a burst calls once', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 60);

    debounced.schedule();
    vi.advanceTimersByTime(40);
    debounced.schedule();
    vi.advanceTimersByTime(40);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(20);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('flush runs a pending call now and cancels the timer', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 60);

    debounced.schedule();
    debounced.flush();
    expect(fn).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(60);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('flush with nothing pending calls nothing', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 60);

    debounced.flush();
    vi.advanceTimersByTime(60);
    expect(fn).not.toHaveBeenCalled();
  });

  it('a schedule after the call fired starts a fresh delay', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 60);

    debounced.schedule();
    vi.advanceTimersByTime(60);
    debounced.schedule();
    vi.advanceTimersByTime(60);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
