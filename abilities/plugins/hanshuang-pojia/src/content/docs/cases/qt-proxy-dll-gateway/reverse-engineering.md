# Qt5 客户端：用一个代理 DLL 同时拿下鉴权、算力与云控

> 目标：`项目L.exe` + `项目L_Auth.dll`（Windows 桌面截图贴图工具，Qt5 C++ / x64），版本 `3.5.5.1`。
> 官方 `项目L_Auth.dll` / `项目L.exe` 的 SHA256 均为 `<实测哈希>`，体积 3,766,072 / 23,662,904 字节。
> 交付物：单个 `项目L_Auth.dll` 代理库（260,096 字节）。厂商域名一律记为 `<VENDOR-DOMAIN>`。

## 一、为什么选代理 DLL

宿主通过 IAT 从 `项目L_Auth.dll` 导入 **282 个 C++ 符号**，全部按名导入。这一个事实决定了整条路线：

| 约束 | 说明 |
| --- | --- |
| 官方文件零修改 | 磁盘上两个官方二进制的 SHA256 与发布值完全一致，全程未变 |
| 必须进入进程 | 只有被 IAT 加载的 DLL 才能改写宿主内存、Hook 宿主函数 |
| 单文件可移植 | 复制两个文件即可在任意机器生效，不需要脚本或后台进程 |

做法是把官方库改名为 `项目L_AuthReal.dll`，再放一个同名的自建库顶替：导出表里放 282 条 PE 转发器
（forwarder），逐条指向改名后的官方库。加载器透明解析全部符号，我们的代码由此进入进程，获得了改写内存
与挂接函数的能力，而磁盘上一个官方字节都没动。

如果宿主是按序号导入，或鉴权逻辑散落在主程序里，这条路线直接关闭——那时应改走单点补丁范式（见
`native-islicensed-patch`），并把这个判断写进报告。

```
项目L.exe ──IAT(282 符号)──▶ 项目L_Auth.dll（自建代理，260 KB）
                                   ├─ 282 条 PE Forwarder ──▶ 项目L_AuthReal.dll（官方 3.7 MB）
                                   ├─ 进程内内存补丁引擎
                                   └─ 内嵌 127.0.0.1 大模型网关
```

## 二、能力一：会员特权判定旁路（CWE-602）

### 2.1 先让框架报出功能清单

Qt 构建把枚举名塞在元对象字符串数据里（本案位于 RVA `0x0378162`）。把它们抽出来，就得到权威的
`FeatureType` 枚举，共 **14 项**：

| idx | FeatureType | 官方名称 |
| :--: | :--- | :--- |
| 0 | `Translation` | 翻译 |
| 1 | `TableRecognition` | 表格识别 |
| 2 | `FormulaRecognition` | 公式识别 |
| 3 | `SmartErase` | 智能擦除 |
| 4 | `GlobalMouse` | 全局鼠标 |
| 5 | `ConfigSync` | 配置同步 |
| 6 | `LongScreenshotAutoCrop` | 长截图自动裁剪 |
| 7 | `RecordClip` | 录制片段 |
| 8 | `RecordKeyMouse` | 键鼠录制 |
| 9 | `ExportPreview` | 导出预览 |
| 10 | `SaveAsPDF` | 另存为 PDF |
| 11 | `AutoMosaicSync` | 自动马赛克同步 |
| 12 | `IndustrialBarcode` | 工业条码识别 |
| 13 | `CameraRecording` | 摄像头录制 |

从 UI 猜功能清单，必然漏掉当前界面没露出来的那些；从框架数据取，一次到位。

### 2.2 补丁点：11 处函数入口恒值化

全部 PRO/VIP 特权集中在 `项目L_AuthReal.dll`，均为**本地布尔 / 枚举函数，无签名绑定、无服务端权威
闭环**。

| RVA | 原始字节 | 补丁字节 | 原始符号 |
| :--- | :--- | :--- | :--- |
| `0x0C3270` | `48 83 EC 28` | `B0 01 C3` | `UserInfo::isProUser()` |
| `0x09C430` | `48 83 C1 10` | `B0 01 C3` | `Application::isProUser()` |
| `0x0EE950` | `40 53 48 83 EC 20` | `B0 01 C3` | `VipInfo::isVip()` |
| `0x0EE910` | `40 53 48 83 EC 20` | `B0 01 C3` | `Subscription::isVip()` |
| `0x0EE7B0` | `40 53 48 83 EC 20` | `B0 01 C3` | `PrepaidInfo::isVip()` + `VipInfo::hasPrepaid()`（ICF 折叠） |
| `0x0A74D0` | `48 89 5C 24 10 48` | `B8 01 00 00 00 C3` | `checkFeatureAllow()` → 恒 `Allow(1)` |
| `0x0A8040` | `48 89 5C 24 10 56` | `31 C0 C3` | `featureStatus()` → 恒 `Available(0)` |
| `0x0A86F0` | `48 89 5C 24 08 57` | `32 C0 C3` | `isProFeature()` → 恒 `false` |
| `0x0A84B0` | `40 53 48 83 EC 20` | `B0 01 C3` | `hasActivatedTrialAccess()` → 恒 `true` |
| `0x0A8C30` | `40 53 55 56 57 48` | `C3` | `rescheduleTrialExpireTimer()` → 禁用倒计时 |
| `0x09D560` | `40 55 53 56 57 41` | `C3` | `showSubscriptionTrialReminder()` → 抑制弹窗 |

补丁语义：`B0 01 C3` = `mov al,1; ret`，`B8 01 00 00 00 C3` = `mov eax,1; ret`，`31 C0 C3` =
`xor eax,eax; ret`，`32 C0 C3` = `xor al,al; ret`，`C3` = `ret`。全部是**帧未分配即返回**，因此没有栈平衡
风险——这也是选入口恒值化而不是中途改判定的直接理由：一个入口补丁只有一个含义、一种验证方式。

要区分两个数字：**判定函数 11 处**，而调用点 **107 处**。前者是补丁集，后者才是影响面。

### 2.3 ICF 折叠放大失效面

链接器的相同代码折叠（ICF）让语义完全相同的函数共用一个地址：

```
0x1800EE7B0  ← 同时承载
              ├─ ?hasPrepaid@VipInfo@项目L_Auth@@QEBA_NXZ
              └─ ?isVip@PrepaidInfo@项目L_Auth@@QEBA_NXZ
```

于是「1 处补丁」实际覆盖两个判定符号。这不是我们改错了，而是构建的固有属性；反过来也说明，若这处补丁
判断有误，影响面同样更宽。报告里要把折叠单列一行，不能让读者以为站点数等于作用面。

## 三、能力二：翻译算力本地化（大模型网关）

这一条与会员特权是**两件独立的事**，根因不同、修复层不同，必须分开叙述。

### 3.1 问题本质

翻译功能没有本地模型，必须请求云端。官方把 API 基地址硬编码在 `项目L.exe` 里：

```
RVA 0x2052D0  构建 Base URL 的 lambda:
  mov  edx, 0x15                  ; strlen("https://api.<VENDOR-DOMAIN>") = 21
  lea  rcx, [rip + 0xAEC3EF]      ; 常量字符串
  call QString::fromLatin1
```

该常量经 `项目L_Net::registerVariableCallback("API_ENDPOINT", λ)` 注册为 `{API_ENDPOINT}` 变量，被端点
路径引用：

```
{API_ENDPOINT}/api2/ai/translate/text     → TranslateTextAI
{API_ENDPOINT}/api2/ai/translate/image    → TranslateImageAI
{API_ENDPOINT}/api2/tr/translate/text     → TranslateText
{API_ENDPOINT}/api2/tr/translate/image    → TranslateImage
```

`[observed]` 这套设计对开发者友好（换域名不用改代码），代价是端点成了可注册、可改写的运行期变量。

### 3.2 端点改写是三处，不是一处

| RVA | 原始 | 补丁 |
| :--- | :--- | :--- |
| `0xCF16E0` | 21 字符 URL 字符串槽 | `http://127.0.0.1:8787` |
| `0x2052E5` | `BA 15 00 00 00` | `BA <新长度> 00 00 00` |
| `0x2052EA` | `48 8D 0D EF C3 AE 00` | `48 8D 0D <新 disp>` |
| `0x205316` | `48 8D 15 DB C3 AE 00` | `48 8D 15 <新 disp>` |

只改字符串 → URL 被截断或读到越界；改了字符串和长度却没重算 `lea` 位移 → 指针指向长度字节。三处必须一起
改，位移按新地址重算，并把算出来的值写进日志，`[observed]`。

### 3.3 网关必须是协议适配器

代理库启动一个 `127.0.0.1` 上的 HTTP 服务（Winsock），承担协议转换：

```
项目L.exe ──▶ 本地网关 ──┬─ /api2/*/translate/* ──▶ 解析请求 ──▶ 任意大模型 API ──▶ 转回客户端期望的 JSON
                          └─ 其它请求（登录/账号/JWT）──▶ 透明回源官方 API
```

后端按配置 URL 自动识别协议风格：

| 风格 | 识别特征 | 请求 | 取响应的路径 |
| :--- | :--- | :--- | :--- |
| OpenAI 兼容 | 默认 | `POST /chat/completions` | `choices[0].message.content` |
| Google Gemini | `generativelanguage.googleapis.com` | `POST /v1beta/models/{m}:generateContent` | `candidates[0].content.parts[*].text` |
| Anthropic | `anthropic.com` | `POST /v1/messages` | `content[0].text` |

实测可对接 OpenAI / DeepSeek / Gemini / Claude / Kimi / 智谱 GLM / 通义千问 / Ollama / one-api 中转。

日志片段（`[observed]`，其中后端域名与密钥已替换）：

```
bridge: listening on http://127.0.0.1:8789  (llm=<BACKEND-ENDPOINT>)
bridge: {API_ENDPOINT} -> http://127.0.0.1:8789 (自定义大模型已接管)
bridge: -> <BACKEND-ENDPOINT> (style=1 model=<model> len=35)
bridge: <- HTTP 401 (204 bytes)
bridge: translate done (193 bytes)
```

最后一条 401 恰好说明「透明回源」不可省：账号、登录、同步这些请求必须原样送到官方主机，否则客户端会以
你完全没想到的方式坏掉，而你会误判成补丁有问题。

## 四、能力三：云控与自动更新剥离

| 云控函数 | RVA | 原始特征码 | 补丁 | 作用 |
| :--- | :--- | :--- | :--- | :--- |
| `项目L_Upgrade::checkNewVersion` | `0x452070` | `40 55 53 56 57 41 54` | `31 C0 C3` | 禁用自动更新检查 |
| `UserConfigGet` | `0x1C8BB0` | `40 55 53 56 57 41 56` | `31 C0 C3` | 禁用云端配置**下发** |
| `UserConfigUpdate` | `0x1C8DD0` | `40 55 53 56 57 41 56` | `31 C0 C3` | 禁用云端配置**上报** |

更新检查用的是**独立域名**：`https://upgrade.<VENDOR-DOMAIN>/api/check/%1/%2/%3/%4/%5/%6/%7`，不经
`{API_ENDPOINT}`，所以端点改写对它是无效的，必须单独处理。剥离后实测 `项目L.exe` 不再直连任何外部主机，
全部流量只指向 `127.0.0.1`，`upgrade` 域请求数为 **0**，`[observed]`。

## 五、UI 注入

`PdConf::ConfWidgetTranslateKey` 的 `ui` 结构体位于 `widget + 0x60`：

| 控件 | 偏移 | 类型 |
| :--- | :--- | :--- |
| `cmbService` | `widget + 0x88` | `QComboBox*` |
| `chkCustomApiKey` | `widget + 0x90` | `QCheckBox*` |
| `edtID` | `widget + 0xB0` | `QLineEdit*` |
| `edtKey` | `widget + 0xB8` | `QLineEdit*` |
| vtable（`[3]` = scalar deleting dtor） | RVA `0xCE8228` | — |

注入复刻官方写法即可：

```cpp
cmbService->insertItem(cmbService->count(), QIcon(),
                       tr("自定义翻译源"), QVariant(QString("custom")));
```

## 六、四个致命坑点

四个坑全部导致进程崩溃，且崩溃点与根因相隔数个模块。排查手段固定为「细粒度断点日志 `[1]~[6]` + minidump
解析，读故障地址而不是故障函数名」。逐条细节见先例包的 `docs/pitfalls.md`，此处只记结论：

1. **5 字节 `rel32` 溢出**（`0xC0000005`，参数 `0x8`）：宿主与注入 DLL 可相隔 9 GB 以上，远超 ±2 GB，
   必须改用 14 字节绝对跳转 `FF 25 00 00 00 00` + 8 字节地址，且按指令边界覆盖 15 字节。
2. **构造函数返回值 `rax` 丢失**：MSVC x64 下构造函数以 `rax` 返回 `this`，工厂直接把 `rax` 交给调用方；
   Hook 声明为 `void` 就把 `rax` 毁了 → 野指针 → 延迟堆损坏（崩溃落在布局代码里）。修复：Hook 返回 `self`。
3. **漏转发第 3 个参数 `r8`**：工厂以 `rcx/rdx/r8` 三参调用构造，而构造函数首部直接转发给基类；两参 Hook
   让基类拿到垃圾指针，崩溃发生在构造函数**内部**。修复：先读工厂反汇编，再定签名。
4. **trampoline 栈语义错误**：`call` 进入 trampoline 多压 8 字节返回地址，原函数的影子空间写入落进 Hook
   栈帧，破坏局部变量。修复：改用 unhook → 普通 `call` → 重挂，栈语义由构造保证正确。
5. **网关侧 JSON 分配 BUG**：设了 `cap = 8` 却没分配 `items` 数组，`jpush` 认为有空间 → 写 NULL → 崩溃。
6. **网关侧 `SO_REUSEADDR`**：Windows 允许多进程重复绑定同端口，僵死进程会吞掉请求；改用
   `SO_EXCLUSIVEADDRUSE`，端口被占则顺延并记录实际端口。

## 七、双向彻底还原

| 步骤 | 动作 |
| :--- | :--- |
| 1 | 枚举并强制结束进程族（主程序 + 辅助进程），解除文件句柄锁定 |
| 2 | 用 `项目L_Auth.dll.orig` 覆盖恢复官方原版 |
| 3 | 删除 `项目L_AuthReal.dll` / `项目L_hook.ini` / `项目L_hook.log` 全部注入痕迹 |
| 4 | 复读校验 SHA256 与体积（`<实测哈希>` / 3,766,072 字节） |
| 5 | 清理官方备份，状态回落为 `original` |

## 八、弱点与修复

| 弱点 | 说明 |
| :--- | :--- |
| 本地布尔判定 | 14 项特权全部由本地函数决定，无签名绑定 |
| 单一入口可恒值化 | `mov al,1; ret` 即解除整个功能域 |
| 无完整性自校验 | 鉴权库无 CRC / 哈希自检，替换 DLL 即生效 |
| IAT 导入可代理 | 282 个符号全部按名导入，可用 PE Forwarder 完整顶替 |
| API 端点可变量化 | `{API_ENDPOINT}` 由可注册回调提供，端点可任意改写 |
| 无证书绑定 | 云端算力可整体本地化，服务端计费闭环失效 |
| 云控无签名校验 | 配置下发与更新检查均无客户端校验，可整体剥离 |
| ICF 折叠 | 单点补丁覆盖多符号，影响面被放大 |

**客户端加固**：14 项特权判定下沉 Native + 代码虚拟化；`.text` 段运行时 CRC 自校验 + 关键页
`PAGE_EXECUTE_READ` 写保护；编译期 `/OPT:NOICF` 避免单点扩散；`CheckRemoteDebuggerPresent` + 硬件断点
检测；**对 `项目L_Auth.dll` 做 Authenticode / 内嵌哈希校验后再加载**（这一条最关键，也是本案成本最低的
修复）。

**传输层收敛**：全链路双向证书绑定，阻断端点重定向；请求级 Sign + Nonce + Timestamp；端点基地址改为服务端
签发并带时效，禁止本地常量。

**服务端权威闭环**：特权状态不落本地布尔值，改为服务端签发的短期 License Token（Ed25519 + Valid-Until）；
核心权益额度以服务端异步通知 + 二次验签为唯一凭据；云端配置下发必须签名，客户端验签。

## 九、限制与未验证项

- `[observed]` 282 符号导入清单、107 处门控调用点、14 项 FeatureType、11 处判定补丁、3 处云控补丁、4 处
  端点改写、网关实测日志、更新域请求数归 0、还原后哈希一致。
- `[inferred]` ICF 折叠导致的「单点覆盖多符号」由导出目录符号共址推出，未逐个断言其调用方行为等价。
- `[unverified]` 不同 Qt 小版本下的元对象数据布局（本次 5.15 系）；开启系统代理或自建 TLS 栈时的网关可达性
  （本案客户端走默认网络栈，未做对抗性验证）。
- 未评估：多语言界面下 `tr()` 文案注入的本地化；卸载流程对注入残留的处理。
- 第三方组件名（`Qt5Core.dll` / `Qt5Widgets.dll` / `WinHTTP`）保留原文，产品名、代码标识符与域名均已占位化。
