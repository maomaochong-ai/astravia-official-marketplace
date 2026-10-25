# ADR-0009：对话框技能胶囊的图标与显示名

## 状态

已接受。修订 [ADR-0003](./0003-official-icon-and-skill-activation.md) 决策 6 中「`alias` 取市场卡名称」一条：安装清单仍写市场卡名称，但胶囊与命令面板优先读包内 `SKILL.md` 的声明。

## 背景

用户安装后反馈两件事（Observed，桌面端对话框输入区）：

1. 「技能 / 场景」面板里这一条显示的是默认方块图，不是官方标识。
2. 显示的标题是英文 `Qiushi Methodology`，切换宿主语言不变。

追查宿主读数据的路径（Observed，`apps/desktop/src/main` 与 `packages/theme-ui`）：

| 位置 | 取值 |
| --- | --- |
| `skills/skill-service.ts` `listSkills` | `alias: skill.alias \|\| entry?.alias`、`icon: loadSkillPackagePresentationIcon(...)` |
| `skills/skill-market-install.ts` | 安装时把 `entry.alias` 写成市场卡 `name`，即英文 |
| `theme-ui/src/skills/skill-icon.tsx` `isImageSkillIcon` | 只接受含 `://`、以 `/`、`./`、`data:` 开头的值 |
| `abilities/presentation/skill-package-presentation.ts` | 读 `SKILL.md` 的 `metadata.astravia.presentation.icon`，用 `createLocalPresentationAssetUrl()` 转成 `astravia-file://local/...` |

两个结论：

- `ability.json` 的 `icon: "assets/icon.png"` 只服务能力详情页与本地目录图标（`local-ability-presentations.ts` 会把它解析成文件 URL），**不进入 `SkillInfo.icon`**。胶囊读的是 `SKILL.md` 的声明，缺这条就回落默认图，而裸相对路径也过不了 `isImageSkillIcon` 的格式判断。
- `SkillInfo.alias` 是单个字符串，安装清单的 schema 也只允许 `Type.Optional(Type.String())`，abilities 域没有 `getAppLanguage()` 调用。**包内没有任何办法让胶囊文案跟随界面语言**：包只能提供一个固定值。

## 决策

### 1. 图标写进 `SKILL.md` frontmatter

```yaml
metadata:
  astravia:
    presentation:
      icon: assets/icon.png
```

`assets/icon.png` 已在包内（1024×1024，299 KB，PNG，远低于 8 MB 上限），安装后位于 `~/.astravia/skills/qiushi-skill/assets/icon.png`，主进程把它包装成带修订号的 `astravia-file://` URL。这是宿主文档化的声明位，不是绕路。

### 2. 显示名给中文单值，不再依赖英文市场卡名

```yaml
alias: 求是方法论
```

诚实地说清代价：这是**固定值**，英文界面的用户也会看到中文。接受它，因为这份内容本身是中文的——`SKILL.md` 的 description 中文在前、`references/skills/**` 十份规程与 `references/cases/**` 全是中文，给中文正文配一个英文标题才是真正的错配。宿主自身的 `build-apple-apps` 内置技能同样用中文 `alias`（Observed：commit `9a594f8ae`）。

### 3. 不为此改宿主

跟随语言需要改 `open-marketplace-installer.ts`：安装时按 `getAppLanguage()` 取 `detail.i18n[lang].name` 写 `alias`，并把 `SkillInfo.alias` 换成按语言映射的结构。那会影响所有市场技能，超出本次发布范围，也与「不改宿主代码」的既有约束冲突。记为宿主侧待办，不在本源推进。

## 兼容和迁移

- 两条声明都是包内新增字段，旧客户端忽略未知 frontmatter 键，不影响加载。
- 已安装用户需要一次更新到 2.5.0 才能看到图标与新文案：`SKILL.md` 随包替换，清单里的旧 `alias` 会被新包声明覆盖。
- 默认语言（市场卡 `name`、`description`、`detail.json`）仍是英文，中文在 `detail.i18n.zh` 覆盖里——本条 ADR 只动胶囊显示名，不动目录卡片的多语言规则。

## 备选方案

**A. 只改 `ability.json` 的 `icon`。** 详情页本来就有图，问题出在胶囊读另一处。否决：改不到点上。

**B. 用 `solar:` 图标名。** 该体系有官方标识，且 `solar:` 在 `SkillInfo.icon` 里能否解析取决于宿主 safelist，不如直接用官方位图。否决。

**C. 把 `alias` 写成「求是方法论 Qiushi」。** 胶囊宽度有限会截断，双语拼串在任何一种语言下都更差。否决。

**D. 保留英文 `alias`，等宿主支持多语言。** 用户当前就看不到中文，等于不修。否决。

## 验证

```bash
cd astravia-official-marketplace/abilities/skills/qiushi-skill

# 1) 两条声明存在且指向真实文件（仓库级测试同时断言）
node scripts/verify-package.mjs
node --test tests/package.test.mjs
cd ../.. && node --test tests/qiushi-guide.test.mjs

# 2) 构建产物里带上了这两条
node scripts/marketplace.mjs check
head -10 .marketplace-build/site/abilities/skills/qiushi-skill/SKILL.md
```

判据：

1. `head` 输出含 `alias: 求是方法论` 与 `metadata.astravia.presentation.icon`。
2. 构建产物 `assets/icon.png` 存在（299162 字节）。
3. 桌面端更新到 2.5.0 后，输入区「技能 / 场景」里这一条显示官方标识，标题为「求是方法论」；切换英文界面标题不变（Assumed，需实机确认——这正是决策 3 记录的宿主限制）。
