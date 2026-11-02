/**
 * UI strings live here rather than in `locales/`: the tab renders one status
 * line and three buttons, and the host locale is read synchronously from
 * `ctx.i18n.locale`. A catalogue would add a resolution step for no gain.
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
  builtinBrowser: string;
  systemBrowser: string;
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
}

const en: EditorStrings = {
  tab: "Photocraft",
  open: "Open",
  noFile: "No file",
  untitled: "Untitled",
  preparing: "Starting Photocraft…",
  ready: "Ready",
  failed: "Photocraft did not start",
  reload: "Reload",
  builtinBrowser: "Built-in panel",
  systemBrowser: "System browser",
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
};

const zh: EditorStrings = {
  tab: "Photocraft",
  open: "打开",
  noFile: "未打开文件",
  untitled: "未命名",
  preparing: "正在启动 Photocraft…",
  ready: "已就绪",
  failed: "Photocraft 未能启动",
  reload: "重新载入",
  builtinBrowser: "内置面板",
  systemBrowser: "系统浏览器",
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
};

export function editorStrings(locale: string | undefined): EditorStrings {
  return (locale ?? "").toLowerCase().startsWith("zh") ? zh : en;
}
