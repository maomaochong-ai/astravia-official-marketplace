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
  noWorkspaceAccess: string;
  editing: string;
  /** HUD prefix while a batch runs inside the page: "自动操作 2/5 · 打开菜单". */
  acting: string;
  actDone: string;
  /** Step labels the tools send to the HUD for steps they add themselves. */
  stepReady: string;
  stepOpen: string;
  stepWait: string;
  /** Status-bar switch between the site's Chinese and English UI. */
  language: string;
  languageFailed: string;
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
  noWorkspaceAccess: "Workspace access was not granted, so opening from the Explorer is off.",
  editing: "edited since save",
  acting: "Automating",
  actDone: "Done",
  stepReady: "Wait for the editor",
  stepOpen: "Open the file",
  stepWait: "Let it load",
  language: "中文",
  languageFailed: "Could not switch the editor language",
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
  noWorkspaceAccess: "没有获得工作区读取权限，暂时无法从资源管理器打开文件。",
  editing: "此后有输入",
  acting: "自动操作",
  actDone: "完成",
  stepReady: "等待编辑器就绪",
  stepOpen: "打开文件",
  stepWait: "等它载入",
  language: "EN",
  languageFailed: "没能切换编辑器语言",
};

export function editorStrings(locale: string | undefined): EditorStrings {
  return (locale ?? "").toLowerCase().startsWith("zh") ? zh : en;
}
