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

**决定二：把冷启动成本从"首次打开"移到"插件激活"。** `warmHub(ctx)` 在 activate 阶段
fire-and-forget 地 `start()` 已经安装且版本一致的服务；启动过程本身不再走网络
（`scheduleEnsure(false)`，只认磁盘上已校验的缓存），网络只在页面真的请求应用时才发生。
于是"装了但没打开"的插件一个字节都不下载——七个插件的 payload 合计约 250 MB，这条边界比
省下的 200 ms 更重要。

**决定三：界面语言按"这个构建能不能画出中文"逐应用开启，而不是统一改成中文。**
本仓库七个上游 web 构建里只有 photocraft 与 lightcraft 带中文能力：lightcraft 的 web 端运行时
fetch `lightcraft_zh_hans.otf` 再交给 egui；photocraft 的 27 种语言目录随 wasm 一起发布。
其余五个的上游构建连 CJK 字形都没有（designcraft / pdfcraft / vectorcraft 只带
`OFL-noto-sans-cjk-sc.txt` 许可证文本；effectcraft 的 `web_draws()` 与 filmcraft 的
`chinese_font_available()` 更是显式把中日韩排除在外）。对这些构建强行切中文，用户得到的是
一屏豆腐块——那比英文更糟。所以 `apps.mjs` 里每个应用有一个 `locale` 字段，只有
`"zh"` 的应用才允许外壳改写 `navigator.languages`。要覆盖剩下五个，必须上游把 CJK face 加进
`theme::install` 并重编 wasm；那会产出 60–90 MB 的制品，超出 25 MB 包体上限，需另行外置托管。

**为什么改 `navigator` 而不是写偏好。** hub 监听 `127.0.0.1:0`，端口每次不同，origin 随之改变，
localStorage 按 origin 隔离，所以"预置偏好"在非 photocraft 的构建上根本不成立；而这些构建的语言
本来就是每次启动从 `navigator.languages` 重算的。于是在 `<head>` 里、应用模块之前，
`Object.defineProperty` 覆写 `navigator.language` / `navigator.languages` 才是唯一有效的杠杆。
photocraft 仍然保留它的 localStorage 偏好种子，两者叠加，互不冲突。

**证据与未验证。** Observed：`effectcraft/crates/ui-egui/src/i18n.rs:126-131` 的
`web_draws()` 返回 `!matches!(language, "ja" | "zh-hans" | "zh-hant" | "ka")`；
`filmcraft/crates/ui-egui/src/i18n.rs:480-489` 的 `chinese_font_available()` 在 web 上恒为假；
`lightcraft/apps/lightcraft-web/src/web.rs:845-865` 把运行时取到的 `chinese_font` 传给
`WebApp::new`；七个上游 zip 的 `unzip -l` 里只有 lightcraft 含 CJK 字体文件（16,437,364 B）。
宿主的 `renderer/assets/*.js` 中没有任何主动启动插件服务的调用，因此预热只能由插件自己在
activate 里发起。Inferred：`Object.defineProperty` 覆写对 `web_sys::window().navigator()`
的读取路径是否 100% 生效，尚未在真实宿主里实测（需要桌面端跑一次 lightcraft 并 OCR 界面）；
等待页的新文案与进度条只做了本地 hub 冒烟，未在真实宿主窗口里截图确认。
