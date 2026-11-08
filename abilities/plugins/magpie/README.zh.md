# Magpie 网关

把本机运行的 [magpie](https://usemagpie.ai) 网关接进 Astravia。magpie 用一个本地 OpenAI 兼容端点，把你已经配好的所有提供方统一到一处；这个插件读它的模型目录，并在你点「发布」时把这些模型写进 Astravia 自己的模型选择器。

## 它做什么

- 用 `GET /api/version` 判活，并确认对面真的是 magpie，而不是占用同一端口的别的服务。
- 读 `GET /v1/models`，逐行展示提供方、上下文窗口、是否吃图、是否支持推理。
- 你点一下，才把目录写成宿主的 `openai-completions` 提供方；不会自动同步。
- 注册两个只读 Agent 工具：`magpie_status`、`magpie_models`。
- 打开 magpie 自己的页面（`127.0.0.1:3430`）去配提供方。

## 它不做什么

- 不安装、不启动、不停止 magpie，包里也没有任何二进制。magpie 是 Go 程序，五个平台各 15–25 MB，而包体上限是 50 MB，随包分发没有可行性。
- 不保存你的提供方密钥。那些在 magpie 自己的配置里（`~/.config/magpie`）；插件只在自己的私有存储里放网关地址与网关密钥。
- 不做请求代理。发布之后是 Astravia 直接连网关。
- magpie 没在跑的时候连不上。面板会区分「连接被拒 / 超时 / 不是 magpie / HTTP 错误」。

## 安装 magpie

```bash
curl -fsSL https://usemagpie.ai/install.sh | sh
magpie serve          # 或打开 App；网关默认 127.0.0.1:3425
```

发布前先在 magpie 里加好至少一个提供方：空目录会被拒绝写入，而不是写成一个空提供方。

## 用到的端点

| 用途 | 请求 |
| --- | --- |
| 判活与身份 | `GET {baseUrl}/api/version` → `{ "version": "…" }` |
| 模型目录 | `GET {baseUrl}/v1/models` → `{ "object": "list", "data": [ … ] }` |
| 写进宿主的 baseUrl | `{baseUrl}/v1` |
| magpie 页面 | 网关在默认端口时为 `127.0.0.1:3430` |

`baseUrl` 默认 `http://127.0.0.1:3425`。请求经 `ctx.network`（主进程发起），不受 renderer 的 CORS 限制；`plugin.json` 声明了 `network.allowedHosts` 的 `127.0.0.1` 与 `localhost`，宿主只按主机名匹配，端口不参与。

## 开发

```bash
npm install
npm run check     # tsc --noEmit
npx vitest run    # 纯函数模块 + 控制器
npm run build     # 产出 release/magpie-<version>.astraviapkg
```

版本规则遵循本仓库：改动 `src/`、`plugin.json`、`package.json`、`locales/`、`assets/` 或 `scripts/` 都必须抬版本，因为 CI 会拿已发布的源码 sha 比对运行内容。
