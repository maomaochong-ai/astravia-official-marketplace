# Android / APK · 怎么用

从 APK 里读出类、方法、字符串、资源与签名，必要时上设备做动态观测。这一域的**默认路径是索引**，
不是反编译：`search_dex_symbols` 是毫秒级，jadx 是分钟级。

开发侧地图见 [dev.md](dev.md)。

## 一句话触发

```text
/path/to/app.apk 里搜一下 vip、license、subscri
反编译 /path/to/app.apk，我要看网络层
这个包是谁签的？是不是被别人重打包过？
这个包加了壳，帮我把真 DEX 弄出来
hook 一下 com.example.gate.License.isValid 看看真实返回值
```

## 你会拿到什么

| 你问的 | 拿到的 | 关键细节 |
| --- | --- | --- |
| 有哪些类 / 方法 / 字符串 | 匹配的类、方法签名（带所属类）、字符串池命中 | 只读前三个 `classes*.dex`；截断会明说 |
| 这个方法执行了什么 | `offset: op operands` 的 Dalvik 指令流 | 静态读 `code_item`，不跑代码 |
| 要可读源码 | `<name>_jadx_src/` 目录 | 只回目录名，不回几千个文件 |
| 要 Manifest / res / smali | `<name>_apktool/` 目录 | `no_sources` 可跳过 smali，快很多 |
| 在大树里找一段文本 | `path:line: 文本` | 插件自己遍历，不经外部工具 |
| 谁签的、是否同签 | 结构层（v1 证书块 SHA-256、v2/v3 id）+ `apksigner` 裁决 | 两层分开报，含义不同 |
| 加壳后的真 DEX | `<source>-<n>-<sha8>.dex` | 头部四重校验，按 SHA-256 去重 |
| 某方法的真实入参与返回 | 可跑的 Frida 脚本 | `observe` / `override` / `replace` 三档 |

## 分寸：先索引，再反编译，最后动态

1. **索引**（秒级）：找 `license` / `vip` / `subscri` / `token` / `root` / `debug` / `emulator`，先知道有没有。
2. **Dalvik 反汇编**（秒级）：命中的方法直接看指令流，多数判定点到这一步就确认了。
3. **jadx**（分钟级）：只有在需要看完整调用链、Java 语义、混淆后的名字空间时才做。
4. **动态**（要设备）：静态读不出真实返回值（服务端下发、加密常量）时才上 Frida；脱壳同理。

跳级会浪费时间：先 jadx 再搜，等于用分钟换秒。

## 面板对应页

Android 相关页有 DEX 符号搜索、签名、以及「换条路」提示（宿主拒绝读文件时给出替代路径，而不是一句报错）。

## 常见坑

| 现象 | 原因 | 怎么办 |
| --- | --- | --- |
| 搜不到 `vip` 之类 | 加了壳；或只扫了前三个 DEX | 先 `frida_dump`，再对落盘 DEX 搜 |
| `apksigner` 那层报缺失 | build-tools 不在 PATH | 结构层仍然有结果；装好后重跑 |
| 签名 `DOES NOT VERIFY` | 二次打包，或原包被改动 | 比对 signer 证书 SHA-256 是否等于自己那次构建 |
| 重打包后装不上 | 没走 `zipalign` → `apksigner sign` | 顺序固定：`apktool b` → `zipalign` → `apksigner sign` |
| 脱壳后还是空的 | DEX 懒解密 | 保持 App 停在触发页、加大等待时间再 dump |
| `generate_hook` 只给了类 | 查询过宽，方法没定位 | 它会列出该类的声明方法，第二次按方法名或签名精确指 |

## 边界

- 插件不重打包、不签名、不驱动设备安装：这些经宿主命令通道执行，插件负责定位与取证。
- 动态部分需要设备侧 `frida-server` 与 `adb`；没有设备时静态链路仍然完整可用。

## 相关的其他域

- 想先看这个 APK 的整体画像：[静态体检域](../triage-and-disasm/usage.md)（APK 也会被识别为 zip 容器）。
- Frida / adb / jadx 到底装没装：[工具链域](../toolchain-and-limits/usage.md)。
- 需要一个和本案相似的先例打法：[案卷域](../cases/usage.md)。
