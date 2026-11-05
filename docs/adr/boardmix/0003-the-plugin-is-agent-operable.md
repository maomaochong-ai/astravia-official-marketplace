# 插件对 Agent 开放工具与技能

- 状态：已采纳（2026-11-05）
- 相关：[0001](0001-the-web-product-is-a-plugin-tab-not-an-mcp.md)（载体）、[0002](0002-pin-the-origin-not-the-path.md)（入口地址）
- 影响面：`plugin.json`（`permissions` / `agent`）、`src/index.tsx`、`src/tools/`、`src/features/boardmix-workspace/services/`、`agent/skills/boardmix/`

> 本文的「四个工具 + 一个技能」已由 [0004](0004-tools-reach-the-page-skills-carry-the-work.md) 修订为
> 「七个工具 + 五份技能」，第七个工具由 [0006](0006-automation-runs-before-the-answer.md) 加入，技能写法又由 [0005](0005-the-skill-index-is-its-description.md) 重写。
> **边界（三条不变量）、接线方式、origin 闸门、注册表约定仍然有效**，被替换的只有工具清单、
> 技能划分与技能正文。

## 问题

0001 与 0002 只解决了"人点得开"。宿主是 Agent 优先的：用户会说"帮我把 boardmix 打开到最近文件"、
"这块白板的分享链接给我"、"我在画的那块板打开一下"。插件若没有工具与技能，模型只能回一句做不到——
能力做成了一半。

要求：插件激活后，宿主 Agent 能**调用它的工具、按它的技能**完成用户交办的任务。同时不能为了"有工具"
而打开一扇通往用户画布内容的门。

## 先划边界：工具作用于壳，不作用于画布

三条不变量，后面每个工具都要能对上：

1. 工具能改的只有**标签页状态**：开/关、地址、聚焦、逃生口。不碰任何画布内容。
2. 工具**不读页面内部结构、不调他方站点的内部接口**。这是契约问题（他方私有结构随改版必碎），也是
   权限问题（插件代码不该占据一个"能翻用户白板"的位置）。
3. 工具**永不代持凭据**：不读 Cookie、不导出会话、不代用户完成登录。

内容级能力只能来自 boardmix 官方开放端点，落点是同一插件内的 `agent.mcpServers`（见文末）。

## 决定：四个工具 + 一个技能（工具集已由 0004 扩到七个）

### 工具

| id | 语义 | 何时用 |
| --- | --- | --- |
| `boardmix_open` | 打开并聚焦标签页，返回落地地址与登录阶段 | 一切 boardmix 任务的入口 |
| `boardmix_goto` | 让已开标签页导航到指定 boardmix 地址 | 用户给了白板链接，或说要去某处 |
| `boardmix_tab_status` | 只读快照，不产生任何副作用 | 动作之前先看一眼 |
| `boardmix_open_in_browser` | 用系统浏览器打开当前地址 | 页面在 webview 里不可用时的逃生口 |

统一返回体（JSON 字符串，与既有插件同口径）：

```json
{
  "ok": true,
  "open": true,
  "url": "https://boardmix.cn/app/recent-file",
  "origin": "https://boardmix.cn",
  "phase": "workspace",
  "seedLevel": 2,
  "landedAt": "2026-11-05T09:12:33Z",
  "next": "The tab is on the workspace. Call boardmix_goto to move it, or boardmix_tab_status to re-read state."
}
```

- `phase` ∈ `login` | `workspace` | `unknown`，按落地路径判定，见 0002。
- `seedLevel` ∈ 1–3，对应 0002 的阶梯，出了问题能立刻看出用的是哪一级种子。
- `next` 是给模型的下一条动作提示。工具描述里写清"先调 X"，模型才会按序用——这是既有的做法
  （`dbx-pro`、`rea` 的工具描述都这么写）。

### 为什么是这四个

每一个都对应一句用户会直接说出口的话，且都能在不碰画布内容的前提下真正完成。"导出白板""列出所有
节点"这类听起来更有用的工具，在官方端点出现之前只有两种实现：做不到，或者靠读页面内部结构做——后者
违反上面第 2 条。宁可有四个诚实的到达工具，也不要六个半真的——
后来补的两个工具（0004）同样是纯导航、带 `needsUserAction`，没有破例。

### 工具怎么摸到标签页

工具在 `src/index.tsx` 激活时注册，活在 React 树之外；`webview` 在组件里。中间放一个注册表，
**包内只有它持有标签页引用**：

```ts
// src/features/boardmix-workspace/services/tab-registry.ts
export interface BoardmixTabHandle {
  navigate(url: string): Promise<BoardmixSnapshot>;
  snapshot(): BoardmixSnapshot;
  openInBrowser(): Promise<boolean>;
}

export function setBoardmixTab(next: BoardmixTabHandle | null): void;
export function boardmixTab(): BoardmixTabHandle | null;
export function waitForBoardmixTab(timeoutMs?: number): Promise<BoardmixTabHandle | null>;
```

三条约定：

- 标签页卸载时 `setBoardmixTab(null)`，并让所有在等的调用**立即失败**（`reason: "tab-closed"`），
  不悬挂等待。
- `boardmix_open` 先 `ctx.ui.openActivityTab("boardmix", { width: "max" })`，再
  `waitForBoardmixTab(15000)`；拿不到句柄就返回 `open:false` 而不是抛错。
- **导航只有一条路**：工具调 `handle.navigate()`，组件里的 hook 执行 `webview.loadURL`，落地地址由
  `did-navigate` 回写。工具不直接碰 `webview` 元素，也不自己拼地址——地址仍归 0002 的阶梯与闸门管。

### 只读工具不制造副作用

`boardmix_tab_status` 在标签页未开时返回 `{ "open": false }`，**不自动开页**。模型只想确认状态时把
页面弹出来，是用户看得见的越界。`boardmix_goto` 同理：未开页就返回 `open:false` 并提示先调
`boardmix_open`，不隐式创建标签页。

### origin 闸门对工具同样生效

`boardmix_goto` 只接受 `https:` 且 host 为 `boardmix.cn` 或其子域；拒绝 `http:`、`javascript:`、
`data:`、`file:`、`blob:`。拒绝时返回 `{ ok: false, reason: "origin-not-allowed" }`，标签页不动。

校验实现只有一处（`resolveEntryTarget()`），UI 首次导航与工具导航共用——两份实现迟早分叉，而分叉
的那一半恰好是接受模型输入的那一半。

## 技能

`agent/skills/boardmix/SKILL.md`，在 `plugin.json.agent.skillPaths` 声明，`skillPresentation` 默认
可见。技能不重复工具参数表，写的是**判断**：

- **何时该开标签页**：用户要看、要画、要分享链接；只是问"boardmix 能干什么"就不开。
- **登录卡住怎么引导**：SSO 跳转、验证码、手机确认都由用户在页面里完成；Agent 不代填、不重试登录
  请求，只说"页面里完成登录后告诉我"。
- **边界要直说**：读不到画布内容、不能导出、不能批量改，用户问到就给可行替代（在页面里自己导出，
  或等官方端点上架）。
- **打开失败的顺序**：先看 `seedLevel`，再调 `boardmix_open`，最后 `boardmix_open_in_browser`。

技能放包内 `agent/skills/boardmix/`（相对包根，不在 `src/` 下），与四个编辑器插件的布局一致。

## plugin.json 的增量

```json
{
  "permissions": [
    "ui.slot.activity-tab",
    "storage.read",
    "storage.write",
    "shell.openExternal",
    "agent.tools.register",
    "agent.toolHandler.execute",
    "agent.skills.control"
  ],
  "agent": {
    "skillPaths": ["agent/skills/boardmix"],
    "skillPresentation": {
      "defaultVisibility": "visible",
      "surfaces": { "commandPalette": "visible", "skillPicker": "visible" }
    }
  }
}
```

三个 `agent.*` 权限的写法取自既有插件（`dbx-pro`、`rea` 都声明这三个；`feishu` 只声明
`agent.skills.control` 也能提供技能，Observed）。工具 id 前缀统一 `boardmix_`，`label` 走 locale 占位符（`%tool.open%`）。

## 为什么不用 agent.mcpServers 顶上

`mcpServers` 的每种形态都要有个真服务在跑：`type: "service"` 需要 `serviceId` + `path`
（`open-ai-canvas`、`xiaohongshu` 那样），远端形态需要一个官方 endpoint。boardmix 两者都没有。
为了让"工具"这个词成立而凭空拉一个本地进程，只换来多一个失败面。进程内 `registerTool` 已经把工具
交到 Agent 手里；官方端点出现后再加 `mcpServers` 是纯增量，不推翻现在这四个工具。

## 目录增量

```text
abilities/plugins/boardmix/
├── agent/skills/boardmix/SKILL.md           # 技能正文
└── src/
    ├── index.tsx                            # 装配：activity-tab + 注册工具，返回 Disposable[]
    ├── tools/
    │   ├── register-tools.ts                # 唯一注册处
    │   └── boardmix-navigation-tools.ts     # 四个工具的实现
    └── features/boardmix-workspace/services/
        ├── tab-registry.ts                  # 标签页句柄注册表
        └── entry-target.ts                  # origin 闸门，UI 与工具共用
```

## 验收

每一条都是可断言的，不是"应该能行"：

1. 冷启动调 `boardmix_open` → `ok:true`、`open:true`、`seedLevel` 有值。
2. 未登录时 → `phase:"login"`（落地路径为 `/user/login/`）。
3. `boardmix_goto { "url": "https://evil.example/x" }` → `ok:false`、`reason:"origin-not-allowed"`，
   且标签页 URL 未变。
4. 标签页未开时调 `boardmix_tab_status` → `{ open:false }`，断言 `openActivityTab` 未被调用。
5. 关闭标签页后再调 `boardmix_goto` → `ok:false`、`reason:"tab-closed"`，调用不悬挂。
6. 能力详情页能看到技能条目（`skillPresentation` 生效）。

## 不做的事

- 不把工具做成"页面自动化"（点击、填表、翻页）。那是把上游 UI 当私有 API 用，一次改版全废。
- 不暴露凭据类参数（没有 `token` / `cookie` 入参），也就不存在"插件保管密钥"的位置。
- 不给工具加静默执行。打开页面是有可见后果的动作，应该发生在用户眼前。
