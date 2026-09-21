// The repo's single sanctioned throw site — see docs/code-standards.md "Failure".
// src/dsl answers with E values for every failure dsl.md specifies; an invariant
// violation is the other thing: a state the types say cannot happen. Kept as a
// plain Error rather than a subclass because the standards rule out classes.

export const INVARIANT_PREFIX = "Invariant violated: ";

export function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`${INVARIANT_PREFIX}${message}`);
  }
}
