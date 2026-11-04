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
  id: "filmcraft",
  name: "FilmCraft",
  tabId: "filmcraft",
  tabLabel: "FilmCraft",
  tabOrder: 19,
  /** Package directory holding the static site CI built from the upstream sources. */
  site: "web",
  /**
   * Interface-language seed. Whether the canvas actually renders Chinese is the upstream
   * build's business (its own language table and glyphs); see
   * docs/adr/filmcraft/craft-0007-chinese-comes-from-the-shell.md.
   */
  locale: "",
  /** Fill-only preference seed; empty when the app keeps no interface language there. */
  seedKey: "",
  seedValue: "",
  upstream: "https://github.com/storytold/filmcraft",
} as const;
