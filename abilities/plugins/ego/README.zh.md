# ego-browser

`ego-browser` 是 Astravia 的 Agent 与 **ego lite** 之间的连接层。ego lite 是一款同时面向人类与 AI Agent 的 Chromium 浏览器；本技能把浏览器以一组页内 JavaScript 函数（snapshot、fill、click、wait、navigate、capture……）暴露给 Agent，让它用你真实的登录态去自动化网页操作——而不抢走你对浏览器的控制权。

## 工作原理

- **ego lite 应用**是外部浏览器，提供 `ego-browser` 命令。
- **本技能**告诉 Agent 如何驱动它：检查命令、读取与已装版本匹配的使用指南、通过 `ego-browser nodejs` 分轮次运行脚本。
- Agent 任务运行在相互隔离的**任务空间**里，共享你的 Cookie/会话但不触碰你的标签页，因此多个浏览器任务可并行执行。

## 安装

1. 安装 ego lite 浏览器：
   - macOS：运行 `scripts/install.sh`（按你的 CPU 架构下载并安装 DMG、去掉隔离属性并启动应用），或从 https://lite.ego.app/ 安装。
   - Windows：运行 `scripts/install.ps1`（下载并静默安装 x64 安装包、等待 `ego-browser` 就绪并启动应用），或从 https://lite.ego.app/ 安装。
   - 其他平台：从 https://lite.ego.app/ 安装。
   - Windows / 其他平台：从 https://lite.ego.app/ 下载安装，然后打开 ego lite。
2. 在应用内完成首次引导（可选：导入 Chrome 数据）。引导会把 `ego-browser` 命令注册进 PATH。
3. 确认命令可用：
   ```bash
   command -v ego-browser   # macOS / Linux
   Get-Command ego-browser  # PowerShell（Windows 引导后请新开一个终端）
   ```
4. 验证运行时并读取使用指南：
   ```bash
   ego-browser nodejs -e "console.log('ego-browser ready')"
   ego-browser skill
   ```

## 用法

把任何浏览器任务交给 Agent 即可——访问网站、填表、登录、截图、抽取数据、下载文件，或在多个页面间自动化一条流程。Agent 会加载本技能，确认 `ego-browser` 就绪，分轮次驱动浏览器。

在 Astravia 聊天里直接说，例如：

> ego-browser 帮我看一下 example.com 今天发布了什么

Agent 会在任务空间里打开页面、读取快照并汇报结果，你自己的标签页完全不受影响。

## 文件

- `SKILL.md` —— 浏览器任务时 Agent 加载的入口。
- `references/guide.md` —— 完整使用指南（API 面：snapshot、选择器、导航、等待、鼠标/键盘、页面/标签/PDF、下载、对话框、任务空间生命周期）。
- `references/install.md` —— ego lite 应用的安装/升级/排障。
- `references/clearing-state.md` —— 清理 Cookie、缓存或存储前必读（有些命令会清到整个浏览器配置）。
- `scripts/install.sh` —— macOS 一键安装脚本；`scripts/install.ps1` —— Windows 一键安装脚本（PowerShell 5.1+）。

## 许可证

本技能包以 MIT 协议发布。下游的 ego lite 浏览器是独立的免费产品，由 Citro Labs 以 MIT 协议发布（见 https://lite.ego.app/ 与 [ego-lite 仓库](https://github.com/citrolabs/ego-lite)）。