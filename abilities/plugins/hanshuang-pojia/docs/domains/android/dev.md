# 模块：Android / APK

从 APK 里读出 DEX 索引、资源、签名，落成可搜索的源码树，必要时上设备动态观测。

## 能做什么

| 问题 | 工具 | 说明 |
| --- | --- | --- |
| 里面有哪些类 / 方法 / 字符串 | `search_dex_symbols` | 直接读 `class_defs` / `method_ids` / `string_ids`，不生成 smali |
| 这个方法具体执行了什么 | `disassemble_dex_method` | 读 `code_item` 的 Dalvik 指令流，`offset: op operands` |
| 给我 Java 源码和资源 | `decompile_android`（`decompile`） | jadx → `<name>_jadx_src/` |
| 给我 Manifest / res / smali | `decompile_android`（`unpack`） | apktool → `<name>_apktool/` |
| 在大树里找一段文本 | `decompile_android`（`smali_search`） | 插件自己遍历，不经外部工具 |
| 这个包是谁签的、和上版同不同签 | `verify_signature` | 结构层（v1/v2/v3 id）+ `apksigner` 裁决分开报 |
| 加壳拿不到真 DEX | `frida_dump` | 扫 rw- 内存里**头部合法**的 DEX，按 SHA-256 去重 |
| 想先观察某方法 | `generate_hook` | 生成可跑 Frida 脚本（observe / override / replace） |

## 代码入口

- `src/domain/android/` — `dex.ts`（表索引）、`code-item.ts`（指令流）、`manifest-model.ts`（AXML 模型）、`axml.ts`（二进制 XML）。
- `src/domain/archive/` — zip 遍历；APK 与 DEX 都从这里进。
- `src/tools/apk/` — 四个工具的实现；`decompile-android.ts` 负责调 jadx / apktool 并**只回目录**，不回几千个文件。

## 使用要点

- **先 `search_dex_symbols` 再反编译**：索引是毫秒级，jadx 是分钟级。找 `license` / `vip` / `subscri` / `token` / `root` 这类词先看有没有。
- `verify_signature` 的两层含义不同：**结构层**只证明文件里有什么（v1 证书块 SHA-256、APK Signing Block 的 v2/v3 id）；**apksigner** 才是密码学裁决。没有 apksigner 时它会明说只有结构层，不要把那段当验证通过。
- 重打包链路在插件外：`apktool b` → `zipalign` → `apksigner sign`，用宿主命令通道执行，插件只负责定位与取证。
- 脱壳后仍然拿不到东西，通常意味着 DEX 是懒解密：保持在触发页、加大 `wait_ms` 再 dump。

## 失败怎么读

| 现象 | 含义 | 下一步 |
| --- | --- | --- |
| `search_dex_symbols` 命中很少 | 加了壳，或只扫了前三个 `classes*.dex` | `frida_dump` 后对落盘 DEX 再搜 |
| `decompile_android` 只回目录不回内容 | 设计如此（日志会截断） | 用 `smali_search` 在目录里搜 |
| `verify_signature` 报 DOES NOT VERIFY | 可能被二次打包 | 比对 signer 证书 SHA-256 是否等于自己构建的那份 |
| `generate_hook` 找到类没找到方法 | 查询过宽 | 它会把该类的声明方法列出来，第二次按名字精确指 |

## 相关文档与测试

- 案例：[`../contract/case-corpus.md`](../../contract/case-corpus.md)（先例包怎么写 Frida 脚本与证据）
- 测试：`src/test/analysis/{dex-index,code-item,apk-signature,frida-dump,hook-template,archive}.test.ts`
- 技能侧：`agent/skills/apkseep/`、`agent/skills/safe-skills/apk-reverse/`
