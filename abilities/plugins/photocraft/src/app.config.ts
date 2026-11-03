/**
 * The only app-specific source file in this plugin.
 *
 * Everything else under `src/` and `server/` is the same code in all seven craft
 * plugins (photocraft included). There is no generator any more: shared behaviour is
 * changed in every copy, and `tests/craft-parity.test.mjs` fails when one drifts.
 */
export const APP = {
  id: "photocraft",
  name: "Photocraft",
  tabId: "photocraft",
  tabLabel: "Photocraft",
  tabOrder: 16,
  serviceId: "photocraft-hub",
  serviceVersion: "0.0.12",
  serviceArtifact: "server/hub.mjs",
  /** Upstream registers a service worker, which outlives a hub restart. */
  nosw: false,
  upstream: "https://github.com/storytold/photocraft",
} as const;

export type CraftApp = typeof APP;
