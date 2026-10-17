# 来源与改编说明

## 上游素材

- 原始文件：`codex-skills/28_简历定制与优化/定制化简历优化器/SKILL.md`（本地技能集合，345 行提示词指南）
- 原始名称：`tailored-resume-generator`
- 上游集合未附带 `LICENSE` 或任何许可声明，也没有可追溯的仓库地址与 commit，因此本包**不声明**具体许可证（`license: "Unspecified"`）。

公开分发前请先确认上游授权；若上游补充了许可，把许可证名称与全文一并替换进本目录即可。

## 本包的改编内容

- `SKILL.md`：补齐 `version` frontmatter；正文从通用提示词改写为 Astravia 内的执行流程——先读工作区里已有的简历文件而不是让用户重复粘贴、按岗位拆解→证据映射→写作→格式→差距报告的次序组织、补充地区简历习惯（北美 / 欧洲 / 中文）、隐私处理与「不编造」约束。
- `ability.json`、`detail.json`、`detail.zh.json`：新增展示层，默认英文、中文放在 `zh` 覆盖里。
- 图标使用 Iconify 的 Solar 名称 `solar:document-text-bold`，由桌面端渲染，不随包分发图形文件。

## 未包含

上游文件里的示例简历为虚构人物（John Doe），仅作结构示范；本包改写时未沿用其中的具体姓名、公司与联系方式。
