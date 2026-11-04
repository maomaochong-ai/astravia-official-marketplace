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
  open: string;
  noFile: string;
  untitled: string;
  preparing: string;
  ready: string;
  failed: string;
  reload: string;
  fullscreen: string;
  exitFullscreen: string;
  fullscreenFailed: string;
  selectInExplorer: string;
  saving: string;
  saved: string;
  saveFailed: string;
  openFailed: string;
  backendGpu: string;
  backendCpu: string;
  degradeGl: string;
  degradeCpu: string;
  noWorkspaceAccess: string;
  editing: string;
  /** HUD prefix while a batch runs inside the page: "自动操作 2/5 · 点击渐变工具". */
  acting: string;
  actDone: string;
  /** Step labels the tools send to the HUD for steps they add themselves. */
  stepReady: string;
  stepOpen: string;
  stepWait: string;
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
  open: "Open",
  noFile: "No file",
  untitled: "Untitled",
  preparing: `Starting ${APP.name}…`,
  ready: "Ready",
  failed: `${APP.name} did not start`,
  reload: "Reload",
  fullscreen: "Full screen",
  exitFullscreen: "Exit full screen",
  fullscreenFailed: "Full screen unavailable",
  selectInExplorer: "Select one file in the Explorer, then press Open.",
  saving: "Saving…",
  saved: "Saved",
  saveFailed: "Save failed",
  openFailed: "Could not read that file",
  backendGpu: "GPU",
  backendCpu: "CPU",
  degradeGl: "No GPU — retrying with WebGL2…",
  degradeCpu: "No WebGL2 either — retrying in software…",
  noWorkspaceAccess: "Workspace access was not granted, so opening from the Explorer is off.",
  editing: "edited since save",
  acting: "Automating",
  actDone: "Done",
  stepReady: "Wait for the editor",
  stepOpen: "Open the file",
  stepWait: "Let it load",
  bootRead: "Reading the editor",
  bootEngine: "Starting the engine",
  bootDraw: "Drawing the first frame",
  bootSeconds: "{n}s",
  bootSlow:
    "A cold start compiles the whole engine in this frame — tens of seconds is normal the first time, and much faster afterwards.",
};

const zh: EditorStrings = {
  tab: APP.tabLabel,
  open: "打开",
  noFile: "未打开文件",
  untitled: "未命名",
  preparing: `正在启动 ${APP.name}…`,
  ready: "已就绪",
  failed: `${APP.name} 未能启动`,
  reload: "重新载入",
  fullscreen: "全屏",
  exitFullscreen: "退出全屏",
  fullscreenFailed: "无法进入全屏",
  selectInExplorer: "先在左侧资源管理器选中一个文件，再点打开。",
  saving: "正在保存…",
  saved: "已保存",
  saveFailed: "保存失败",
  openFailed: "读不到这个文件",
  backendGpu: "GPU",
  backendCpu: "CPU",
  degradeGl: "没有可用 GPU，改用 WebGL2 重试…",
  degradeCpu: "WebGL2 也不可用，改用软件渲染重试…",
  noWorkspaceAccess: "没有获得工作区读取权限，暂时无法从资源管理器打开文件。",
  editing: "此后有输入",
  acting: "自动操作",
  actDone: "完成",
  stepReady: "等待编辑器就绪",
  stepOpen: "打开文件",
  stepWait: "等它载入",
  bootRead: "读取编辑器",
  bootEngine: "启动引擎",
  bootDraw: "绘制首帧",
  bootSeconds: "{n} 秒",
  bootSlow: "首次启动要在这个框里编译整个引擎，十几秒到几十秒都算正常，之后会快得多。",
};

export function editorStrings(locale: string | undefined): EditorStrings {
  return (locale ?? "").toLowerCase().startsWith("zh") ? zh : en;
}
