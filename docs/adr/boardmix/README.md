# boardmix 决策记录

`abilities/plugins/boardmix` 的设计记录。三件事：这件能力用什么**载体**承载、入口**地址由谁决定**、
宿主 **Agent 怎么调用**它。

| 编号 | 决定的 |
| --- | --- |
| [0001](0001-the-web-product-is-a-plugin-tab-not-an-mcp.md) | 插件标签页 + 远端 `webview` 承载，不用 MCP |
| [0002](0002-pin-the-origin-not-the-path.md) | 只钉 origin，路径运行时学习 |
| [0003](0003-the-plugin-is-agent-operable.md) | 向 Agent 开放工具与技能，作用域限于壳 |
| [0004](0004-tools-reach-the-page-skills-carry-the-work.md) | 工具只到「到达」：七个工具 + 五份技能，附能力覆盖矩阵 |
| [0005](0005-the-skill-index-is-its-description.md) | 技能的索引面是 description，正文按需加载；五份技能骨架统一，细节下沉 references，另加一份人格 |
| [0006](0006-automation-runs-before-the-answer.md) | 自动化是一次「运行」：提问时 hook 先行执行，状态落存储，面板覆盖层与对话同步显示 |
| [0007](0007-the-panel-becomes-readable.md) | 面板变成可读可点：`executeJavaScript` / `capturePage` / `sendInputEvent` 三件原生能力，缺一件就整体拒绝；画布仍是像素 |
| [0008](0008-the-chip-only-shows-while-you-look.md) | 面板不再自动上栏（`initiallyVisible: false`，工具仍能唤出），输入框下面的胶囊只在面板被选中时挂上，离开即清 |

## 一句话版本

- 用户要的是 boardmix 网页版本身，MCP 的 `mcp.json` 里没有界面这一档——**载体只能是插件**。
- 产品在 boardmix 的服务器上，插件里只有壳；壳不代理、不缓存、不镜像任何用户内容。
- `/app/*` 是 SPA catch-all，垃圾路径也 200，所以**删路由是静默的**：地址靠运行时学习，不靠探测。
- Agent 能开页、能定位、能建新页、能送 AI 入口、能交还地址；也能**读页面的控件并带坐标点击**，但画布上的图形只是像素——看得到、解析不了（ADR 0007）。
- 四个工具不够用，七个也还是不够：**工具只到「到达」，干活靠五份技能**。
- 五份技能怎么被选中：`description` 是唯一路由面，正文按需加载，细节在各自的 `references/`。
- 自动化不靠模型自觉：用户在提问里提到 `boardmix` / 白板，面板在回答之前就已经走到位了。
- 面板不占惯常位置：不上标签栏，进面板的「+」列表；工具调用会把它打开并选中。输入框下面的胶囊只在面板被选中时挂上（ADR 0008）。
- 免费账号 3 个文件 / 单文件 150 图元 / 导出带水印——限额要在动手前说，别在结算页才说。

## 两种载体

| | `abilities/mcp/boardmix` | 插件 + 远端 `webview`（采纳） |
| --- | --- | --- |
| 用户能用到网页版产品 | 不能 | 能，就是 boardmix 本身 |
| 登录态 | 只对 Agent 有效 | `persist:` 分区，一次登录长期有效 |
| Agent 可调用面 | 取决于官方端点（目前没有） | 七个工具 + 五份技能 |
| 包体积 | 极小 | 几百 KB 的壳 |

## 入口地址的处理

| 级 | 候选 | 说明 |
| --- | --- | --- |
| 0 | `entryUrlOverride` | 人工覆盖，优先于整条阶梯；上游改动可不发版恢复 |
| 1 | `storage.lastGoodUrl` | 上次真实落地地址 |
| 2 | `https://boardmix.cn/app/` | SPA 挂载点，默认种子 |
| 3 | `https://boardmix.cn/` | 站点根 |

落库前校验 `https:` + host 为 `boardmix.cn` 子域；**该校验不拦导航**，否则会把 SSO 跳转掐断。

## Agent 面

| 工具 | 语义 |
| --- | --- |
| `boardmix_open` | 打开并聚焦标签页，返回落地地址与登录阶段 |
| `boardmix_goto` | 让已开标签页导航到指定 boardmix 地址 |
| `boardmix_tab_status` | 只读快照，不产生副作用 |
| `boardmix_open_in_browser` | 系统浏览器打开当前地址（逃生口） |
| `boardmix_new` | 送到新建入口（`/app/create`），`needsUserAction: true` |
| `boardmix_ai` | 送到 AI 入口，`kind` ∈ `ppt` / `flowchart` / `chat` |
| `boardmix_automate` | 跑一条 recipe（focus / create / ai-* / open-url），返回逐步骤结果与落点 |

五个技能写在 `agent/skills/`，主技能做路由，四份子技能管领域操作路径。模型每轮只看得到
`name` + `description` 的索引，正文按需加载，深细节在各自的 `references/`（见 0005）：

| 技能 | 管什么 | 按需读什么 |
| --- | --- | --- |
| `boardmix` | 能不能办、登录卡住怎么办、打开失败的顺序、`needsUserAction` 怎么接 | `tool-envelope.md` / `page-map.md` |
| `boardmix-canvas` | 便签 / 导图 / 流程图 / 文档卡片 / 表格，Mermaid 与 Markdown 交接 | `diagram-recipes.md` |
| `boardmix-collaboration` | 分享与权限、评论、投票、演示模式、分组讨论 | `run-a-session.md` |
| `boardmix-ai` | AI 生成 PPT / 流程图 / 文档；点数门槛；画布检索在页面内 | `prompt-recipes.md` |
| `boardmix-io` | 导入 PPT/PDF ≤ 50 MB、Mermaid；导出档位与免费版水印 | `format-matrix.md` |

另外一份人格 `agent/agents/boardmix-guide.md`（`agent.agents[]` 的 `systemPromptPath`）规定「通过
技能工作」和收尾形状；不声明 `roles`，不占宿主预置角色槽位。

技能写判断，不写工具参数；产出物只四种：Mermaid、Markdown、纯文本大纲、表格（见 0004）。

## 依据的既有机制

- `web-element-picker`（已发布 `0.3.8`）：`ui.slot.activity-tab` + `<webview partition=… allowpopups>`，
  `plugin.json` 无 `network` 块仍可加载任意站点。
- `dbx-pro` / `rea`：`ctx.agent.registerTool()` + `agent.tools.register` /
  `agent.toolHandler.execute` / `agent.skills.control` 四件套，`agent/skills/<name>` 技能目录。
- `feishu` / `shimo`：只靠 `agent.skills.control` + `agent.skillPaths` 就能把技能交给 Agent。
- 包契约与命名规则：[`docs/plugin-project-structure.md`](../../plugin-project-structure.md)。
