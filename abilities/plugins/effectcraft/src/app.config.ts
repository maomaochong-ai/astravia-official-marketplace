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
  id: "effectcraft",
  name: "EffectCraft",
  tabId: "effectcraft",
  tabLabel: "EffectCraft",
  tabOrder: 18,
  /** Package directory holding the static site CI built from the upstream sources. */
  site: "web",
  /**
   * Interface-language seed. Whether the canvas actually renders Chinese is the upstream
   * build's business (its own language table and glyphs).
   */
  locale: "zh",
  /** Fill-only preference seed; empty when the app keeps no interface language there. */
  seedKey: "",
  seedValue: "",
  upstream: "https://github.com/storytold/effectcraft",
  /**
   * The named sequences the `effectcraft_recipe` tool executes: one id per thing a person asks
   * for, expressed only in commands this editor exposes (a shortcut, or a menu path whose
   * label the command index actually carries). Nothing here guesses a coordinate.
   */
  recipes: [
    { id: "undo", label: "撤销一步", when: "刚做错了一步", steps: [{ menu: ["Edit","undo"] }] },
    { id: "redo", label: "重做", when: "撤错了，要恢复", steps: [{ menu: ["Edit","redo"] }] },
  ],
} as const;
