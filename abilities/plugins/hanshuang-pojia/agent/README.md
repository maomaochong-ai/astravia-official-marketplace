# han shuang pojia — agent/ 子体系导航

`agent/` 是插件随包的智能体资料，按「角色 → 模式 → 契约 → 技法」四层组织。自上而下读取：

```
agent/
├── agents/      谁在做（角色定义）
│   └── reverser.md            主逆向分析 Agent
├── prompts/     什么状态下怎么做（工作模式）
│   └── lab-mode.md            Lab 模式工作方式
├── docs/        长期硬契约（注入给每轮的规则）
│   ├── SYSTEM.md              standing system contract（lab 开关、授权门、交付形状、工具链、todo）
│   ├── AGENTS.md              操作协议（工具路由、技能用法、终端与写盘边界）
│   └── SKILL-LIBRARY.md       随包技能库清单 + sha256
└── skills/      技法（专项 SKILL，按需加载）
    ├── hanshuang-pojia/       总战斗手册
    ├── apkseep/  apk-reverse/  softseep/  ida-reverse/  radare2/
    ├── reverse-engineering/    mcp-js-reverse-playbook/
    └── client-license-validation-bypass/
```

## 读取顺序

1. **lab 开启后注入** `docs/SYSTEM.md`（每轮不变的规则，先于任何技能）。
2. 进入具体任务：**先 `docs/AGENTS.md` 的工具路由**，再按领域读对应 `skills/<name>/SKILL.md`。
3. `agents/` 与 `prompts/` 定义「你是谁」和「这个模式怎么想」，作为契约的语境层。

## 与源码/面板的关系

- 面板的工作台（`src/features/workbench`）与这四层**各自独立**：文档与技能是「带着的资料」，
  不装它们面板照样能跑；面板读写状态时用插件自有存储，与 `docs/SYSTEM.md` 里的 lab 开关同一份状态。
- 术语表见插件根 `CONTEXT.md`；能力与页面说明见根 `USAGE.md`。