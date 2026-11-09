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
  id: "lightcraft",
  name: "LightCraft",
  tabId: "lightcraft",
  tabLabel: "LightCraft",
  tabOrder: 20,
  /** Package directory holding the static site CI built from the upstream sources. */
  site: "web",
  /**
   * Interface-language seed. This build keeps its CJK glyphs in a separate file
   * (`lightcraft_zh_hans.otf`) rather than inside the wasm; CI builds the site with upstream's
   * own font step (a pinned craft-fonts checkout), so the face is in the package and the canvas
   * can actually draw the Chinese strings. See
   * docs/adr/lightcraft/craft-0007-chinese-comes-from-the-shell.md.
   */
  locale: "zh",
  /** Fill-only preference seed; empty when the app keeps no interface language there. */
  seedKey: "",
  seedValue: "",
  upstream: "https://github.com/storytold/lightcraft",
  /**
   * The named sequences the `lightcraft_recipe` tool executes: one id per thing a person asks
   * for, expressed only in commands this editor exposes (a shortcut, or a menu path whose
   * label the command index actually carries). Nothing here guesses a coordinate.
   */
  recipes: [
    { id: "zoom-in", label: "放大", when: "要看细节", steps: [{ menu: ["View","Zoom In"] }] },
    { id: "zoom-out", label: "缩小", when: "要看整幅", steps: [{ menu: ["View","Zoom Out"] }] },
    { id: "zoom-fit", label: "适合窗口", when: "视野乱了，坐标不再可信", steps: [{ menu: ["View","Fit"] }] },
    { id: "zoom100", label: "按 100% 显示", when: "要判断真实像素", steps: [{ menu: ["View","100%"] }] },
  ],
} as const;
