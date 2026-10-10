# BI 数据资产 —— M0 现状与迁移说明

> 交付版本：dbx-pro **0.1.15 → 0.1.16**（2026-10-09）
> 对应决策：[ADR-0009](../adr/adr-0009-bi-data-assets.md) §9 的 M0；实施方案：[bi-data-assets-implementation-plan.md](./bi-data-assets-implementation-plan.md) §3 的 T-M0-1 ~ T-M0-4

## 一句话

M0 只修地基：**不改任何 UI 行为**，把存储格式升到可演进的 v2、把静默丢数据改成明确提示、清掉一个测不到真实代码的孤儿测试。

## 用户能感知到的变化

只有两条，其余完全同前：

| 变化 | 之前 | 现在 |
| --- | --- | --- |
| 产物数量上限 | 20 条，超出**静默丢弃**最早的（用户毫无察觉） | 100 条，超出时宿主 toast 提示「已达上限 100 条，最早的 N 条未能保存」 |
| 历史产物 | —— | 列表里多一个「只读快照」标记（见下），预览 / 下载 / 新窗口打开 / 交给 AI 修改 / 删除全部照常可用 |

## 存储格式：v1 → v2

`visualizations.json`（宿主插件私有存储，单文件）：

```jsonc
// v1 —— 历史格式：裸数组，没有版本号
[ { "id": "viz-…", "title": "…", "type": "dashboard", "connection": "pg", "table": "orders",
    "html": "<html>…</html>", "chartItems": [ … ], "createdAt": 1700000000000 } ]

// v2 —— 当前格式：文档外壳带版本号
{ "schemaVersion": 2,
  "items": [ { "id": "viz-…", …, "readonlySnapshot": true } ] }
```

读路径的判定规则只有一条：**看文档外壳是不是裸数组**。

| 落盘形态 | 判定 | 处理 |
| --- | --- | --- |
| 裸数组 | v1 | 逐条保留 `html` + `chartItems`，补上空 `chartItems`，打上 `readonlySnapshot: true` |
| `{ schemaVersion: 2, items: [...] }` | v2 | 按原样读取 |
| `{ items: [...] }`（无 `schemaVersion`） | 中间态 | 按 v2 读 |
| 其它（`null` / 标量 / `items` 不是数组） | 无法识别 | 返回空列表，**不做任何写回** |

### 为什么 v1 条目是「只读快照」

v1 产物只有一次性生成的 `html` 和图表配置，没有可编辑的数据来源（SQL 结果行）。要让它可筛选、可重新取数，必须**重跑 SQL** —— 那是 M1 的动作。反推不可靠，所以 M0 不猜：条目照旧可用，只是标明它不能局部编辑。M1 的「重新取数」成功后即可清掉这个标记。

### 迁移是只读不删

读路径**从不写回**。只有用户主动新增 / 删除 / 清空才落盘，因此升级本身不会改写磁盘上的旧文件；第一次落盘时才写成 v2。

## 兼容性与风险

- **本版读旧数据：无损。** v1 文档完整可读，`html` 与 `chartItems` 一个字节都不动。
- **旧版读新数据：读不懂。** 0.1.15 及更早的版本拿到 v2 文档会当成「没有数据」（空列表），并在下一次写盘时覆盖掉它。
  → **升级提示里要写明「升级后请勿再回退到 0.1.15 及更早版本；如需回退，先备份 `visualizations.json`」**。
- 上限仍有截断（100 条），但**从静默改为明确提示**，不再有「保存了却不见了」的静默丢数据。

## 代码与测试清理

| 对象 | 处置 | 理由 |
| --- | --- | --- |
| `src/test/filter-bar.test.js`（4.4 KB） | **删除** | 它测的是 ADR-0007 之前就已删除的 `Canvas.tsx` + `FilterBar.tsx`，`applyFilters` 是测试里的本地副本 —— 测不到任何生产代码。全仓 `grep filter-bar\|FilterBar\|filterBar` 确认无生产引用。其筛选语义（空集合 = 不过滤、跨来源列跳过、多列 AND）在 M1 对真实实现 `dataset-filter.ts` 重写。 |
| `src/shared/services/infer-schema.ts` | **保留**（无生产引用但先不删） | 它推断列角色（时间 / 度量 / 维度）的能力正是 M1 筛选面板决定「等值多选」还是「数值/日期范围」控件的依据。M1 接上消费者后它就是活代码；若 M1 最终不用，届时再删。 |
| `design.md` 路线图 | **修正** | 原「添加数据可视化功能」早已落地（ADR-0005 / ADR-0007），改为已完成项 + 指向 ADR-0009 的 BI 数据资产条目。 |

## 新增 / 改动文件

- 新增 `src/domain/visualization-doc.ts` —— 文档读写、版本判定、条目归一化的唯一位置（纯函数，不依赖 React 与 store 单例）。
- 新增 `src/test/visualization-doc.test.js` —— 12 个用例，覆盖 v1 / v2 / 无法识别输入 / 混合可信度条目 / 往返不丢。
- 改 `src/features/visualization/visualization-store.ts` —— 只留状态与落盘；`MAX_VISUALIZATIONS` 20 → 100；新增 `notifyTruncated()`。
- 改 `design.md`、`plugin.json`、`ability.json`、`package.json`、`package-lock.json`、`.astravia/marketplace.source.json` —— 版本号与路线图。

## 验证记录（2026-10-09）

| 命令 | 结果 |
| --- | --- |
| `npm run check`（tsc --noEmit） | 通过，无输出 |
| `npm test` | **640 tests / 639 pass / 1 skip / 0 fail** |
| `npm run build` | 通过；产出 `release/dbx-pro-0.1.16.astraviapkg`（29 runtime files） |
| `node scripts/marketplace.mjs check` | `Validated source entries for astravia-official-marketplace` |
| `node scripts/marketplace.mjs build` | 退出码 0；`Prepared 10 new packages; distribution changed: true` |
| `node --test tests/*.test.mjs` | **59 tests / 59 pass / 0 fail** |
| 生成索引对账 | 与上一次构建逐条 diff：**只有 dbx-pro 的 `version` 与 `releases[0]` 变化**（0.1.15 → 0.1.16），其余条目零差异 |
| `git status` 核对 | 只有 M0 预期文件；`dist/`、`release/` 依 gitignore 未跟踪 |

## 遗留（M1 处理）

- 详情抽屉、数据集筛选、重新取数、UI 内渲染 `chartItems` —— 全部属于 M1。
- `DatasetSpec` / `ChartFilter` 与 `Visualization.html` 改可选 —— M1 第一刀。
- 落盘体积上限（`DATASET_STORE_BYTE_LIMIT`）与行数上限（`DATASET_ROW_LIMIT = 2000`）需用真实数据校准，M1 落地时实测。
