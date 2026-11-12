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
  id: "deckcraft",
  name: "DeckCraft",
  tabId: "deckcraft",
  tabLabel: "DeckCraft",
  tabOrder: 24,
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
  upstream: "https://github.com/storytold/deckcraft",
  /**
   * The named sequences the `deckcraft_recipe` tool executes: one id per thing a person asks
   * for, expressed only in commands this editor exposes (a shortcut, or a menu path whose
   * label the command index actually carries). Nothing here guesses a coordinate.
   */
  recipes: [
    { id: "new", label: "新建", when: "用户说「新建一个」", steps: [{ menu: ["File","New Presentation"] }] },
    { id: "save", label: "保存", when: "用户说「保存一下」", steps: [{ menu: ["File","Save"] }] },
    { id: "undo", label: "撤销一步", when: "刚做错了一步", steps: [{ menu: ["Edit","Undo"] }] },
    { id: "redo", label: "重做", when: "撤错了，要恢复", steps: [{ menu: ["Edit","Redo"] }] },
    { id: "zoom-in", label: "放大", when: "要看细节", steps: [{ menu: ["View","Zoom In"] }] },
    { id: "zoom-out", label: "缩小", when: "要看整幅", steps: [{ menu: ["View","Zoom Out"] }] },
    { id: "fit", label: "适合窗口", when: "视野乱了，坐标不再可信", steps: [{ menu: ["View","Fit to Window"] }] },
    { id: "delete", label: "删除", when: "用户说「删掉它」", steps: [{ menu: ["Slides","Delete Slide"] }] },
    { id: "duplicate", label: "复制一份", when: "要一个副本再改", steps: [{ menu: ["Edit","Duplicate"] }] },
    { id: "group", label: "编组", when: "几样东西要一起动", steps: [{ menu: ["Arrange","Group"] }] },
    { id: "ungroup", label: "取消编组", when: "要单独改其中一个", steps: [{ menu: ["Arrange","Ungroup"] }] },
    { id: "cut", label: "剪切", when: "把内容从这里挪走", steps: [{ menu: ["Edit","Cut"] }] },
    { id: "copy", label: "拷贝", when: "要拿这段内容到别处", steps: [{ menu: ["Edit","Copy"] }] },
    { id: "paste", label: "粘贴", when: "接上刚才拷贝的内容", steps: [{ menu: ["Edit","Paste"] }] },
  ],
} as const;
