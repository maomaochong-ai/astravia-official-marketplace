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
  id: "wordcraft",
  name: "WordCraft",
  tabId: "wordcraft",
  tabLabel: "WordCraft",
  tabOrder: 27,
  /** Package directory holding the static site CI built from the upstream sources. */
  site: "web",
  /**
   * Interface-language seed. Whether the canvas actually renders Chinese is the upstream
   * build's business (its own language table and glyphs).
   */
  locale: "zh",
  /**
   * Fill-only preference seed; empty when the app keeps no interface language there.
   * WordCraft keeps its `UiState` in `localStorage["wordcraft.ui"]` and restores it leniently,
   * so `{"language":"zh-hans"}` is enough: every other key falls back to its default and a
   * language the user picks later wins, because this only fills an absent value.
   */
  seedKey: "wordcraft.ui",
  seedValue: "{\"language\":\"zh-hans\"}",
  upstream: "https://github.com/storytold/wordcraft",
  /**
   * The named sequences the `wordcraft_recipe` tool executes: one id per thing a person asks
   * for, expressed only in commands this editor exposes (a shortcut, or a menu path whose
   * label the command index actually carries). Nothing here guesses a coordinate.
   */
  recipes: [
    { id: "new", label: "新建", when: "用户说「新建一个」", steps: [{ shortcut: "Mod+N" }] },
    { id: "open", label: "打开", when: "文件已经在项目里，要进编辑器", steps: [{ shortcut: "Mod+O / Mod+F12 / Mod+Alt+F2" }] },
    { id: "save", label: "保存", when: "用户说「保存一下」", steps: [{ shortcut: "Mod+S / Shift+F12 / Alt+Shift+F2" }] },
    { id: "save-as", label: "另存为", when: "要一份叫别的名字的副本", steps: [{ menu: ["File","Save As"] }] },
    { id: "undo", label: "撤销一步", when: "刚做错了一步", steps: [{ shortcut: "Mod+Z" }] },
    { id: "redo", label: "重做", when: "撤错了，要恢复", steps: [{ shortcut: "Mod+Y / Mod+Shift+Z" }] },
    { id: "all", label: "全选", when: "要对整张画面动手", steps: [{ shortcut: "Mod+A" }] },
    { id: "zoom-in", label: "放大", when: "要看细节", steps: [{ menu: ["View","Zoom In"] }] },
    { id: "zoom-out", label: "缩小", when: "要看整幅", steps: [{ menu: ["View","Zoom Out"] }] },
    { id: "zoom100", label: "按 100% 显示", when: "要判断真实像素", steps: [{ menu: ["View","100%"] }] },
    { id: "cut", label: "剪切", when: "把内容从这里挪走", steps: [{ shortcut: "Mod+X" }] },
    { id: "copy", label: "拷贝", when: "要拿这段内容到别处", steps: [{ shortcut: "Mod+C / Mod+Insert" }] },
    { id: "paste", label: "粘贴", when: "接上刚才拷贝的内容", steps: [{ shortcut: "Mod+V / Shift+Insert" }] },
  ],
} as const;
