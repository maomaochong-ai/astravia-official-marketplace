# 出处

本目录是 [usestrix/strix](https://github.com/usestrix/strix) 技能库的**逐字副本**，用于让本插件在没有安装上游 Python 包时也能完整加载技术知识（ADR 0012）。

- 来源：`strix/skills/`（Apache License 2.0，见同目录 `LICENSE`）
- 复制时间：2026-11-14
- 分类与篇数：
  analysis: 4
  cloud: 4
  coordination: 2
  custom: 4
  frameworks: 4
  protocols: 2
  reconnaissance: 2
  scan_modes: 4
  technologies: 7
  tooling: 13
  vulnerabilities: 29
- 未复制：9 个已在 `agent/skills/<name>/SKILL.md` 里作为宿主入口技能的那一批

**同步方式**：上游升级技能库时重跑 `node tools/vendor-skills.mjs`，不要手改这里的正文——手改会在下一次同步时丢失，也让「与上游一致」这句话失效。
