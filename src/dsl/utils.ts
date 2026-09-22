import type { ErrorType, ThitherError } from './types';

export const thitherError = (
  type: ErrorType,
  description: string,
  fields?: Record<string, unknown>,
): ThitherError => ['E', { type, description, ...fields }];
