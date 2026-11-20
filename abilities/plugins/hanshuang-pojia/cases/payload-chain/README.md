# Payload chain — precedent

一段要执行的东西进到目标进程，最少三段：**装载体、映射器、注入器**。
上游 `项目A` 把这三段写成三个写死地址的脚本；换目标就是三处静默错误。
这个包把链条做成**可生成的形状**，每个目标相关数值都是具名占位符。

## 什么时候用这个包

- 需要一个「把东西送进进程并执行」的完整链条，而不是单点脚本；
- 已经定位了入口与代码洞，要一份带回滚的执行计划；
- 想知道某次注入究竟需要哪几个数值——占位符清单本身就是检查表。

## 工作形状

1. `triage_binary` 拿格式、节区、slack；`list_code_symbols` 看入口与导出；
2. `run_case_tool slug=payload-chain tool=payload_chain args="--platform win --out out"`
   —— 先过 `--self-test`，再生成四个文件；
3. 读 `out/chain.md` 的占位符表，把发现阶段得到的数值填进去；
4. `out/loader.py` 在本机先跑（只打形状，不跳转），确认 blob 校验通过；
5. `out/injector.py` 打计划，确认回滚是最后一步；
6. 真执行与验证；报告里把「链条已生成」与「目标可被接上」分开写。

## 这个包不含什么

- 不含可用载荷：`payload.bin` 的 body 是惰性的（win 全零、linux 一个 `ret`）。
  要执行什么由发现阶段决定，生成器不替使用者决定；
- 不含目标偏移：五个占位符必须填，缺任何一个都只说明链条形状，不说明目标状态；
- 不执行任何东西：`loader.py` / `injector.py` 只打印计划。

## 与上游的对应

| 上游 `项目A` | 这里 |
|---|---|
| `make_payload.py` | `payload_chain.py` 的 `build_blob`（固定头 + sha256 自校验） |
| `loader.py` | `out/loader.py`（先校验 sha256 再映射） |
| `injector.py` | `out/injector.py`（五步计划，含回滚） |
| `项目APatch.c` | 不在包内：宿主侧那一段随目标语言而变，此处只留 `PATCH_BYTES` 占位符 |
