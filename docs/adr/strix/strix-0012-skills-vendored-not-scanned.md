# strix-0012 — 技能库随包，不再运行时扫描上游

- **Status:** Accepted
- **Date:** 2026-11-14
- **Context:** 插件 strix 0.9.1；用户要求「技能完整参考上游到插件里供宿主使用，不能去扫上游，要与上游解耦」
- **Related:** [0003](strix-0003-panel-reuses-host-and-subagents.md)（一个 AI）、[0006](strix-0006-tool-surface-parity.md)（工具面）

## 之前是怎么做的，为什么错

`service/skills.ts` 里有一个 `locateSkills()`：依次问 `python`、`python3`、`py`、以及 uv 的
tool venv「`strix` 包装在哪」，然后拿 `strix/skills` 当根。找不到才退回随包的 13 份工具手册。

那是**运行时耦合**，代价在三个地方显形：

1. 插件能不能加载完整技术库，取决于另一套 Python 环境装没装好——而插件本身是 JS 服务；
2. 上游升级会把插件的知识悄悄换掉（同一份插件，两天的行为不同）；
3. `strix_list_skills` 的 `root` 会指向 `C:\Users\…\uv\tools\strix-agent\…`——一个用户看不懂、
   也不该需要知道的路径。

用户的原话是「插件是参考上游自研实现的」。既然是自研，知识就必须随包，而不是借上游的。

## The decision

**把上游技能库逐字复制进插件，运行时不探任何外部安装。**

```
agent/skills/<name>/SKILL.md          9 个宿主入口技能（列表里看得见）
agent/skills/strix/tooling/*.md       13 份工具手册（本插件自己的写法）
agent/skills/library/<category>/*.md  75 篇上游技术库（本次新增，逐字副本）
agent/skills/library/LICENSE          上游 Apache-2.0 原文
agent/skills/library/PROVENANCE.md    出处、复制时间、分类与篇数、同步方式
```

`service/skills.ts` 收缩成一个函数：

```ts
export function locateSkills(): SkillLocation {
	const override = process.env.STRIX_SKILLS_DIR;
	if (override) return { root: override, source: "env" };
	return { root: packagedSkillsRoot(), source: "bundled" };
}
```

没有解释器探测，没有回退链。`strix_list_skills` 现在回传 `source`（`bundled` / `env`），
于是"这份知识从哪来"在工具结果里是**可回答的**，不是靠读代码猜。

## 为什么是复制而不是 git submodule / npm 依赖

- submodule 要求装包的人有权限与网络，而插件是从市场下载的压缩包；
- npm 依赖拉的是 JS 包，上游技能是 `.md`；
- 复制是唯一能"装完就能用、离线也能用、版本可核对"的形态。

代价是同步靠脚本：`node tools/vendor-skills.cjs`。`PROVENANCE.md` 里写明了"不要手改正文"，
因为手改会在下一次同步时丢失。

## 许可

上游是 **Apache-2.0**（仓库根 `LICENSE`）。复制时必须带许可与出处，所以 `library/LICENSE`
与 `library/PROVENANCE.md` 一起进包；`PROVENANCE.md` 里也写了复制范围（哪 11 类、各几篇）。

## What this does not do

- 不复制上游的 9 个入口技能：它们已经在 `agent/skills/<name>/SKILL.md` 里作为宿主可见技能存在，
  再复制一份会让同一篇正文有两个来源。
- 不做"版本对齐检查"（对比上游 git tag）：插件不联网核对上游，那不是它的事。
- 不把 75 篇正文塞进系统提示：`strix_load_skills` 按需取（工具层，和上游 `load_skill` 一致）。

## The cost

- 包体变大：75 篇 md 约 190 KB（未压缩）。相对 113 KB 的服务包是可接受的。
- 知识会随上游漂移：同步是手工触发。`PROVENANCE.md` 的日期就是"这份知识多新"的唯一线索——
  这是有意的：把"新不新"变成可查的事实，而不是运行时的不确定。
