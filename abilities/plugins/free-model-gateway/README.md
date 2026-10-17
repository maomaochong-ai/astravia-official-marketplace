# Free Model Gateway（免费模型网关）

Astravia 外置插件：把 [our-free-model](https://github.com/Ebony-Vinyl/dsh-our-free-model)（MIT）的 standalone 服务器**随插件一起分发**，以宿主托管进程运行，并把 `/v1/models` 同步进 Astravia 模型注册表，作为 OpenAI 兼容端点供所有会话使用。

**装完即用**：安装插件 → 启用并授权 → 模型自动出现在模型选择器里。无需克隆仓库、无需配置路径、无需手填密钥。

## ⚠️ 风险声明

our-free-model 通过模拟厂商 IDE 客户端复用其免费推理通道，可能违反相关服务的使用条款，存在账号或通道被限制的风险；部分通道有额度限制。**本插件只是本地服务与模型同步的管理界面，不提供、不担保任何通道，一切后果由使用者自行承担。** 插件页面内同样内置此声明。

## 它是怎么工作的

- 插件包内 `public/ofm-server.zip`（约 4.6MB，上游运行时全树 + `boot.mjs`）由 `plugin.json` 的 `providers.services[0]` 声明为 `host-node` 运行时；
- 插件激活后调用 `ctx.services.install()` 把 zip 交给宿主（sha256 校验、原子部署），再 `start()`；宿主用**托管 Node**（22.22.2，随 App 分发）拉起 `server/boot.mjs`，注入 `--port ${ASTRAVIA_SERVICE_PORT}` 与 `--data-dir ${ASTRAVIA_SERVICE_DATA_DIR}`，健康检查 `/health`（无鉴权，45s 超时）通过即 ready；
- `boot.mjs` 启动前自愈 `service.lock`：宿主在 Windows 上停服务走 `taskkill /T /F`（上游的 SIGTERM 优雅路径不执行），死锁残留会让下次启动报「数据目录已被占用」，boot 包装探测 pid 存活后清理；
- ready 后插件读服务数据目录的 `settings.json` 拿到自生成的 `forwardKey`，请求 `/v1/models`，写进宿主模型注册表 `free-model` provider；
- 停用/卸载插件、退出 App 时宿主强制清理进程。

## 使用方式

1. 安装 `release/free-model-gateway-<version>.astraviapkg`（Desktop 插件管理页），启用并授权 5 项权限。
2. 打开侧边栏「免费模型网关」工作区视图（首次在「更多」收纳里，可固定到顶部）。
3. 默认「插件激活时自动启动服务」已开启；也可在视图里手动「启动并同步模型」。状态卡展示服务地址、已同步模型数、同步时间；出现错误时视图与日志给出原因。
4. 首次使用需要登录的通道：点「打开管理界面」在浏览器完成扫码登录（服务自带管理 UI）；EAC、Gemini 等免登录通道装完即可用。
5. 模型就绪后直接在 Astravia 模型选择器里选用。

## 设计边界

- **自包含外置插件**：运行时随包分发（供应链固定在上游 v2.1.0 的树快照），但**不进 presets、不随 App 分发**，由用户自行安装并承担合规责任。
- **构建产物不入库**：`server-src/` 入库（可审计的 vendor 树），`public/ofm-server.zip` 由 `bun run build` 生成、`.gitignore` 排除；`--check` 保证 zip 的 sha256 与 `plugin.json` 声明一致，防止漂移。
- **单进程单端点**：一个 owned provider（`free-model`）承载全部模型，`api: "openai-completions"`，`baseUrl = <服务地址>/v1`。
- **防误删**：`replaceOwnedProviders` 是原子快照（省略即删除），上游一次空响应会被拒绝同步，绝不把用户已可用的模型列表清空。
- **密钥零明文**：forwardKey 每次同步时从服务数据目录读取、即取即用，不写进插件配置、不进日志（宿主对服务 stdout 做密钥脱敏）。
- **无额外网络面**：插件自身不请求任何外部网络（zip 走宿主 `astravia-plugin://` 协议读包内文件），因此 `plugin.json` 不带 `network` 声明。

## 开发

```bash
bun install
bun run check            # tsc --noEmit
bun run test             # vitest（scripts/quality/run-vitest.mjs）
bun run build:server-zip # 重新生成 public/ofm-server.zip 并校验 manifest sha256
bun run build            # vite build → dist/（public/ 会被拷进 dist/）
```

重新 vendor 上游：把上游仓库树（排除 `.git`、`.github`、`docs`、`scripts`、`packages/standalone/frontend`、`package-lock.json`）复制到 `server-src/`，再 `bun run build:server-zip`，把打印出的 sha256 写入 `plugin.json` 的 5 个平台条目。

打包：`plugin.json`、`dist/`、`locales/`、`icon.png`、`ability.json` 压成 `release/free-model-gateway-<version>.astraviapkg` 后在 Desktop 插件管理页安装。

测试约定：`bun ../../../../scripts/quality/run-vitest.mjs --run`（从插件目录），不要裸跑 `bun test`。
