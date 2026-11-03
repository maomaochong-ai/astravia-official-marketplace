/**
 * The only app-specific source file in this plugin.
 *
 * Everything else under `src/` and `server/` is the same code in every craft plugin in
 * this marketplace. There is no generator any more: shared behaviour is changed in every
 * copy, and `tests/craft-parity.test.mjs` fails when one drifts.
 */
export const APP = {
  id: "deckcraft",
  name: "DeckCraft",
  tabId: "deckcraft",
  tabLabel: "DeckCraft",
  tabOrder: 24,
  serviceId: "deckcraft-hub",
  serviceVersion: "0.0.3",
  serviceArtifact: "server/hub.mjs",
  /** Upstream registers a service worker, which outlives a hub restart. */
  nosw: false,
  upstream: "https://github.com/storytold/deckcraft",
} as const;

export type CraftApp = typeof APP;
