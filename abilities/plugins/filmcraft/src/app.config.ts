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
  locale: "zh",
  /** Fill-only preference seed; empty when the app keeps no interface language there. */
  seedKey: "",
  seedValue: "",
  upstream: "https://github.com/storytold/filmcraft",
  /**
   * The named sequences the `filmcraft_recipe` tool executes: one id per thing a person asks
   * for, expressed only in commands this editor exposes (a shortcut, or a menu path whose
   * label the command index actually carries). Nothing here guesses a coordinate.
   */
  recipes: [
    { id: "save", label: "保存", when: "用户说「保存一下」", steps: [{ menu: ["View","Guide Templates","Save Guides as Template…"] }] },
    { id: "save-as", label: "另存为", when: "要一份叫别的名字的副本", steps: [{ menu: ["Window","Workspaces","Save as New Workspace…"] }] },
    { id: "export", label: "导出", when: "用户要一份能拿走的文件", steps: [{ shortcut: "Cmd+M" }] },
    { id: "zoom-in", label: "放大", when: "要看细节", steps: [{ shortcut: "=" }] },
    { id: "zoom-out", label: "缩小", when: "要看整幅", steps: [{ shortcut: "-" }] },
    { id: "fit", label: "适合窗口", when: "视野乱了，坐标不再可信", steps: [{ menu: ["View","Magnification","Fit"] }] },
    { id: "group", label: "编组", when: "几样东西要一起动", steps: [{ menu: ["Clipping","Group"] }] },
    { id: "ungroup", label: "取消编组", when: "要单独改其中一个", steps: [{ menu: ["Clipping","Ungroup"] }] },
    { id: "cut", label: "剪切", when: "把内容从这里挪走", steps: [{ menu: ["Edit","Cut"] }] },
    { id: "copy", label: "拷贝", when: "要拿这段内容到别处", steps: [{ menu: ["Edit","Copy"] }] },
  ],
} as const;
