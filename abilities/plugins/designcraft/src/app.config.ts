/**
 * The only app-specific source file in this plugin.
 *
 * Everything else under `src/` and `server/` is the same code in all seven craft
 * plugins (photocraft included). There is no generator any more: shared behaviour is
 * changed in every copy, and `tests/craft-parity.test.mjs` fails when one drifts.
 */
export const APP = {
  id: "designcraft",
  name: "DesignCraft",
  tabId: "designcraft",
  tabLabel: "DesignCraft",
  tabOrder: 17,
  serviceId: "designcraft-hub",
  serviceVersion: "0.0.7",
  serviceArtifact: "server/hub.mjs",
  /** Upstream registers a service worker, which outlives a hub restart. */
  nosw: false,
  upstream: "https://github.com/storytold/designcraft",
} as const;

export type CraftApp = typeof APP;
