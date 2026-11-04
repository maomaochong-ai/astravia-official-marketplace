# 15. 技能必须过一次严格 YAML 解析

## 背景

插件的 `agent/skills/<slug>/SKILL.md` 是宿主发现技能的入口。宿主有两条解析路径：

- `apps/desktop/src/main/skills/skill-frontmatter.ts`：逐行宽松读取，只服务于设置页的读写；
- `packages/coding-agent/src/resources/shared/frontmatter.ts`：`yaml` 包的 `parse()`，**技能能不能被列出来只取决于这条**。

第二条路径抛异常时，`discovery.ts` 的 `loadSkillFromFile` 不是降级、不是警告后保留，而是 `return { skill: null }` —— 整条技能直接消失，面板上什么都不显示。

我们曾经把 `description` 写成一行自然语言：

```yaml
description: Work on raster images in Photocraft inside Astravia: layers, masks…
```

中间那个冒号加空格，在 YAML 里开了一个嵌套映射。`yaml` 报 `Nested mappings are not allowed in compact mappings`，于是装好的插件在技能面板里一个都不出现，插件本身却一切正常。这个失败模式最难查的地方在于：`js-yaml` 等其它解析器会放行，所以"本地验证没问题"。

## 决定

1. 十五个 `SKILL.md` 的 `description` 一律加双引号；将来新增字段也遵守同一条：**面向人的长文案不写成裸标量**。
2. `tests/craft-skill-frontmatter.test.mjs` 用不依赖任何 YAML 库的规则兜底：出现 `: `、` #`、或以 YAML 指示符开头的未加引号值即失败。这条测试模仿的是宿主的边界（首行 `---`、下一个 `\n---` 结束），不是另写一个 YAML 实现。

## 代价

- 引号让 diff 里这一行看起来比原来吵一点；换来的是这个失败模式不会第二次发生。
- 测试是近似判定，不是真解析。它只能挡住已知的裸标量陷阱；真要验证可以拿宿主装的那份 `yaml` 跑一次 `parse()`，但那意味着仓库要多一个依赖，不值得。

## 相关

- 宿主侧决策不在本仓库：`docs` 里只留结论和复现方式。
- 插件被禁用（`plugins-manifest.json` 的 `enabled: false`）是另一个成因，和本文无关：那种情况下 `skillPaths` 根本不会进入运行时配置。
