# ADR-0010：移除图文导览插件，图文页回到技能包单份分发

## 状态

已接受。撤销 `31d19819`（feat(qiushi-skill): 2.5.0 图文入口插件）引入的插件形态，技能侧同步发出 2.5.1。

## 背景

`abilities/plugins/qiushi-guide`（0.1.0）本身没有独立内容（Observed，读插件目录与 `plugin.json`）：

| 它做的事 | 证据 |
| --- | --- |
| 复制一份技能包里的页面 | `src/assets/preview-page.html` 与 `abilities/skills/qiushi-skill/assets/preview/index.html` 逐字节相同，靠 `scripts/sync-preview-page.mjs` 手工同步 |
| 在能力详情页插入一张卡片 | `permissions` 声明 `ui.slot.ability-detail`、`ui.slot.workspace-view`，`guide-entry-slot.tsx` 渲染入口 |
| 点开仍是同一份文件 | `guide-view.tsx` 用 `?raw` 导入的副本渲染，不读技能目录 |

代价是明确的：一份 76 KB 页面在仓库里存两份并有同步脚本、一条独立市场条目、一个 `plugin-qiushi-guide` Release，以及约百行插槽代码；换来的只是详情页上多一个点击入口，而这个入口的落点技能包自己就带着，`scripts/open-preview.sh` 已经能打开。

## 决策

1. 删除插件目录与 `.astravia/marketplace.source.json` 中的条目，不再提供详情页卡片入口。
2. 图文页继续随技能包分发；详情文案直接交代打开方式（包内路径与 `scripts/open-preview.sh`），不再提「配套插件」。
3. 技能版本 2.5.0 → 2.5.1。构建对未升版本的技能包复用已发布字节（[static-marketplace.mjs](../../../scripts/static-marketplace.mjs) `// preserve its published bytes until a version bump`），不升版本修正后的文案不会进入分发产物。
4. 仓库级测试由「两份页面字节一致 + 插件打包」收敛为「页面随包完整 + 详情指向它 + 索引版本一致」，文件改为 `tests/qiushi-skill.test.mjs`。
5. 不删除已发布的 `plugin-qiushi-guide` Release：仍指向旧索引的客户端会去取它，删制品只会把可用的降级成下载失败。索引不再引用即达到目的。

## 验证

```bash
node scripts/marketplace.mjs check
node scripts/marketplace.mjs build --previous .gh-pages-wt
node --test tests/*.test.mjs
```

判据（Observed 以本地构建产物为准，发布后以 gh-pages 索引为准）：

- 生成索引里 `qiushi-guide` 不再出现，`qiushi-skill` 版本为 2.5.1；
- 站点目录 `site/abilities/plugins/qiushi-guide` 不存在，`site/abilities/skills/qiushi-skill/detail.json` 已是新文案；
- 桌面端刷新市场源后，效率分类下只剩「求是方法论」，其详情页「两个值得知道的附加件」第一步不再提到插件；
- 已安装旧插件的用户不受影响，卸载后详情页不再出现卡片。
