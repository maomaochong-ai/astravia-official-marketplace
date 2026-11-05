import { APP } from "../../app.config.ts";

/**
 * Strings for the tab itself live here rather than in `locales/`: they are read
 * synchronously from `ctx.i18n.locale` for a 28-px status line, and a catalogue key
 * would add a resolution step for no gain. The manifest-level strings that the host
 * renders outside this component (plugin name, description, tab label, tool labels)
 * do go through `locales/<locale>.json` — those are host-owned surfaces.
 */
export interface EditorStrings {
  tab: string;
  untitled: string;
  preparing: string;
  failed: string;
  reload: string;
  fullscreen: string;
  exitFullscreen: string;
  fullscreenFailed: string;
  /** Accessible name for the two floating controls that replaced the header. */
  controls: string;
  /** Name for the strip that lists what the page just did. */
  activity: string;
  selectInExplorer: string;
  saved: string;
  saveFailed: string;
  openFailed: string;
  /** The ladder reached the end without a measurable change: the app's own Open still works. */
  openManual: string;
  backendGpu: string;
  backendCpu: string;
  degradeGl: string;
  degradeCpu: string;
  noWorkspaceAccess: string;
  /** HUD prefix while a batch runs inside the page: "自动操作 2/5 · 点击渐变工具". */
  acting: string;
  actDone: string;
  /** Step labels the tools send to the HUD for steps they add themselves. */
  /** Boot cover: reading the package's site file. */
  bootRead: string;
  /** Boot cover: the engine module is loading and compiling. */
  bootEngine: string;
  /** Boot cover: the engine is up, the first frame is being drawn. */
  bootDraw: string;
  /** `{n}` is replaced with the elapsed seconds. */
  bootSeconds: string;
  /** Shown once a boot passes what a warm start needs. */
  bootSlow: string;
}

const en: EditorStrings = {
  tab: APP.tabLabel,
  untitled: "Untitled",
  preparing: `Starting ${APP.name}…`,
  failed: `${APP.name} did not start`,
  reload: "Reload",
  fullscreen: "Full screen",
  exitFullscreen: "Exit full screen",
  fullscreenFailed: "Full screen unavailable",
  controls: "Editor controls",
  activity: "Recent actions",
  selectInExplorer: "Select one file in the Explorer, then press Open.",
  saved: "Saved",
  saveFailed: "Save failed",
  openFailed: "Could not read that file",
  openManual: "The editor did not take the file automatically — use its own File › Open; your selection is already waiting there.",
  backendGpu: "GPU",
  backendCpu: "CPU",
  degradeGl: "No GPU — retrying with WebGL2…",
  degradeCpu: "No WebGL2 either — retrying in software…",
  noWorkspaceAccess: "Workspace access was not granted, so opening from the Explorer is off.",
  acting: "Automating",
  actDone: "Done",
  bootRead: "Reading the editor",
  bootEngine: "Starting the engine",
  bootDraw: "Drawing the first frame",
  bootSeconds: "{n}s",
  bootSlow:
    "A cold start compiles the whole engine in this frame — tens of seconds is normal the first time, and much faster afterwards.",
};

const zh: EditorStrings = {
  tab: APP.tabLabel,
  untitled: "未命名",
  preparing: `正在启动 ${APP.name}…`,
  failed: `${APP.name} 未能启动`,
  reload: "重新载入",
  fullscreen: "全屏",
  exitFullscreen: "退出全屏",
  fullscreenFailed: "无法进入全屏",
  controls: "编辑器控件",
  activity: "最近动作",
  selectInExplorer: "先在左侧资源管理器选中一个文件，再点打开。",
  saved: "已保存",
  saveFailed: "保存失败",
  openFailed: "读不到这个文件",
  openManual: "编辑器没有接住这个文件——用它自己的「文件 › 打开」，选中项已经等在那边了。",
  backendGpu: "GPU",
  backendCpu: "CPU",
  degradeGl: "没有可用 GPU，改用 WebGL2 重试…",
  degradeCpu: "WebGL2 也不可用，改用软件渲染重试…",
  noWorkspaceAccess: "没有获得工作区读取权限，暂时无法从资源管理器打开文件。",
  acting: "自动操作",
  actDone: "完成",
  bootRead: "读取编辑器",
  bootEngine: "启动引擎",
  bootDraw: "绘制首帧",
  bootSeconds: "{n} 秒",
  bootSlow: "首次启动要在这个框里编译整个引擎，十几秒到几十秒都算正常，之后会快得多。",
};

export function editorStrings(locale: string | undefined): EditorStrings {
  return (locale ?? "").toLowerCase().startsWith("zh") ? zh : en;
}
