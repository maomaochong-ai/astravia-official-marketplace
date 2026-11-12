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
  id: "photocraft",
  name: "Photocraft",
  tabId: "photocraft",
  tabLabel: "Photocraft",
  tabOrder: 16,
  /** Package directory holding the static site CI built from the upstream sources. */
  site: "web",
  /**
   * Interface-language seed. Whether the canvas actually renders Chinese is the upstream
   * build's business (its own language table and glyphs).
   */
  locale: "zh",
  /** Fill-only preference seed; empty when the app keeps no interface language there. */
  seedKey: "photocraft.preferences",
  seedValue: "{\"version\":2,\"interface\":{\"language\":\"zh-hans\"}}",
  upstream: "https://github.com/storytold/photocraft",
  /**
   * The named sequences the `photocraft_recipe` tool executes: one id per thing a person asks
   * for, expressed only in commands this editor exposes (a shortcut, or a menu path whose
   * label the command index actually carries). Nothing here guesses a coordinate.
   */
  recipes: [
    { id: "new", label: "新建", when: "用户说「新建一个」", steps: [{ shortcut: "Cmd+N" }] },
    { id: "open", label: "打开", when: "文件已经在项目里，要进编辑器", steps: [{ shortcut: "Cmd+O" }] },
    { id: "save", label: "保存", when: "用户说「保存一下」", steps: [{ shortcut: "Cmd+S" }] },
    { id: "save-as", label: "另存为", when: "要一份叫别的名字的副本", steps: [{ shortcut: "Cmd+Shift+S" }] },
    { id: "save-acopy", label: "保存副本", when: "原稿不动，另存一份", steps: [{ shortcut: "Cmd+Alt+S" }] },
    { id: "cut", label: "剪切", when: "把内容从这里挪走", steps: [{ menu: ["Edit","Cut"] }] },
    { id: "copy", label: "拷贝", when: "要拿这段内容到别处", steps: [{ menu: ["Edit","Copy"] }] },
    { id: "paste", label: "粘贴", when: "接上刚才拷贝的内容", steps: [{ menu: ["Edit","Paste"] }] },
  ],
} as const;
