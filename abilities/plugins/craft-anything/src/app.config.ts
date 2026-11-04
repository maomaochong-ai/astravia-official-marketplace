/**
 * The only app-specific source file in this plugin.
 *
 * Everything else under `src/` is the same code in all fifteen craft plugins.
 * There is no generator any more: shared behaviour is changed in every copy, and
 * `tests/craft-parity.test.mjs` fails when one drifts.
 *
 * `site` names the package directory CI filled with upstream's own web build;
 * `locale` / `seedKey` / `seedValue` are the shell's seeds for it.
 */
export const APP = {
  id: "craft-anything",
  name: "Craft Anything",
  tabId: "craft-anything",
  tabLabel: "Craft Anything",
  tabOrder: 30,
  /** Package directory holding the static site CI built from the upstream sources. */
  site: "web",
  /**
   * Interface-language seed. Whether the canvas actually renders Chinese is the upstream
   * build's business (its own language table and glyphs); see
   * docs/adr/craft-anything/craft-0007-chinese-comes-from-the-shell.md.
   */
  locale: "zh",
  /** Fill-only preference seed; empty when the app keeps no interface language there. */
  seedKey: "",
  seedValue: "",
  upstream: "https://github.com/storytold/craft-anything",
} as const;

export type CraftApp = typeof APP;
