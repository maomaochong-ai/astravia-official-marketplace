/**
 * The only app-specific source file in this plugin.
 *
 * Everything else under `src/` is the same code in all sixteen craft plugins. There
 * is no generator: shared behaviour is changed in every copy, and
 * `tests/craft-parity.test.mjs` fails when one drifts.
 *
 * `kernel` is the whole difference between the plugins — which surface the page is
 * ruled as, and which colour new objects arrive in. It is deliberately not a bundle
 * of per-app components: sixteen drifting editors is how this family got expensive.
 *
 * ADR: docs/adr/<slug>/craft-0011-the-engine-is-ours.md
 */
export const APP = {
  id: "gridcraft",
  name: "GridCraft",
  tabId: "gridcraft",
  tabLabel: "GridCraft",
  tabOrder: 26,
  kernel: {
    mode: "sheet",
    accent: "#16a34a",
  },
  /** The editor is this repository's code; the name is the only nod to the original. */
  homepage: "https://github.com/maomaochong-ai/astravia-official-marketplace",
} as const;

export type CraftApp = typeof APP;
