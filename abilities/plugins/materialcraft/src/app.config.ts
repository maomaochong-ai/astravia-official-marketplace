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
  id: "materialcraft",
  name: "MaterialCraft",
  tabId: "materialcraft",
  tabLabel: "MaterialCraft",
  tabOrder: 29,
  /** Package directory holding the static site CI built from the upstream sources. */
  site: "web",
  /**
   * Interface-language seed. Whether the canvas actually renders Chinese is the upstream
   * build's business (its own language table and glyphs); see
   * docs/adr/materialcraft/craft-0007-chinese-comes-from-the-shell.md.
   */
  locale: "zh",
  /** Fill-only preference seed; empty when the app keeps no interface language there. */
  seedKey: "",
  seedValue: "",
  upstream: "https://github.com/storytold/materialcraft",
  /**
   * The named sequences the `materialcraft_recipe` tool executes: one id per thing a person asks
   * for, expressed only in commands this editor exposes (a shortcut, or a menu path whose
   * label the command index actually carries). Nothing here guesses a coordinate.
   */
  recipes: [
    { id: "open", label: "打开", when: "文件已经在项目里，要进编辑器", steps: [{ shortcut: "Ctrl+O" }] },
    { id: "save", label: "保存", when: "用户说「保存一下」", steps: [{ shortcut: "Ctrl+S" }] },
    { id: "save-as", label: "另存为", when: "要一份叫别的名字的副本", steps: [{ shortcut: "Ctrl+Shift+S" }] },
    { id: "export", label: "导出", when: "用户要一份能拿走的文件", steps: [{ shortcut: "Ctrl+Shift+E" }] },
    { id: "undo", label: "撤销一步", when: "刚做错了一步", steps: [{ shortcut: "Ctrl+Z" }] },
    { id: "redo", label: "重做", when: "撤错了，要恢复", steps: [{ shortcut: "Ctrl+Y" }] },
    { id: "delete", label: "删除", when: "用户说「删掉它」", steps: [{ shortcut: "Delete" }] },
    { id: "duplicate", label: "复制一份", when: "要一个副本再改", steps: [{ shortcut: "Ctrl+D" }] },
    { id: "cut", label: "剪切", when: "把内容从这里挪走", steps: [{ shortcut: "Ctrl+X" }] },
    { id: "copy", label: "拷贝", when: "要拿这段内容到别处", steps: [{ shortcut: "Ctrl+C" }] },
    { id: "paste", label: "粘贴", when: "接上刚才拷贝的内容", steps: [{ shortcut: "Ctrl+V" }] },
  ],
} as const;
