# ADR 0005：作品事实存 Plugin Storage，一本书一个 JSON + 每章一个正文文件

- 状态：已接受（2026-10-29）
- 决策对象：`abilities/plugins/novelwright/src/repository/`
- 依据：[plugin-sdk storage.d.ts](../../../../../open-astravia/packages/plugins/plugin-sdk/dist/storage.d.ts)、[manifest.md → 插件配置放哪里](../../../../../open-astravia/packages/plugins/plugin-sdk/docs/manifest.md)

## 1. 背景

上游把事实层做成三类扁平事实（Progress / Checkpoint / Artifact），单文件 `temp + fsync + rename`
原子替换，跨文件写入用 `PendingCommit` Saga 而不是假装有事务。插件侧拿到的是
`ctx.storage`：按 plugin id 隔离的私有命名空间，提供 `readFile` / `writeFile` / `commit(changes)` /
`readSnapshot(paths)`——`commit()` 是唯一的原子发布点。

## 2. 决策

存储布局：

```text
books/index.json                  # 作品索引：id / title / phase / currentChapter / committedCount / targetChapters / updatedAt
books/<bookId>/book.json          # 卷弧计划、阶段、Progress、Checkpoint 列表、章节元数据（不含正文）
                                  # Checkpoint 存 noteKey（`checkpoint.*`）+ params，不存散文
books/<bookId>/chapters/<n>.md    # 章正文（人可读，直接可当稿件导出）
books/<bookId>/reviews/<n>.json   # 评审报告
decisions/<bookId>.jsonl          # Arbiter 裁定审计（追加）
entitlement.json                  # 离线凭证（见 ADR 0004）
```

三条规则：

1. **正文与元数据分离。** `book.json` 保持在几 KB 量级：每次推进只重写它和当前章正文，
   500 章的书不会因为改一个状态位而重写 3 MB。
2. **一次推进 = 一次 `commit()`。** 「写正文 + 更新章状态 + 追加 checkpoint」作为同一批
   changes 提交，避免出现「正文写了但状态没变」的半个状态。这是上游 Saga 在插件侧能做到的
   最强等价物：单次原子发布，不是跨文件事务。
3. **写前必读、按 revision 乐观并发。** `commit(changes, { expectedRevision })`，revision 变了
   就重读重算——同一作品只允许一个 Tab 推进（多 Tab 时后到者拿到冲突提示，不是静默覆盖）。

## 3. 为什么不写进用户工作目录

工作区视图是跨项目的：用户可能在任何 cwd 打开它，包括没有项目目录的普通对话。往 cwd 写文件
会得到一堆位置不可预期的 `books/` 目录，还会和用户的 git 仓库混在一起。因此工作台不落盘，
导出走显式动作：把整部稿件拼成一份 Markdown 交给宿主的剪贴板，由用户自己粘到要保存的地方。
不申请 `fs.write`，也就不存在「写到哪里」的歧义。

## 4. 后果

- 数据随插件卸载删除（宿主按 plugin id 隔离），因此导出是**用户可见的显式动作**：一次点击把
  全书复制到剪贴板，入口放在工作台头部（作品标题旁边），不隐藏进菜单。
- 没有查询能力：作品索引是 `books/index.json` 一个数组，几百本书也只是几十 KB。不引入数据库。
- 迁移靠 `book.json` 里的 `schemaVersion`：读到时低版本就升级后写回，不做破坏性迁移。
