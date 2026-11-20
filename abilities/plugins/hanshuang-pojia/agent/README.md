# hanshuang-pojia — agent/ 子体系导航

`agent/` 是插件随包的智能体资料，按「契约 → 技法」两层组织。自上而下读取：

```
agent/
├── prompts/
│   └── SYSTEM.md               standing system contract（lab 开关、范围记录、交付形状、工具链、todo）
└── skills/
    ├── memory/                 ★ 核心：作战手册 + 路由表（宿主里的技能名是 memory）
    ├── apkseep/  softseep/     APK / 授权校验专项
    ├── client-license-validation-bypass/
    └── safe-skills/            apk-reverse / ida-reverse / radare2 / reverse-engineering / mcp-js-reverse-playbook
```

插件根另有两份**不属于 agent/** 的契约与事实：

| 文件 | 作用 |
|---|---|
| `AGENTS.md` | 跨 Agent 协议（工具路由、范围记录、交付形状、终端与写盘边界）。按仓库规范放在插件根 |
| `docs/reference/skill-library.md` + `.sha256` | 随包技能库清单、来源与逐文件哈希。属「当前事实」，因此归 `docs/reference/` |

## 读取顺序

1. **每轮**：kernel 块（`src/domain/kernel.ts`）里有一行固定路由 —— 先读 `skills/memory/SKILL.md`。
   这一行在 lab 开 / 关两种状态下都在，因为它是路由，不是实验环境的特权。
2. **lab 开启后**再注入 `prompts/SYSTEM.md`（任何技能加载前就必须成立的规则）。
3. 进入具体任务：`skills/memory/SKILL.md` 的路由表决定读哪个专项技能。

## 为什么核心技能叫 memory 而不是按需加载的参考

专项技能只教「这一类怎么做」，而 `memory` 同时带着**路由表 + 执行契约 + 交付形状**。
把它当参考资料按需读取，会出现两个已知失败：

- 关掉实验环境后，模型知道插件存在，却不知道该读哪本手册；
- 直接进专项技能（例如 `apkseep`）时，拿不到路由与交付纪律，输出形状对不上。

所以 kernel 块把「先读 memory」写成每轮都出现的一行，`plugin.json` 里它也仍是技能选择器里唯一可见的那一项。

## 与源码/面板的关系

- 面板的工作台（`src/features/workbench`）与这两层**各自独立**：文档与技能是「带着的资料」，
  不装它们面板照样能跑；面板读写状态时用插件自有存储，与 `prompts/SYSTEM.md` 里的 lab 开关同一份状态。
- 术语表见插件根 `CONTEXT.md`；能力与页面说明见根 `README.md`。
