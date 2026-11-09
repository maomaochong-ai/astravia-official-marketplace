import type { CraftProbe } from "../../domain/link-protocol.ts";
import { readCanvas } from "../../features/editor/services/open-document.ts";
import type { Expectation } from "../../features/editor/services/expectation.ts";

/**
 * The reading an assertion is judged against.
 *
 * `expect.region` means "this rectangle", so it costs one focused probe. A failed focused
 * probe returns null on purpose: judging the whole frame when the caller asked about a
 * corner would be a verdict about the wrong pixels, and a null look fails closed.
 */
export async function readingFor(
  expect: Expectation | null | undefined,
  fallback: CraftProbe | null,
): Promise<CraftProbe | null> {
  const region = expect?.region;
  if (!region) return fallback;
  return readCanvas({ region });
}
