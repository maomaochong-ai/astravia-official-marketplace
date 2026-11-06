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
  /** Name for the strip that lists what the page just did. */
  activity: string;
  /** Prefix for the last screenshot path, so the agent can open the picture itself. */
  activityCapture: string;
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
  /** Dock button: put this panel's state into the message box for the user to send. */
  askAgent: string;
  /** First line of that drafted message. */
  askAgentLead: string;
  /** Label in the drafted message before the renderer name. */
  backendLabel: string;
  askAgentSent: string;
  askAgentFailed: string;
  /** Activity strip: the model is still writing the call, nothing has run yet. */
  agentQueued: string;
  /** "{n}" is the step count the arguments already hold. */
  agentSteps: string;
  /** Right-click menu over the canvas: hand only the dragged area to the model. */
  menuRegion: string;
  /** Right-click menu over the canvas: hand the whole page, as before. */
  menuPage: string;
  /** Ink bar while the pointer is choosing the area. */
  regionHint: string;
  /** The drag was a click, not an area. */
  regionTooSmall: string;
  /** One line put into the message box after a region is captured. `{rect}` and `{path}`. */
  regionLead: string;
  /** The page could not crop the area (frame gone, canvas unreadable). */
  regionFailed: string;
  /** `{name}`: the file the panel reopened on its own after the tab came back. */
  restored: string;
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
  activity: "Recent actions",
  activityCapture: "Screenshot —",
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
  askAgent: "Hand to AI",
  askAgentLead: "Editor state —",
  backendLabel: "Renderer",
  askAgentSent: "Panel state added to the message box",
  askAgentFailed: "Could not reach the conversation",
  agentQueued: "Preparing",
  agentSteps: "{n} steps",
  menuRegion: "Hand this area to the AI",
  menuPage: "Hand the whole page to the AI",
  regionHint: "Drag the area to hand over · Esc cancels",
  regionTooSmall: "That is a click, not an area",
  regionLead: "{app} region · {document} · {rect} · cropped to {path}",
  regionFailed: "Could not crop that area",
  restored: "Reopened {name}",
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
  activity: "最近动作",
  activityCapture: "截图 —",
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
  askAgent: "交给 AI",
  askAgentLead: "编辑器状态 —",
  backendLabel: "渲染方式",
  askAgentSent: "面板状态已放进输入框",
  askAgentFailed: "没能连到对话",
  agentQueued: "正在准备",
  agentSteps: "{n} 步",
  menuRegion: "把这一块交给 AI",
  menuPage: "整页交给 AI",
  regionHint: "拖出要交出的区域 · Esc 取消",
  regionTooSmall: "这是点了一下，不是一个区域",
  regionLead: "{app} 的局部 · {document} · {rect} · 已裁到 {path}",
  regionFailed: "这块区域截不下来",
  restored: "已重新打开 {name}",
};

export function editorStrings(locale: string | undefined): EditorStrings {
  return (locale ?? "").toLowerCase().startsWith("zh") ? zh : en;
}
