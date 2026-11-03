# ADR 0011：默认中文由外壳预置偏好，不是等 wasm 自己猜

- 状态：已接受（2026-11-03）；原「默认中文由外壳预置偏好」的**作用范围**已被 [craft-0003](./craft-0003-first-open-is-a-preparation-not-a-failure.md) 收窄：偏好种子只在 photocraft 成立，其余五个 web 构建没有 CJK 字形，外部强行设中文只会得到一片空方框。
- 关联文档：[0010](./0010-payload-moves-to-upstream-0-19-0.md)、[0005](./0005-payload-provenance-and-runtime-gate.md)、[0007](./0007-one-loopback-hub-three-entries.md)

## 1. 背景

0010 之后界面里已经有中文了，但**默认仍是英文**。原因不在 catalog，在检测：

```rust
// crates/ui-egui/src/i18n/system.rs（wasm）
fn detect_system_tags() -> Vec<String> { Vec::new() }
```

`resolve()` 拿到空列表就回落 `Lang::EN`。也就是说 web 构建**永远猜不到中文**——不管浏览器语言是什么。
默认语言是 `"auto"`（`crates/engine/src/prefs.rs:325`），而 `auto` 在这条构建上没有输入。

## 2. 候选

### A. 在 `src/bridge/host-bridge.js` 里改 `navigator.languages`（否决）

检测根本不读 `navigator`，改了没人看；而且这是给宿主用的桥，不是给上游打补丁的地方。

### B. 让宿主把语言塞进 URL（否决）

0.19 的 `web.rs` 只认 `?cpu` / `?webgl`（`query()` 分支），没有 `?lang=`；加参数等于要求上游配合。

### C. 预置上游自己的偏好（选定）

上游 web 版的偏好就是 Web Storage 里的一条 JSON：

```rust
// apps/photocraft-web/src/web.rs:472
const PREFS_KEY: &str = "photocraft.preferences";
```

启动时 `load_prefs` 读它，`prefs.rs:1366 load_prefs_json()` 从默认值起步、逐条路径应用（未知字段与类型错误
只记 `InvalidPref`，不失败），所以**一份最小的种子就够**：

```json
{"version":2,"interface":{"language":"zh-hans"}}
```

## 3. 决策

**D1 中文默认由 hub 注入的一段内联脚本实现，位置在 `<head ...>` 之后、任何上游 `<script>` 之前。**
先于上游 module 是硬要求：`i18n::current()` 在应用构造时就被读取（`web.rs` 启动路径），晚一步就只能等下次重载。

**D2 只在键为空时写。**
`if (!window.localStorage.getItem(k)) setItem(...)`。用户在 Preferences 里选回英文、或选日文，后续启动必须尊重；
种子是「初值」，不是「强制值」。

**D3 不做语言选择器，也不改上游 UI。**
切换语言用上游自己的 Preferences 面板。插件外壳不加第二个语言开关——两处状态一定会分叉。

**D4 失败不致命。**
整段包在 `try {} catch {}` 里：localStorage 被禁用、配额满、隐私模式抛异常时，页面照常以英文启动。
语言是体验问题，不是可用性问题。

**D5 记录一个已知代价，不修：偏好绑定 origin，而 hub 的端口是随机的（0007 D8）。**
Web Storage 按 origin（含端口）隔离，所以重启后端口一变，种子会重新写一遍。这与主题、面板布局等
所有既有偏好的行为一致；也意味着用户在下一次会话里改过的语言会随着端口丢弃而回到中文默认。

## 4. 后果

- **好处一**：中文界面对中文用户是默认状态，不需要任何设置。
- **好处二**：机制是上游公开的持久化格式，不是补丁；上游改 catalog 我们不用动。
- **代价一**：注入从一处变两处（head 的种子 + body 的 bridge），0005 D3 需要相应更新。
- **代价二**：默认语言不再等于「上游认为的默认」。这是刻意的产品选择，也要在 0011 里写清，
  免得后来的人以为是 bug 又把它删掉。

## 5. 证据与未验证

Observed：

- 种子写入成功：页面加载后 `localStorage["photocraft.preferences"]` 首次读到
  `{"version":2,"interface":{"language":"zh-hans"}}`；编辑器启动后该键被上游补全成完整偏好
  （`interface.darkTheme`、`panelLayout.dock*`、`panels.toolbar_double` 等），其中
  `interface.language` 仍为 `"zh-hans"`——说明种子被当作正常偏好接受，而不是被覆盖。
- 界面确认：截图 OCR 得到 `文件(F) 编辑(E) 图像(I) 图层(L) 文字(Y) 选择(S) 滤镜(T) 视图(V) 窗口(W) 帮助(H)`、
  `新建文档`、`打开…`、`属性`、`图层`、`通道`、`路径`、`无文档`。
- 检测缺口：`i18n/system.rs` 的 wasm 分支 `detect_system_tags()` 返回 `Vec::new()`；`candidates()` 对
  `zh_TW/zh_HK/zh_MO` 映射 `zh-hant`、其余 `zh_*` 映射 `zh-hans`，但这套映射在 web 上永远收不到输入。
- 上游侧无 `?lang=`：`apps/photocraft-web/src/main.rs` 与 `web.rs::query()` 只解析 `cpu`、`webgl`。

未验证：

1. 在真实宿主的 iframe 里（sandbox 含 `allow-same-origin`）localStorage 是否同样可写——按规范同源即可写，
   但这条路要等桌面端实机跑一次；
2. 用户在 Preferences 里把语言改回英文后，重载是否稳定保持英文（应当，因为种子只在键缺失时写）；
3. 繁体中文（`zh-hant`）用户的默认值：当前种子一律 `zh-hans`，未做系统语言判断——这是 0010 +
   本 ADR 的共同边界，若要区分得在种子脚本里读 `navigator.language`（现在有意不读）。
