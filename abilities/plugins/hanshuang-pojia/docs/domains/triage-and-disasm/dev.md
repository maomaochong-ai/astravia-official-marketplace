# 模块：静态体检与反汇编

识别一个本地样本是什么、里面有什么、某个函数在做什么。**不执行样本**，全部在浏览器侧读字节。

## 能做什么

| 问题 | 工具 | 产出 |
| --- | --- | --- |
| 这是什么文件、有没有壳、风险多高 | `triage_binary` | 格式、SHA-256、熵、节区、导入表、导出表、0–100 风险分 |
| 一整个目录里先看哪个 | `triage_directory` | 按风险排序的表，最可疑的排前面 |
| 字符串里有没有端点 / 路径 / 密钥 | `scan_binary_strings` | 命中项 + offset，可回填到节区 |
| 符号表还剩什么 | `list_code_symbols` | 函数、导出、导入；被 strip 会明确说 |
| 这段字节是什么指令 | `disassemble_range` | 逐条反汇编（AArch64 固定 4 字节；x86 走实用于集，未知编码输出 `.byte`） |
| 这个函数在干什么 | `decompile_function` | 寄存器级伪 C（r2 `pdc` 层，无类型恢复） |
| 两个版本差在哪 | `diff_binaries` / `diff_functions` | 字节级 hunk / 函数级 same-constants-changed |
| 这条发现严不严重 | `explain_triage_finding` | 规则口径与下一步 |

## 代码入口

- `src/domain/triage.ts` — 体检编排；`overallEntropy()` 统一算全文件熵（曾经在三处内联同一表达式）。
- `src/domain/native/` — `image.ts`（节区与地址换算）、`deep.ts`（反汇编文本渲染）、`insn.ts`（解码）、`audit.ts`（熵与热点节）。
- `src/domain/strings.ts` + `string-kinds.ts` — 字符串抽取与分类（url / path / identifier）。
- `src/features/workbench/components/pages/{triage,disasm,strings}.tsx` — 面板三页。

## 使用要点

- **地址有两套**：文件偏移与虚拟地址。`DeepOptions.map` 传进去之后，页头才会同时给 `file+0x…` 与 `vaddr`，并标出所在节区；不传就只给文件偏移。换算函数是 `vaddrToOffset(map, offset)` / `offsetToVaddr(map, offset)`，参数顺序是 `(map, offset)`。
- **反汇编不会自己找函数边界**：`disassemble_range` 是线性扫描，要从符号、字符串交叉引用或入口点给出起点，不要拿它整段扫几 MB。
- **`decompile_function` 不是 Hex-Rays**：保留寄存器名、不合并变量、不猜有符号性。把它当「能跟的控制流」，别当源码引用。
- 威胁判定读 `explain_triage_finding`，别自己解释规则名——规则表在 `src/domain/rules.ts`，解释文案与它同源。

## 失败怎么读

| 现象 | 含义 | 下一步 |
| --- | --- | --- |
| `list_code_symbols` 只返回少量名字 + stripped 警告 | 符号被剥 | 用导入表 + 字符串交叉引用定位 |
| `disassemble_range` 出现大量 `.byte` | 架构判错或落在数据段 | 显式给 `arch`，或先核对节区 |
| triage 报熵很高但没节区细节 | 壳 / 压缩 / 加密 | 先 `frida_dump` 或解包，再体检 |

## 相关文档与测试

- 契约：[`../contract/case-library.md`](../../contract/case-library.md)（判定点怎么进案卷）
- 审计：[`../audits/upstream-parity-audit-2.9.3.md`](../../audits/upstream-parity-audit-2.9.3.md)
- 测试：`src/test/analysis/{triage,disasm,deep,diff,symbols,code-item}.test.ts`
