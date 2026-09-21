// dsl.md "Core interface" (via browser-client.md) — the core's entire public surface.
//
// Adding an export here is a specification change: browser-client.md names exactly
// these four symbols. The value model behind them is designed in ticket 04 and the
// behaviour implemented from ticket 05 onward; the placeholder types below are
// deliberately opaque so no caller can start depending on a shape that is not yet
// specified.

import { invariant } from "../lib/invariant.ts";

/** An immutable ordered list of values. Shape pinned down by ticket 04. */
export type Program = readonly unknown[];

/** A data stack produced by evaluation. Shape pinned down by ticket 04. */
export type Stack = readonly unknown[];

export const emptyProgram: Program = Object.freeze([]);

export function parse(_program: Program, _item: unknown): Program {
  invariant(false, "parse is not implemented yet (ticket 05)");
}

export function execute(_program: Program): Stack {
  invariant(false, "execute is not implemented yet (ticket 09)");
}

export function initialStack(): Stack {
  invariant(false, "initialStack is not implemented yet (ticket 09)");
}
