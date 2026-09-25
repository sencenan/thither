// A trailing-edge debounce: `schedule` (re)starts the delay and `fn` runs once it elapses with
// no further schedule; `flush` runs a pending call immediately instead of waiting.

export interface Debounced {
  schedule(): void;
  flush(): void;
}

export const debounce = (fn: () => void, delayMs: number): Debounced => {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const fire = (): void => {
    timer = undefined;
    fn();
  };

  return {
    schedule: () => {
      clearTimeout(timer);
      timer = setTimeout(fire, delayMs);
    },
    flush: () => {
      if (timer !== undefined) {
        clearTimeout(timer);
        fire();
      }
    },
  };
};
