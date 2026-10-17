# as-ocr · 代码审查插件

桥接 [alibaba/open-code-review](https://github.com/alibaba/open-code-review)（44k★，Apache-2.0，Go）——确定性管线 × Agent 混合的 AI 代码审查：行级精确发现、内置 NPE/线程安全/XSS/SQL 注入规则、智能文件分包、评论定位与反思模块。

## 形态

- **agent 工具 `code_review`**：对话里说「审查一下改动」即触发。工作区模式（staged+unstaged+untracked）或分支区间（`from` 参数）。默认走 **委托模式**：ocr 只负责选文件与给规则，diff 由 git 取，判断交给会话里的模型——**不需要任何 API Key**。审完由 `code_review_report` 把发现写回面板。
- **活动面板「代码审查」标签**：历史 20 次运行留存，按文件分组、file:line 定位；可按级别（critical/high/medium/low）与类别（bug/security/performance/…）筛选，发现可带原文/建议改法对照，处理过的标「已修复/忽略」后默认隐藏。
- **零服务进程，依赖自动装**：插件不捆绑二进制——ocr 由宿主按 `plugin.json#providers.cli` 的声明安装（npm 全局包，约 53 MB），启用插件后自动完成；安装阶段与日志实时显示在「代码审查」标签页顶部。
- **两种输出共用一套发现模型**：委托模式由 `code_review_report` 上报，ocr 模式直接解析 `ocr review --format json` 的 stdout（上游保证 json 格式下 stdout 只有单一结果文档，进度全部在 stderr）——`comments[]` 的 `path/content/start_line/end_line/existing_code/suggestion_code/category/severity` 统一归一化成四级、八类的发现；旧记录的 `major/minor/info` 自动映射，非法值落 `low` / `other`。

## 依赖（自动安装）

启用插件时宿主自动完成，不需要你动手：

1. 探测 `ocr --version`；
2. 缺失则 `npm i -g @alibaba-group/open-code-review@latest`（约 53 MB，通常 10~60 秒）；
3. 复探一次，就绪后才开始审查。

进度显示在「代码审查」标签页顶部（状态条 + 可展开的安装日志），失败会出现「重试安装」按钮；面板没打开时也会收到一条通知。想自己装也可以：

```bash
npm i -g @alibaba-group/open-code-review@latest
# 或
brew install open-code-review
# 或
go install github.com/alibaba/open-code-review/cmd/ocr@latest
```

### 两种执行模式

| 模式 | 需要配置 | 谁做判断 | 何时用 |
| --- | --- | --- | --- |
| **委托 delegate**（默认） | 无 | 当前会话的模型 | 开箱即用（推荐） |
| ocr 托管 | `ocr config provider` + 端点 | ocr 自己调 LLM | 已配好端点、想要 ocr 的内置提示词与反思流程（传 `engine: "ocr"`） |

`ocr review` 必须先有 LLM 端点，否则报 `no valid LLM endpoint configured`——这也是过去「代码审查不可用」的第二层原因。委托模式绕开了这一层：`ocr delegate preview` / `delegate rule` 都是纯确定性计算，无需模型。

委托模式需要工作区是 **git 仓库**（ocr 用它枚举改动、`git` 用来取 diff），所以插件声明了 `agent.command.run` 权限与 `commands: ["git"]`（仅 `git`，只跑 diff/show，由你在设置里单独开关）。

会话本身没有绑定目录时（从 Finder 启动的宿主主进程 cwd 是 `/`），`session.cwd` 可能是空或根，这时插件会退回文件列表里当前打开的项目作为审查目录——所以额外声明了 `workspace.read`（只读根目录路径，不改任何文件）。未授权时退回逻辑直接跳过，行为回到「请先打开项目」。

## 权限清单（最小集）

`ui.slot.activity-tab` · `agent.tools.register` · `agent.toolHandler.execute` · `agent.session.read` · `workspace.read` · `storage.read/write` · `agent.command.run`（仅 `git`）· `shell.openExternal`

## 许可

- 本插件：Apache-2.0
- 桥接的上游项目：alibaba/open-code-review（Apache-2.0）
