import { Fzf } from 'fzf';
import type { Dim, Target } from './types';

const createFzfForTargets = (targets: readonly Target[]): Fzf<Target[]> =>
  new Fzf(targets, {
    selector: (target: Target) => target[0].join(' '),
  });

export const selectTargets = (targets: readonly Target[], query: readonly Dim[]): Target[] =>
  createFzfForTargets(targets)
    .find(query.join(' '))
    .map((result) => result.item);
