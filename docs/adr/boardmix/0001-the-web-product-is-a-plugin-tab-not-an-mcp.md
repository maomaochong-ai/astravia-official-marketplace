# 用插件标签页承载 boardmix，不用 MCP

- 状态：已采纳（2026-11-05）
- 范围：新建 `abilities/plugins/boardmix`，全新工程，版本从 `0.0.1` 起算
- 相关：[0002](0002-pin-the-origin-not-the-path.md)（入口地址怎么取）、[0003](0003-the-plugin-is-agent-operable.md)（Agent 怎么用）

## 问题

目标：用户在能力页面完成 boardmix 认证登录后，直接用**原汁原味的 boardmix 网页产品**——它自己的画布、
工具栏、模板库与多人协作；同时宿主 Agent 能调用它完成任务。

候选只有两条：`abilities/mcp/boardmix/`（`mcp.json`）或 `abilities/plugins/boardmix/`。这不是风格之争，
而是"这层东西有没有界面、能不能被 Agent 操作"之分。

## 决定

**做插件，不做 MCP。** 载体是 `ui.slot.activity-tab` 里的原生 `<webview>`，加载 boardmix 自己的 origin；
地址由 0002 的阶梯解析，Agent 面由 0003 / 0004 的七个工具与五份技能提供（第七个工具见 [0006](0006-automation-runs-before-the-answer.md)）。

## 否决 MCP 的三条事实

### 一、`mcp.json` 的 schema 里没有界面这一档

`mcp.json` 是 strict schema，多写任何键都会失败，白名单只有 `schemaVersion`、`slug`、`version`、
`server`、`parameters`、`browserAuth`、`setup`、`runtime`（见 `AGENTS.md`「mcp」节与
`abilities/mcp/*/mcp.json`，Observed）。没有 UI、插槽、页面或皮肤字段。

于是 MCP 能力的界面在客户端里是固定的：一张连接参数表单 + 一份工具清单。它能做的最接近"登录"的事是
`setup: http-qrcode`，而那份登录态的去向是 **Agent 的工具调用**，不是用户的屏幕。

"让 AI 读我的白板"和"我自己要画这块白板"是两个需求，这里要的是后者。

### 二、boardmix 侧没有可接的开放端点（Observed，2026-11-05）

| 探测 | 结果 |
| --- | --- |
| `https://boardmix.cn/mcp` | 404 |
| `https://boardmix.cn/open-platform` | 404 |
| `https://boardmix.cn/developer` | 301（站点重定向，非开放平台） |
| `openapi.boardmix.cn` | DNS 不解析 |

没有官方端点，MCP 路线就只剩"照着他方站点的内部接口自己写一份"这一条，那是随上游改版必碎的活，
也不该被当成默认路线。

### 三、boardmix 是服务端产品，插件里没有"产品"可装

页面一启动就声明自己的服务端：

```js
window.__global_env__ = {
  hashVersion: "7268cf595a3374578ecdf5f5af731a6f253ef2dbdfdedbee",
  HTTP_API_BASE: "https://api.boardmix.cn",
  HTTP_CDN_BASE: "https://cdnhw.boardmix.cn",
  DEPLOY_TYPE: "www",
  HTTP_SERVER_BASE: ""
}
```

（Observed，页面内联脚本）登录、文件、模板、协作、存储全在它自己的服务器上。插件能打包的只有壳；
要拿到产品本身，必须让页面跑在**它自己的 origin** 上。

## 采用形态

```tsx
<webview
  src={entryUrl}            // 由 0002 的种子阶梯解析，不是写死的字符串
  partition="persist:astravia-boardmix"
  allowpopups
  className="h-full w-full"
/>
```

四条依据：

1. **该机制在宿主里已经跑通。** `abilities/plugins/web-element-picker`（已发布 `0.3.8`）就是
   `ui.slot.activity-tab` + `<webview>` 加载任意远端站点。
2. **`webview` 是真 Chromium guest**：独立 origin，自有 Cookie / IndexedDB / localStorage /
   WebSocket / WebGL / 剪贴板。板类应用需要的并发画布与大对象存储都在，无需 polyfill。
3. **`persist:` 分区让登录态跨重启存在**，这就是"认证一次之后就能用"的实现点——壳不保存、不转发、
   不读取任何凭据。
4. **不声明 `network.allowedHosts`。** 该白名单约束插件自己的 `network.fetch`（对照
   `abilities/plugins/xiaohongshu` 的 `allowedHosts`），而 `web-element-picker` 的 `plugin.json`
   没有 `network` 块，照样在 webview 里加载任意站点（Observed）。给 boardmix 加白名单不起作用，还会
   让人误以为壳在代理网络。

### 为什么分区名独立

固定 `persist:astravia-boardmix`，不复用内置浏览器的 `persist:astravia-browser`：用户可能在内置浏览器
里登的是另一个 boardmix 账号，共用分区会互相顶掉；卸载插件时也只清这一份，不牵动其它会话。

## 包契约（按仓库规范对齐）

契约的权威来源是 `AGENTS.md`「plugin」节与
[`docs/plugin-project-structure.md`](../../plugin-project-structure.md)（推荐目录 / 命名规则 / 职责
边界 / 测试约定）。`docs/daily-reports/` 是日报生成器，不含插件包契约条款，不作为依据。

```text
abilities/plugins/boardmix/
├── .gitignore                      # node_modules / dist / *.log / .DS_Store
├── plugin.json                     # 身份、权限、entry、styles、moduleFederation、agent
├── ability.json                    # 市场展示身份，icon 指向 assets/icon.png
├── detail.json                     # 英文详情
├── detail.zh.json                  # 中文覆盖
├── README.md                       # 接入、入口地址如何热修、排错
├── package.json                    # @astravia-marketplace/boardmix，private，type: module
├── package-lock.json
├── tsconfig.json
├── vitest.config.ts                # 只跑 src/**/*.test.ts(x)
├── vite.config.ts                  # base "./" + tailwindcss() + astraviaPluginFederation
├── assets/icon.png                 # 官方位图 192×192
├── locales/                        # 运行期 i18n catalog（%name% / %tool.*.label% 等占位符）
├── agent/                          # 五份技能 + 一份人格，见 0004、0005
│   ├── agents/boardmix-guide.md    # 人格：systemPromptPath 指向它
│   └── skills/
│       ├── boardmix/               # 主技能：路由、登录、失败恢复
│       │   ├── SKILL.md
│       │   └── references/{tool-envelope,page-map}.md
│       ├── boardmix-canvas/        # 创作与结构
│       │   ├── SKILL.md
│       │   └── references/diagram-recipes.md
│       ├── boardmix-collaboration/ # 协作与分享
│       │   ├── SKILL.md
│       │   └── references/run-a-session.md
│       ├── boardmix-ai/            # AI 生成与点数
│       │   ├── SKILL.md
│       │   └── references/prompt-recipes.md
│       └── boardmix-io/            # 导入导出与限额
│           ├── SKILL.md
│           └── references/format-matrix.md
├── release/                        # 本地构建产物，不提交
└── src/
    ├── index.tsx                   # 唯一装配入口：activity-tab + 注册工具，返回 Disposable[]
    ├── runtime-contract.ts         # 宿主能力最小类型边界
    ├── style.css                   # @import "tailwindcss"
    ├── domain/
    │   ├── boardmix-destinations.ts  # 唯一写死域名的地方：origin、目的地、登录前缀
    │   ├── boardmix-entry.ts       # 种子阶梯 + lastGood 读写 schema（纯函数）
    │   └── boardmix-entry.test.ts
    ├── plugin-ids.ts               # 标签页 id、webview partition、七个工具 id
    ├── jsx.d.ts                    # 补 <webview> 的运行时方法声明
    ├── tools/
    │   ├── register-tools.ts
    │   ├── boardmix-navigation-tools.ts    # open / goto / status / open-in-browser
    │   └── boardmix-destination-tools.ts   # new / ai，带 needsUserAction
    ├── features/boardmix-workspace/
    │   ├── components/
    │   │   ├── boardmix-surface.tsx        # <webview> 的唯一持有者
    │   │   ├── boardmix-surface.test.tsx   # 首屏种子、降级、navigate 收敛
    │   │   ├── boardmix-workspace.tsx      # 读写入口状态 + 把句柄交给 registry
    │   │   ├── load-failure-notice.tsx     # 阶梯耗尽时的重试与逃生口
    │   │   └── login-required-notice.tsx   # 未登录引导条
    │   ├── hooks/
    │   │   └── use-boardmix-entry.ts       # 导航事件 → 落地 URL → 持久化
    │   ├── services/
    │   │   ├── tab-registry.ts             # 标签页句柄，工具由此触达
    │   │   └── entry-target.ts             # origin 闸门，UI 与工具共用
    │   └── index.ts
```

`plugin.json`：

```json
{
  "id": "boardmix",
  "name": "%name%",
  "description": "%description%",
  "icon": "assets/icon.png",
  "version": "0.0.1",
  "pluginApiVersion": "^2.0.0",
  "entry": "dist/mf-manifest.json",
  "moduleFederation": { "remoteName": "boardmix", "expose": "./plugin" },
  "styles": ["dist/style.css"],
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
    "skillPaths": [
      "agent/skills/boardmix",
      "agent/skills/boardmix-canvas",
      "agent/skills/boardmix-collaboration",
      "agent/skills/boardmix-ai",
      "agent/skills/boardmix-io"
    ],
    "skillPresentation": {
      "defaultVisibility": "visible",
      "surfaces": { "commandPalette": "visible", "skillPicker": "visible" },
      "skills": {
        "boardmix": { "displayName": "%skill.boardmix.name%", "displayDescription": "%skill.boardmix.description%" },
        "boardmix-canvas": { "displayName": "%skill.boardmix-canvas.name%", "displayDescription": "%skill.boardmix-canvas.description%" },
        "boardmix-collaboration": { "displayName": "%skill.boardmix-collaboration.name%", "displayDescription": "%skill.boardmix-collaboration.description%" },
        "boardmix-ai": { "displayName": "%skill.boardmix-ai.name%", "displayDescription": "%skill.boardmix-ai.description%" },
        "boardmix-io": { "displayName": "%skill.boardmix-io.name%", "displayDescription": "%skill.boardmix-io.description%" }
      }
    },
    "agents": [
      {
        "id": "boardmix-guide",
        "name": "%agent.boardmix-guide.name%",
        "description": "%agent.boardmix-guide.description%",
        "mentionHandle": "boardmix",
        "avatar": "assets/icon.png",
        "systemPromptPath": "agent/agents/boardmix-guide.md",
        "abilities": "all"
      }
    ]
  }
}
```

| 权限 | 用途 |
| --- | --- |
| `ui.slot.activity-tab` | 提供标签页表面 |
| `storage.read` / `storage.write` | 记 `lastGoodUrl` 与人工覆盖的入口 |
| `shell.openExternal` | 阶梯全败时的逃生口，也是 `boardmix_open_in_browser` |
| `agent.tools.register` / `agent.toolHandler.execute` | 注册并执行 0003 / 0004 / 0006 的七个工具 |
| `agent.skills.control` | 提供五份技能，见 0003、0004 |

**不声明** `network.fetch`、`secrets.read/write`、`fs.*`：壳不代理任何请求、不落盘用户内容，凭据只存在
于 webview 的 Cookie 罐里，插件代码碰不到。这不是省事，是不给自己留一个"能读用户 token"的位置。

依赖与构建（与既有插件同口径，Observed）：`@astravia-org/plugin-sdk`、`@astravia-org/plugin-vite`、
`react` / `react-dom` 19、`tailwindcss` 4 + `@tailwindcss/vite`、`vite` 7、`typescript` 5；测试用
`vitest` 3 + `jsdom` + `@testing-library/react` / `@testing-library/dom`。`vite.config.ts` 用 `base: "./"`、`tailwindcss()`,
`astraviaPluginFederation({ name: "boardmix", entry: "./src/index.tsx" })`、JSX automatic。
`dist/`、`node_modules/` 与 `release/` 不入源码 Git。

图标：`https://cdnhw.boardmix.cn/app/logo.png`（Observed，192×192 PNG RGBA，9.6 KB），是 boardmix
页面自己引用的官方 logo，直接落成 `assets/icon.png`。不用近似图标库图形——按 `AGENTS.md`，有官方品牌
标识的产品必须用官方位图。

体积：几百 KB 的壳，不含任何站点字节。

## 登录状态怎么判定

只看页面在哪（`did-navigate` / `did-navigate-in-page` 报的落地 URL），不读 Cookie、不看存储、不猜内部
状态。未登录时显示一条"请在下方完成登录"的提示条，**不弹自己的表单、不伪造登录界面**。

具体路由集合与登录入口见 [0002](0002-pin-the-origin-not-the-path.md)。

## 弹窗、外链与文件

- `allowpopups` 打开。Electron 34 的 WebviewTag 已无 `new-window` 事件，宿主 `window-manager.ts` 用
  `did-attach-webview → setWindowOpenHandler → 同一 webview loadURL` 接管 `target=_blank` /
  `window.open`（`web-element-picker` 源码注释记作实测稳定，Observed）。所以壳**不在自己的代码里拦锚点**——那会和
  宿主的重定向抢点击，表现为"点了没反应"。
- 导出/下载交给 webview 自己的下载机制，壳不接管文件路径。
- "在系统浏览器打开"只是逃生口，不作主路径：主路径一旦分流，登录态就分家了。

## Agent 面

七个工具：`boardmix_open` / `boardmix_goto` / `boardmix_new` / `boardmix_ai` /
`boardmix_tab_status` / `boardmix_open_in_browser` / `boardmix_automate`，配五份技能，全部作用于壳、不触碰画布内容。
工具只能把用户**送到**能办事的那一屏，真正的操作在页面里——这个取舍与能力覆盖矩阵见
[0004](0004-tools-reach-the-page-skills-carry-the-work.md)，边界、接线与验收见 [0003](0003-the-plugin-is-agent-operable.md)。

## 能力页必须说清楚的话

详情页不能把"壳 + 远端产品"说成"boardmix 被装进了 Astravia"：

- 这是**一层外壳**，画布、模板、协作、存储都在 boardmix 的服务器上；账号、套餐与配额归 boardmix。
- **离线不可用**。
- 壳**不代理、不缓存、不镜像**任何用户内容；画布数据不经过 Astravia 的服务器。
- Agent 能帮你**打开、定位、送到新建与 AI 入口、交还地址**；读不到画布内容、点不了按钮、导不出文件——
  这句要写在详情里，不能等用户问。
- **免费账号有硬限额**：3 个可编辑文件、单文件 150 个图元、导出标清带水印。详情页要直说，否则用户会以为
  是插件没做到。

## 两种方案的取舍

| | `abilities/mcp/boardmix` | **插件 + 远端 `webview`（采纳）** |
| --- | --- | --- |
| 用户能用到网页版产品 | 不能，没有界面 | 能，就是 boardmix 本身 |
| 登录态 | 只对 Agent 有效 | `persist:` 分区，一次登录长期有效 |
| Agent 可调用面 | 取决于官方端点（目前没有） | 七个工具 + 五份技能，进程内直连 |
| 包体积 | 极小 | 几百 KB |
| 上游改版影响 | 无（也无效） | 页面自动跟随 |
| 主要代价 | 答非所问 | 在线依赖；内容级 Agent 能力要等官方端点 |

## 不做的事

- 不照着他方站点内部接口另写一套调用层来"替代"网页版。
- 不读取页面内部结构来做 Agent 工具：跨域之外，那份结构还会随上游改版失效。
- 不重实现画布、工具栏或模板库。
- 不在 webview 外层再包一层自有 UI 去"统一体验"——每加一个按钮，用户就多一处与 boardmix 不一致的地方。

## 开工命令

```bash
npx @astravia-org/plugin-cli init --id boardmix --name "Boardmix" abilities/plugins/boardmix
cd abilities/plugins/boardmix && npm install && npm run build
```

`init` 只创建目录，不动市场索引；上架是单独一步，按 `AGENTS.md`「添加一个能力的流程」在
`.astravia/marketplace.source.json` 登记 `type: plugin` 条目并声明 `minAppVersion`。
