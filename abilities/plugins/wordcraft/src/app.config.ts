/**
 * The only app-specific source file in this plugin.
 *
 * Everything else under `src/` and `server/` is the same code in every craft plugin in
 * this marketplace. There is no generator any more: shared behaviour is changed in every
 * copy, and `tests/craft-parity.test.mjs` fails when one drifts.
 */
export const APP = {
  id: "wordcraft",
  name: "WordCraft",
  tabId: "wordcraft",
  tabLabel: "WordCraft",
  tabOrder: 27,
  serviceId: "wordcraft-hub",
  serviceVersion: "0.0.1",
  serviceArtifact: "server/hub.mjs",
  /** Upstream registers a service worker, which outlives a hub restart. */
  nosw: false,
  upstream: "https://github.com/storytold/wordcraft",
} as const;

export type CraftApp = typeof APP;
