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
  id: "cadcraft",
  name: "CADCraft",
  tabId: "cadcraft",
  tabLabel: "CADCraft",
  tabOrder: 23,
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
  upstream: "https://github.com/storytold/cadcraft",
  /**
   * The named sequences the `cadcraft_recipe` tool executes: one id per thing a person asks
   * for, expressed only in commands this editor exposes (a shortcut, or a menu path whose
   * label the command index actually carries). Nothing here guesses a coordinate.
   */
  recipes: [
    { id: "new", label: "新建", when: "用户说「新建一个」", steps: [{ menu: ["Layer","New Layer"] }] },
    { id: "export", label: "导出", when: "用户要一份能拿走的文件", steps: [{ menu: ["Export","Export..."] }] },
    { id: "import", label: "导入", when: "素材还在工作区里", steps: [{ menu: ["Import","Import..."] }] },
    { id: "all", label: "全选", when: "要对整张画面动手", steps: [{ menu: ["Other commands","All Scales"] }] },
    { id: "delete", label: "删除", when: "用户说「删掉它」", steps: [{ menu: ["Layer","Delete Layer"] }] },
    { id: "switch", label: "切换文档", when: "同时开了好几个", steps: [{ menu: ["Document","Switch Drawing"] }] },
  ],
} as const;
