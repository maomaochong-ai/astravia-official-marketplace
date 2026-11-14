# Magpie 网关

把本机运行的 [magpie](https://usemagpie.ai) 网关接进 Astravia。magpie 用一个本地 OpenAI 兼容端点，把你已经配好的所有提供方统一到一处；这个插件读它的模型目录，并在你点「发布」时把这些模型写进 Astravia 自己的模型选择器。

## 它做什么

- 先问身份：`GET /api/hello` 返回 `{ "name": "magpie", "version": … }`，所以占着同一端口的别的 Ollama 兼容服务不会被误认成 magpie。
- 读 `GET /v1/models`，逐行展示提供方、上下文窗口、是否吃图、是否支持推理。
- 你点一下，才把目录写成宿主的 `openai-completions` 提供方；不会自动同步。
- 注册两个只读 Agent 工具：`magpie_status`、`magpie_models`。
- 打开 magpie 自己的页面（`127.0.0.1:3430`）去配提供方。
- 本机没有 magpie 时，面板上的按钮会装上并拉起：读发布 feed、按其中公布的 SHA-256 校验、装到 `~/.local/bin/magpie`，再以插件子进程的方式跑 `magpie serve`。

## 它不做什么

- 不把二进制打进包里。magpie 是 Go 程序，五个平台各 15–25 MB，而包体上限 50 MB。改成你点按钮时下载官方构建，装之前先用 `https://usemagpie.ai/api/latest` 里公布的校验和核对。
- 不装系统服务。`magpie serve` 是插件的子进程，Astravia 退出它也跟着停；不写 launchd、不要 `sudo`、不改 `PATH`，除 `~/.local/bin` 与插件自己的存储之外不落文件。要重启后仍在跑，在终端执行一次 `magpie daemon install`。
- 未经你允许不跑 `sh`。第一次按那个按钮时，Astravia 会问你是否允许这个插件执行 `sh`；拒绝的话面板会直说，不会静默失败。
- 不保存你的提供方密钥。那些在 magpie 自己的配置里（`~/.config/magpie`）；插件只在自己的私有存储里放网关地址与网关密钥。
- 不做请求代理。发布之后是 Astravia 直接连网关。
- magpie 没在跑的时候连不上。面板会区分「连接被拒 / 超时 / 不是 magpie / HTTP 错误」。

## 安装 magpie

两种方式，都在本机完成：

1. **面板里**——打开「Magpie 网关」视图，按 **安装并启动**。插件取发布 feed、校验校验和、装到 `~/.local/bin/magpie`，然后拉起网关。
2. **手动**——运行官方安装器：

```bash
curl -fsSL https://usemagpie.ai/install.sh | sh
magpie serve          # 或打开 App；网关默认 127.0.0.1:3425
```

无论哪种，发布前先在 magpie 里加好至少一个提供方：空目录会被拒绝写入，而不是写成一个空提供方。

插件拉起的网关是子进程，Astravia 一退出它就停。要一个跨登录常驻的，用 magpie 自己的服务：`magpie daemon install`。

## 用到的端点

| 用途 | 请求 |
| --- | --- |
| 身份 | `GET {baseUrl}/api/hello` → `{ "name": "magpie", "version": "…" }` |
| 判活回退 | `GET {baseUrl}/api/version` → `{ "version": "…" }` |
| 发布 feed | `GET https://usemagpie.ai/api/latest` → 各平台的 `url`、`size`、`sha256` |
| 模型目录 | `GET {baseUrl}/v1/models` → `{ "object": "list", "data": [ … ] }` |
| 写进宿主的 baseUrl | `{baseUrl}/v1` |
| magpie 页面 | 网关在默认端口时为 `127.0.0.1:3430` |

`baseUrl` 默认 `http://127.0.0.1:3425`。请求经 `ctx.network`（主进程发起），不受 renderer 的 CORS 限制；`plugin.json` 声明了 `network.allowedHosts` 的 `127.0.0.1`、`localhost` 与 `usemagpie.ai`，宿主只按主机名匹配，端口不参与。

安装与启动走 `ctx.command`，两条执行面（`src/platform-shell.ts`）：POSIX 交给 `sh -c`，Windows 交给 `powershell -EncodedCommand`（一个参数、不拼接命令文本）。`plugin.json` 声明的就是这两个裸命令名。脚本里唯一被插值的只有发布 URL（必须属于厂商域名）、64 位小写十六进制校验和，以及可选的字节数。

Windows 装到 `%LOCALAPPDATA%\magpie\bin\magpie.exe`，用 `Get-FileHash -Algorithm SHA256` 校验；POSIX 装到 `~/.local/bin/magpie`，用 `shasum -a 256` 或 `sha256sum`。两套脚本输出同一套行协议（`path=` / `version=` / `progress N M` / `verifying` / `installed <path>`），所以解析器只有一份。

## 开发

```bash
npm install
npm run check     # tsc --noEmit
npx vitest run    # 纯函数模块 + 控制器
npm run build     # 产出 release/magpie-<version>.astraviapkg
```

版本规则遵循本仓库：改动 `src/`、`plugin.json`、`package.json`、`locales/`、`assets/` 或 `scripts/` 都必须抬版本，因为 CI 会拿已发布的源码 sha 比对运行内容。
