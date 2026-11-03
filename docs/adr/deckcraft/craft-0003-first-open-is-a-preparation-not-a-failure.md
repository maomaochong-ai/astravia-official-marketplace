# 首次打开是"准备"，不是"报错"；中文只在能画出中文的构建上打开

插件第一次被打开时面板里没有应用：上游 payload 几十 MB，要从 Release 下载。旧实现的等待页把
`Phase: downloading`、`payload-no-source`、`Error: connect ETIMEDOUT` 和配置文件的绝对路径原样
印出来，一秒钟整页刷新一次。从用户角度看，这与"插件坏了"没有区别——他看到的是一屏错误，而不是
一个在进展的安装过程。

**决定一：等待页只讲用户需要的那一件事，诊断收进 `<details>`。** 页面由应用名、一句
"首次打开需要下载约 13 MB，只需要这一次；之后每次打开都是秒开的"、一条真实进度条（来自
`received / total`）组成。`Phase`、`attempts[]`、配置路径、离线 zip 的投放路径只在
`state.phase === "failed"` 时出现，且默认折叠。刷新从 `meta http-equiv=refresh` 改成
700 ms 轮询 `/api/state`，因为整页刷新既丢失进度条动画，也在慢网络上制造"什么都没变"的错觉。

**决定一（2026-11-03 补充）。** 上一条只解决了"不要报错"，没解决"看起来在动"：旧页在拿到
`Content-Length` 之前只有一条 6 px 高的滑块，`total === 0` 时连百分比都没有，用户看到的是一个静止的
灰条。现在进度区常驻：已知体积时是确定态（`received / total` 直接算出宽度与百分比，pin 里的
`size` 就是初始分母，所以从 0% 开始就是真的），未知体积时是滑动 shimmer 且文字写"正在检查/校验"；
下方四个步骤（检查本机文件 → 下载 → 校验 → 启动）由服务端按 phase 判定当前步，客户端 `paint()`
每 700 ms 同步一次，两个视图不会互相矛盾。另外补一行已经等了多少秒——下载卡住时它比任何文案都诚实。

**决定二：把冷启动成本从"首次打开"移到"插件激活"。** `warmHub(ctx)` 在 activate 阶段
fire-and-forget 地 `start()` 已经安装且版本一致的服务；启动过程本身不再走网络
（`scheduleEnsure(false)`，只认磁盘上已校验的缓存），网络只在页面真的请求应用时才发生。
于是"装了但没打开"的插件一个字节都不下载——整族 payload 合计超过 400 MB，这条边界比省下的 200 ms 更重要。

**决定三：界面语言按"这个构建能不能画出中文"逐应用开启，而不是统一改成中文。**
逐应用复核上游源码后，结论比最初以为的乐观：**多数应用有中文语言表**（designcraft `zh`、
effectcraft `zh-hans`/`zh-hant`、filmcraft `zh-cn`、lightcraft `ZhHans`、pdfcraft / vectorcraft /
wordcraft / craft-anything `zh-hans`、gridcraft `Zh`、texturecraft `zh-Hans`、photocraft `zh-hans`），
没有的是 cadcraft、deckcraft、figcraft、materialcraft。真正稀缺的是**字形**：只有 lightcraft 的 web 包
单独发了 `lightcraft_zh_hans.otf`（16,437,364 B），photocraft 把字形编进了 wasm，其余包内只有
`OFL-noto-sans-cjk-sc.txt` 许可证文本。判决因此从"有没有语言表"变成"这个构建能不能画出中文"：
`photocraft-main/crates/ui-egui/src/cjk_fonts.rs:34-41` 的 `wasm32` 分支
`system() -> Self { Self { locale: || None, files: |_| Vec::new(), .. } }` 明确表示 web 端拿不到系统字体。
所以 `apps.mjs` 里每个应用有一个 `locale` 字段，只有 `"zh"` 的应用才允许外壳改写
`navigator.languages`；光切 `navigator` 切不出中文文案，只会让日期/数字格式换成 zh 而界面仍是英文，
那是一种更隐蔽的错位。要让没有字形的那些也显示中文，必须上游先把 CJK face 加进构建、再把 CJK face 加进 `theme::install`
并重编 wasm；那会产出 60–90 MB 的制品，不再适合作为单文件 payload。

**为什么改 `navigator` 而不是写偏好。** hub 监听 `127.0.0.1:0`，端口每次不同，origin 随之改变，
localStorage 按 origin 隔离，所以"预置偏好"在非 photocraft 的构建上根本不成立；而这些构建的语言
本来就是每次启动从 `navigator.languages` 重算的。于是在 `<head>` 里、应用模块之前，
`Object.defineProperty` 覆写 `navigator.language` / `navigator.languages` 才是唯一有效的杠杆。
photocraft 仍然保留它的 localStorage 偏好种子，两者叠加，互不冲突。

**证据与未验证。** Observed：`photocraft-main/crates/ui-egui/src/i18n/mod.rs` 含 `zh-CN`；
`designcraft-main/crates/ui-egui/src/i18n.rs:5` 的 `LANGUAGES` 五项无 zh；`filmcraft-main` 除
`crates/engine/src/settings.rs:331-347` 的字幕语言（`default_language: "en"`）外无 UI i18n；
`printcraft-main/crates/ocr/src/lib.rs:22`、`vectorcraft-main/crates/doc/src/setup.rs:140` 的
`LANGUAGES` 分别是 OCR 与文档引号；`photocraft-main/crates/ui-egui/src/cjk_fonts.rs:38-41`
的 wasm32 分支返回空字体表；15 个上游 zip 中央目录里只有 lightcraft 含 CJK 字体文件
（`lightcraft_zh_hans.otf`，16,437,364 B），它在 UI 里也真的被用上（`i18n.rs` 的 `ZhHans` 表）。宿主的 `renderer/assets/*.js` 中没有任何
主动启动插件服务的调用，因此预热只能由插件自己在 activate 里发起。Inferred：
`Object.defineProperty` 覆写对 `web_sys::window().navigator()` 的读取路径是否 100% 生效，
尚未在真实宿主里实测；等待页的新文案、进度条与四段步骤条只做了本地 hub 冒烟（`hl=zh` 5868 B /
`hl=en` 5831 B / 失败态 4409 B），未在真实宿主窗口里截图确认。
