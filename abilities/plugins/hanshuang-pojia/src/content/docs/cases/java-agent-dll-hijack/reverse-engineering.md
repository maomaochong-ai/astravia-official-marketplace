# 单一 JAR 客户端的两个入口：javaagent 改判定，DLL 劫持改启动

> 目标：`<install_dir>\项目M.exe`（install4j 启动器）+ `<install_dir>\<app>.jar`（单体积包，161 MB）+
> 内置 `jre\bin\server\jvm.dll`（某 2026 年构建的 OpenJDK）。
> 分类：CWE-602（客户端实施服务端安全机制）、CWE-321（硬编码加密密钥）、CWE-427（不受控的搜索路径元素）。
> 危害：CVSS 3.1 本地上下文，授权旁路 7.5 / 代码执行 7.8。全程 `<app>.jar` 与启动器哈希零变化。

本案有两条互不相干的路：**改判定**（进 JVM 之后，改三个方法）与**抢先启动**（进 JVM 之前，用被劫持的
DLL 注入 Agent）。它们的成因、利用条件、修复位置全都不同，报告必须分开写——只修一条，另一条一分钟就能
重新打通。

## 一、判定为什么只有一处

反编译控制器 `app.Zer4`，产品档位就一个三元表达式：

```java
private Zs56 lambda$new$3() {
    return this.Zh == null ? Zs56.Zw : Zs56.Zu;   // COMMUNITY : PRO
}
```

`this.Zh` 是授权描述对象（实现 `app.Zeq_`，具体类型 `app.Zwaf`）。`null` 即社区版，非 `null` 无条件
视为专业版。品牌枚举 `app.Znwu` 的 `BRAND_COMMUNITY` / `BRAND_PRO`、窗口标题、以及所有功能门禁全部读这
一个值。

关键事实：**付费模块的全部字节码都在同一个 jar 里，且离线可执行**。所以「解锁付费模块」等价于「让 `Zh`
是一个描述专业授权的对象」，而不是逐个功能去打点。

除了这个读取点，还有两个上游缝隙值得单独处理：

| 缝隙 | 位置 | 为什么值得动 |
| :--- | :--- | :--- |
| 验签入口 | `app.Zfqu.ZL(String)` 及 `app.Zp74` / `app.Zwa8` 的反射验签 | 方法体只负责「失败就抛」，改成空实现即恒不抛 |
| 状态机 | `app.Zwxg.Zu` | 启动时决定造哪个授权对象，改它等于从源头换掉输入 |
| 元数据解包 | `app.Zt(String, int) → Object[]` | 授权对象由这个数组构造，字段宽度是隐式契约 |

## 二、Agent 侧：三个接缝，不碰调用点

用 JDK 自带的 `java.lang.classfile` 写 `ClassFileTransformer`，零第三方依赖。匹配必须用**方法名 + 描述符**，
因为混淆后短名高度重复（`Zu` 在多个类里都存在）。

```java
// 1. 验签门禁：恒不抛
if (n.equals("ZL") && d.equals("(Ljava/lang/String;)V")) {
    b.withMethod(mm.methodName(), mm.methodType(), mm.flags().flagsMask(),
            mb -> mb.withCode(cb -> cb.return_()));
    return;
}

// 2. 授权元数据：交给自建构造器
if (n.equals("Zt") && d.equals("(Ljava/lang/String;I)[Ljava/lang/Object;")) {
    b.withMethod(mm.methodName(), mm.methodType(), mm.flags().flagsMask(),
            mb -> mb.withCode(cb -> cb.aload(0).iload(1)
                    .invokestatic(self, "mockZt", ztType).areturn()));
    return;
}

// 3. 准入决策：恒定返回已授权的 Zyeo
if (n.equals("Zu") && d.startsWith("(Lapp/Z_pm;") && d.endsWith(")Lapp/Zyeo;")) {
    b.withMethod(mm.methodName(), mm.methodType(), mm.flags().flagsMask(),
            mb -> mb.withCode(cb -> cb
                    .new_(zyeoDesc).dup()
                    .invokestatic(self, "mockLicense", MethodTypeDesc.of(zeqDesc))
                    .iconst_0()
                    .invokespecial(zyeoDesc, "<init>", ctorType)
                    .areturn()));
    return;
}
```

要点：**返回真对象，不要返回 `null`**。返回 `null` 只是把崩溃推迟到下一个假设非空的消费者，那个位置离
你的补丁十万八千里。

### 2.1 元数据数组的宽度是版本契约

历史上是 5 元组，当下这一版读到了 **7** 个字段：

| 下标 | 含义 | 消费者 |
| :---: | :--- | :--- |
| `[0]` | 授权人 | `Zeq_.Zm()` |
| `[1]` | LicenseId | `Zeq_.Zf()` |
| `[2]` | 到期毫秒（`Long`） | `Zeq_.Zw()` / `ZL()` |
| `[3]` | 模式（`1` = Desktop） | `Zeq_.ZX()` |
| `[4]` | 等级字符串 | `Zeq_.ZG()` |
| `[5]` | 席位数，**必须是可 `parseInt` 的数字字符串** | `Integer.parseInt` |
| `[6]` | AI 激活令牌 | `Zeq_.Zv()` |

两个坑写在表里：数组短一格，越界异常抛在库内部，栈里看不到你的补丁；`[5]` 得是 `String` 而不是
`Integer`，因为读它的是 `Integer.parseInt(...)`。版本一升就必须按**读取方**重新推导这张表，不能照抄旧宽度。

## 三、派生凭据：第二处独立缺陷

门禁打开、窗口也自称专业版之后，新建项目报 Guice 注入失败：

```
[Guice/ErrorInCustomProvider]: NullPointerException: activationToken
  at Zgp.ZG(Unknown Source)
     \_ installed by: app.Zyg3 -> AgenticAiModule -> Zgp
Caused by: NullPointerException: activationToken
  at AppAiAuth$BearerMode.<init>(AppAiAuth.java:66)
  at AppAiAuth.bearer(AppAiAuth.java:159)
```

调用链：

```
AgenticAiModule (Guice AbstractModule)
  └─ provider Zgp.ZG(...)
       └─ AppAiAuth.bearer(..., supplier.get())
            supplier = @Named("ai") Zlar                  ← 令牌
              └─ provider Zaju: (licence != null ? licence : anon).Zq()
                   └─ Zwaf.Zq() = Zfer.Zr(licensee)
                        └─ Zfn8.Zj(name) → Preferences.get(key, null)
```

**结论**：AI 令牌**不在**签名覆盖的许可证密文里，而是 `Preferences`（对应 HKCU 注册表）里的一项，key 由
**授权人名字的哈希**派生。所以：

- 许可证签名完全不覆盖它，本地写这个键即可伪造；
- 读取时有校验，但校验的是 HTTP 安全性（非空、非空白、不含 CR/LF/NUL 等控制字符），防的是请求头注入，
  与真实性无关；
- **一个「有签名」的许可证，仍然可以有可伪造的派生权益**。修复点在签名载荷，不在存储。

修复方式（本案在 Agent 内完成，仅作验证）：

```java
Method zw = Class.forName("app.Zfn8").getDeclaredMethod("Zw", String.class, String.class);
zw.setAccessible(true);
zw.invoke(null, LICENSEE, AI_TOKEN);   // Preferences.put(Zfn8.ZU(LICENSEE), AI_TOKEN)
```

厂商侧的正确修法是把这个令牌并入许可证签名载荷，或在读取时校验它与签名的绑定关系（MAC / 绑定字段），
而不是独立存放在客户端可写的存储里。

## 四、入口二：DLL 搜索序劫持

### 4.1 测绘结果

| 模块 | 导入的 DLL | 在 KnownDLLs | 可劫持 |
| :--- | :--- | :---: | :---: |
| `项目M.exe`（安装器外壳） | `kernel32` / `user32` / `advapi32` / `ole32` | 全部 | ❌ |
| `jvm.dll` | **`VERSION.dll`** / **`WINMM.dll`** / **`POWRPROF.dll`** / **`VCRUNTIME140.dll`** / **`VCRUNTIME140_1.dll`** | ❌ | ✅ |
| `jvm.dll` | `WS2_32.dll` | ✅ | ❌ |
| `java.dll` | **`VERSION.dll`**（`GetFileVersionInfoW` / `VerQueryValueW` / `GetFileVersionInfoSizeW`） | ❌ | ✅ |

前提三条同时成立才有这条路：`SafeDllSearchMode` 未显式设置（默认开启，应用目录优先于 System32）；目标
JRE 未调用 `SetDefaultDllDirectories()` / `SetDllDirectory()` / `AddDllDirectory()`（导入表与字符串双重
确认）；`version.dll` 未进入 `KnownDLLs`。

精确导入面决定要转发哪些导出：

```
jvm.dll  → VERSION.dll : GetFileVersionInfoA, VerQueryValueA, GetFileVersionInfoSizeA
java.dll → VERSION.dll : GetFileVersionInfoW, VerQueryValueW, GetFileVersionInfoSizeW
```

共 17 个真实导出（A/W 双版本 + `…Size` 变体），必须逐个忠实转发——手写漏掉一个 `…Size`，JVM 启动时弹
「找不到入口点」，且没有任何 Java 日志。

### 4.2 九步链路

```
[1] 投放 stage-0：<install_dir>\version.dll（17 个导出全部转发真实 DLL）
[2] 用户双击 项目M.exe
[3] install4j 加载 jre\bin\server\jvm.dll → 解析导入表 → 命中「应用目录」的 version.dll
[4] DllMain(DLL_PROCESS_ATTACH) 执行          ← 原生代码执行点，此时还没有 JVM
      ├─ 定位主模块 PE 头 → 遍历导入描述符 → 锁定 KERNEL32.dll
      ├─ 遍历 OriginalFirstThunk 定位 GetProcAddress 索引
      └─ VirtualProtect 改写 FirstThunk（IAT）第 27 槽 → my_gpa（原指针另存）
[5] 启动器 GetProcAddress(jvm, "JNI_CreateJavaVM") → 命中 my_gpa → 返回包装函数
[6] my_create(pvm, penv, vm_args)：options 扩容 18 → 19，追加 -javaagent:<abs path>
[7] 真实 JNI_CreateJavaVM 建 VM → 解析到 -javaagent → 加载 Agent
[8] premain() → 插桩 app.Zfqu / app.Zwxg.Zu
[9] 门禁旁路完成
```

### 4.3 为什么环境变量不行

`JAVA_TOOL_OPTIONS` / `_JAVA_OPTIONS` 在 `jli` 层解析，时机**晚于** `jvm.dll` 的导入解析，所以在
`DllMain` 里设置已经过时（实测 JVM 未采纳）。改用「IAT 挂钩 `GetProcAddress` + 包装
`JNI_CreateJavaVM`」，与加载时序完全解耦，这是时序事实而非配置失误。

### 4.4 实测回显

```
[version.dll hijack pid=12340] DLL_PROCESS_ATTACH in host process
[version.dll hijack pid=12340] iat: HOOKED kernel32!GetProcAddress slot#27 (real=0x7ffa4b342130)
[version.dll hijack pid=12340] GetProcAddress(JNI_CreateJavaVM) -> hooked wrapper
[version.dll hijack pid=12340] JNI_CreateJavaVM intercepted: injected
                               -javaagent:<install_dir>\LoaderAgent.jar (nOptions 18 -> 19)
[version.dll hijack pid=12340] resolved genuine version.dll @ 0x7ffa41b10000

[LoaderAgent] premain reached -> agent loaded into JVM (pid=12340)
[LoaderAgent] RESULT: PROFESSIONAL MODE ACTIVE,
              licensee=<LAB-LICENSEE>, expires=Fri Jan 01 00:00:00 CST 2100
```

`nOptions 18 -> 19` 是这一整条链最有力的一行：数组被正确扩容、选项被真正采纳、Agent 被真正加载。

## 五、两条路的收益对照

| # | 能力 | 说明 | 是否实测 |
| :---: | :--- | :--- | :---: |
| 1 | JVM 启动前原生代码执行 | `DllMain` 早于 `JNI_CreateJavaVM`，有完整 Win32 权限 | ✅ |
| 2 | JVM 参数注入 | 直接改 `JavaVMInitArgs`，可加 `-javaagent` / `-Xbootclasspath` / `-D` | ✅ |
| 3 | JavaAgent 字节码插桩 | 绕过全部 Java 层判定 | ✅ |
| 4 | 无痕 | 不改 `*.vmoptions`、不改快捷方式、不留配置 | ✅ |
| 5 | 绕过文件哈希校验 | 两个官方文件哈希不变 | ✅ |
| 6 | 任意 API Hook | `Crypt*` / `WinHTTP` / `WS2_32` / `RegQueryValueExW` | 仅演示 `GetProcAddress` |
| 7 | 内存补丁 | `VirtualProtect` + 改代码段 | 已演示 |
| 8 | 持久化 / 流量窃取 | 写回 vmoptions、注册表 Run、计划任务；Hook 加密与网络 API | 可达，未做 |

报告只写 1–5。第 6–8 行必须写成「可达、未验证」——这是一份发现与一个故事的差别。

## 六、纵深防御

**客户端（可立即落地）**

1. `SetDefaultDllDirectories(LOAD_LIBRARY_SEARCH_SYSTEM32 | LOAD_LIBRARY_SEARCH_DEFAULT_DIRS)`，或对全部
   原生依赖改用 `LoadLibraryExW(..., LOAD_LIBRARY_SEARCH_SYSTEM32)`；
2. 加载任何原生依赖前校验 Authenticode 签名与预期发布者；
3. 安装目录设为仅 Administrators 可写（`icacls <install_dir> /inheritance:r /grant:r
   "Administrators:(OI)(CI)F" "SYSTEM:(OI)(CI)F" "Users:(OI)(CI)RX"`）；
4. 安装到 `%ProgramFiles%` 等受保护目录，杜绝用户可写。

**JVM 层**

5. 在 `Main-Class` 引导最早期通过 JNI 检查 JVM 参数，出现 `-javaagent:` / `-agentlib:` /
   `-Xbootclasspath` 即静默退出；
6. 类加载后比对核心判定类（`Zfqu` / `Zwxg` / `Zer4`）关键方法的字节码 SHA-256，发现变异立即熔断；
7. 把验签模数验证、解密、许可证解析下沉到 C++ / Rust 原生库，并上 OLLVM 控制流平坦化 + 字符串加密。

**架构层（根治）**

8. 扫描规则库、云端交互域名、商业扩展下载等核心权益改为服务端实时签发短期 Token（Ed25519 +
   Valid-Until），客户端只持临时凭据，定期轮换；派生权益（如 AI 令牌）必须并入签名载荷。

一个只做 5–7 的加固方案，会被第 4 节的 DLL 入口在一分钟内击穿；只做 1–4 也一样。这种「两条路互为备份」
的不对称，就是本案值得单独立档的理由。

## 七、限制与未验证项

- `[observed]` 判定点代码、三处插桩、7 元组元数据、派生令牌链路、17 个导出、IAT 第 27 槽、`nOptions
  18 → 19`、两个文件哈希不变。
- `[inferred]` 「付费模块全部字节码在 jar 内」由反编译覆盖面推出，未逐模块跑通计费类功能（如云端规则推送）。
- `[unverified]` 其他安装位置（若安装到 `%ProgramFiles%`，DLL 路线需要提权，未复现）；不同 JDK 次要版本
  下 `java.lang.classfile` 的 API 差异（本案为 JDK 26 原生 API）；开启 JVM 附加禁用
  （`-XX:+DisableAttachMechanism`）后的 DLL 路线存活情况——与本案无关但常被问。
- 未评估：卸载流程是否清理投放的 DLL；企业侧的 EDR 对该 DLL 落地的检出率。
- 所有产品名、包前缀（统一记为 `app.`）、安装路径（`<install_dir>`）、构建号与版本号均已脱敏；混淆类名后缀、
  方法描述符、字段下标、CVSS 分值等结构常量按原样保留。
