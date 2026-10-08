# as-ocr · 代码审查插件

桥接 [alibaba/open-code-review](https://github.com/alibaba/open-code-review)（44k★，Apache-2.0，Go）——确定性管线 × Agent 混合的 AI 代码审查：行级精确发现、内置 NPE/线程安全/XSS/SQL 注入规则、智能文件分包、评论定位与反思模块。

## 形态

- **agent 工具 `code_review`**：对话里说「审查一下改动」即触发。工作区模式（staged+unstaged+untracked）或分支区间（`from` 参数）。发现按严重度分组返回给模型，可直接进入修复讨论。
- **活动面板「审查」标签**：历史 20 次运行留存，按 critical/major/minor/info 分组、file:line 定位。
- **零服务进程**：ocr 是用户自装的本地 CLI（与 git 同地位），插件不捆绑二进制、不代下载——探测不到时给出安装指引。

## 前置

```bash
# macOS
brew install open-code-review
# 或
go install github.com/alibaba/open-code-review/cmd/ocr@latest
```

ocr 自身需要一个 OpenAI 兼容端点（叙述审查用）；delegate 模式下可复用当前 agent 的模型。详见 [ocr 文档](https://github.com/alibaba/open-code-review)。

## 权限清单（最小集）

`ui.slot.activity-tab` · `agent.tools.register` · `agent.toolHandler.execute` · `agent.session.read` · `storage.read/write` · `terminal.run` · `fs.read` · `shell.openExternal`

## 许可

- 本插件：Apache-2.0
- 桥接的上游项目：alibaba/open-code-review（Apache-2.0）
