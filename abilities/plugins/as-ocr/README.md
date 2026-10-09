# as-ocr · 代码审查插件

桥接 [alibaba/open-code-review](https://github.com/alibaba/open-code-review)（44k★，Apache-2.0，Go）——确定性管线 × Agent 混合的 AI 代码审查：行级精确发现、内置 NPE/线程安全/XSS/SQL 注入规则、智能文件分包、评论定位与反思模块。

## 形态

- **agent 工具 `code_review`**：对话里说「审查一下改动」即触发。工作区模式（staged+unstaged+untracked）或分支区间（`from` 参数）。发现按严重度分组返回给模型，可直接进入修复讨论。
- **活动面板「审查」标签**：历史 20 次运行留存，按 critical/major/minor/info 分组、file:line 定位。
- **零服务进程，依赖自动装**：插件不捆绑二进制——ocr 由宿主按 `plugin.json#providers.cli` 的声明安装（npm 全局包，约 53 MB），启用插件后自动完成；安装阶段与日志实时显示在「审查」标签页顶部。

## 依赖（自动安装）

启用插件时宿主自动完成，不需要你动手：

1. 探测 `ocr --version`；
2. 缺失则 `npm i -g @alibaba-group/open-code-review@latest`（约 53 MB，通常 10~60 秒）；
3. 复探一次，就绪后才开始审查。

进度显示在「审查」标签页顶部（状态条 + 可展开的安装日志），失败会出现「重试安装」按钮；面板没打开时也会收到一条通知。想自己装也可以：

```bash
npm i -g @alibaba-group/open-code-review@latest
# 或
brew install open-code-review
# 或
go install github.com/alibaba/open-code-review/cmd/ocr@latest
```

ocr 自身需要一个 OpenAI 兼容端点（叙述审查用）；delegate 模式下可复用当前 agent 的模型。详见 [ocr 文档](https://github.com/alibaba/open-code-review)。

## 权限清单（最小集）

`ui.slot.activity-tab` · `agent.tools.register` · `agent.toolHandler.execute` · `agent.session.read` · `storage.read/write` · `fs.read` · `shell.openExternal`

## 许可

- 本插件：Apache-2.0
- 桥接的上游项目：alibaba/open-code-review（Apache-2.0）
