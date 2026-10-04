# dbx-pro

Astravia 数据库工作台：连接多种数据库、浏览库表结构、写 SQL、看结果。

## 目录职责

```text
src/
  index.tsx                  插件装配入口（唯一）
  runtime.ts / runtime-contract.ts   与宿主通信的运行时契约
  domain/                    纯类型与纯逻辑，无 React、无 IO
    connection-config.ts       连接配置类型 + 数据库类型清单
    driver-tiers.ts            驱动成熟度分级与文案
    db-env.ts                  宿主注入的环境探测
    dbx-storage.ts             连接配置的读写与本地镜像
    workbench-settings.ts      工作台设置类型、默认值、规范化
    workbench-settings-store.ts  设置持久化
    query-history.ts           历史条目类型与规范化
    query-history-store.ts     历史持久化
    catalog.ts                 库表目录类型
    database-type-visual.ts    各数据库类型的展示元信息
  features/
    database-workspace/
      components/            只放 .tsx，一个文件一个主组件
        database-workspace.tsx    装配入口：Provider + 三栏 + 两个抽屉
        workbench-top-bar.tsx     顶栏
        split-layout.tsx          三栏可拖拽布局
        horizontal-split.tsx     上下可拖拽布局
        connection-tree.tsx       左栏连接树
        connection-node.tsx       连接 / schema / table / column 节点
        connection-editor-sheet.tsx  连接管理抽屉壳
        connection-list.tsx       已保存连接清单
        connection-fields.tsx     连接字段表单
        sql-editor-workspace.tsx  中栏装配
        tab-bar.tsx               多标签
        sql-editor.tsx            CodeMirror 编辑器
        result-panel.tsx          结果区与状态栏
        result-grid.tsx           结果表格
        table-inspector.tsx       表结构
        cell-detail-dialog.tsx    单元格详情
        history 相关见 features/query-history
        settings-panel.tsx        工作台设置抽屉
        write-confirm-dialog.tsx  写操作确认闸门
      hooks/                 状态机与异步流程，不含 JSX
        use-workbench.tsx        工作台全局状态与动作
        use-connection-editor.ts 连接增删改查与连通性测试
      services/              副作用适配与常量
        connection-type-catalog.ts  类型分组、默认端点、空连接
    query-history/
      components/history-panel.tsx  查询历史面板
  shared/                    跨 feature 复用
    components/context-menu.tsx  右键菜单
    services/engine-client.ts    引擎 HTTP 客户端
    ai/send-context.ts           发给 Agent 的上下文
    platform.ts                  宿主平台适配
  test/                      node:test 用例
server/                      Node 侧引擎（HTTP 桥）
  src/engine/                  取数、目录、schema、行数裁剪、写闸门
  src/write/                   直写驱动（PostgreSQL / MySQL / SQL Server）
  src/mcp/                     dbx-mcp 子进程管理与契约
```

分层规则：`components/` 只渲染和收事件，`hooks/` 拥有状态与流程，`services/` 做副作用，
`domain/` 是可单测的纯逻辑。组件之间不横向调用别人的内部状态。

## 开发

```bash
npm install
npm run check        # tsc --noEmit
npm test             # node:test，含引擎 headless E2E
npm run build:engine # 重新打包 server/main.mjs
npm run build        # 前端 + 插件产物
```

行数上限的两端常量必须一致，改动任何一侧都要跑测试：
引擎 `DBX_EFFECTIVE_ROW_CAP`、前端 `ENGINE_ROW_CAP`，`/health` 会回报 `row_cap`，
`src/test/engine-service.test.js` 断言两端一致。

## 分发

正式 `.astraviapkg` 由受保护 CI 从固定提交构建，`dist/` 与 `release/` 不进源码 Git。