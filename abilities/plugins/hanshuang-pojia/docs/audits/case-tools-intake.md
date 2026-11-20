
## 6. 已落地（2.17.20 / 2.17.21）

| 建议 | 状态 | 证据 |
|---|---|---|
| P0 `python` + `run_case_tool` | **已做** | `plugin.json#commands` 17 项；`src/tools/case/run-case-tool.ts`；实测 `pin_surface --self-test` 7/7、kit 47/47 |
| P1 新先例包 `payload-chain` | **已做** | `cases/payload-chain/`（case.json / README / scope / docs×2 / tools），`payload_chain.py` 自检 10/10 |
| P1 `check:cases --with-tools` 进门禁 | **改为独立脚本** | `npm run verify:cases`；不进 `verify:generated`，否则 python 会成为构建硬依赖 |
| P1 OCR 八脚本归一 | 未做 | 上游 `ocr_*.ps1` 依赖 Windows OCR API，与本插件解码器重叠度低 |
| P1 先例包加 `scenario` 列 | **未做，理由变了** | 20 个包全是方法级先例，列里填同一个值等于装饰。真正缺的是「现场级」包，而那需要真实目标的书面证据，不能人造 |

### `payload-chain` 与上游 `项目A` 的对应

| 上游 | 这里 | 差异 |
|---|---|---|
| `make_payload.py` | `build_blob`：magic + version + name + body + sha256 | 多了自校验，改一字节即报错 |
| `loader.py` | `out/loader.py` | 先验 sha256 再映射 |
| `injector.py` | `out/injector.py` | 五步计划，回滚固定第五步 |
| `项目APatch.c` | 不搬 | 宿主侧随目标语言而变，只留 `PATCH_BYTES` 占位符 |
| 写死地址 | 五个具名占位符 | 占位符清单本身就是检查表 |

实测：`python tools/payload_chain.py --self-test` → kit 47/47 + chain 10/10，退出码 0；
`--platform linux --out out` 生成四个文件（`payload.bin` 84 字节、`chain.md` 1.7KB）。

### 顺带修的一个真问题

`check-precedent-package.mjs` 原来直接用 `python3`。Windows 上这个名字常是 Microsoft Store
的占位壳，`spawnSync` 能启动但立即以 9009 退出 —— 看上去像「工具的 self-test 失败了」，
实际是没有解释器。改为先探 `python` 再探 `python3`，两个都没有就报「没有解释器」而不是「工具坏了」。
修完 20 个包全部 `✓ … tools=1`，输出 `20 packages checked with tool self tests`。

不做的：不把上游 248 个文件搬进来。项目C 是空的、项目A 的八个 OCR 脚本只差参数、23 个 .cs 是同一个修复样例的迭代 —— 搬进来只会得到「目录里有文件、机器上跑不了」的死重量，这与 ADR 0010 §5.1「契约搬、产物不搬」的判断一致。
