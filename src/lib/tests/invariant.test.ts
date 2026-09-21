import { describe, expect, it } from "vitest";
import { INVARIANT_PREFIX, invariant } from "../invariant.ts";

describe("invariant", () => {
  it("passes a truthy condition through", () => {
    expect(() => {
      invariant("a value", "a truthy condition holds");
    }).not.toThrow();
  });

  it("throws with the prefixed message on a falsy condition", () => {
    expect(() => {
      invariant(false, "the impossible happened");
    }).toThrow(`${INVARIANT_PREFIX}the impossible happened`);
  });

  it("narrows the asserted value for the compiler", () => {
    const value: string | undefined = "present";
    invariant(value !== undefined, "value is present");
    expect(value.length).toBe(7);
  });
});
