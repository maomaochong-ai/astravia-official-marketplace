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
  id: "gridcraft",
  name: "GridCraft",
  tabId: "gridcraft",
  tabLabel: "GridCraft",
  tabOrder: 26,
  /** Package directory holding the static site CI built from the upstream sources. */
  site: "web",
  /**
   * Interface-language seed. Whether the canvas actually renders Chinese is the upstream
   * build's business (its own language table and glyphs); see
   * docs/adr/gridcraft/craft-0007-chinese-comes-from-the-shell.md.
   */
  locale: "zh",
  /**
   * Fill-only preference seed; empty when the app keeps no interface language there.
   * GridCraft reads `saved_language()` out of `localStorage["gridcraft.ui"]` and falls back to
   * the browser's language only when that key has none, so this makes Chinese the default on a
   * first visit and still loses to a language the user picks later.
   */
  seedKey: "gridcraft.ui",
  seedValue: "{\"language\":\"zh\"}",
  upstream: "https://github.com/storytold/gridcraft",
} as const;
