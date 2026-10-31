# 05 · 事实层与存储

> 现行文本。归并自 [0005](../0005-storage-as-manuscript-ledger.md) 与
> [0017](../0017-review-round-one-global-revision-and-total-verify.md)（并发基线部分）。

## 一句话

书是文件，一次提交同批发布，`revision` 是并发基线。

## 现行规矩

1. **存在 Plugin Storage，不写用户工作目录**。按 plugin id 隔离的私有命名空间，
   `commit(changes)` 是唯一原子发布点。往用户目录写会把工作台变成「一堆散落文件」，
   还会在卸载后留下垃圾。
2. **布局固定**：

   ```text
   books/index.json                 书目索引
   books/<id>/book.json             作品事实（阶段、卷、弧、章纲、正文索引）
   books/<id>/chapters/<n>.md       正文，一章一个文件
   books/<id>/reviews/<n>.json      七维评审
   threads/<id>.json                伏笔台账
   decisions/<id>.jsonl             决策日志，只追加
   ```

3. **一次提交同批发布**。书、章、评审、台账在同一批 `commit` 里落地；中途失败不留半本书。
4. **`revision` 是并发基线**。读的时候拿到它，写的时候带回去；对不上就结构化失败，
   不覆盖别人的写入。
5. **台账独立成文件**，不改 `NovelBook` 的 schema：伏笔是**增量**事实，把它塞进书里会让
   每次登记都要重写整本书。
6. **仓储不依赖 `PluginContext`**，只依赖一个结构子集（`ManuscriptStorage`），
   于是同一份实现能在宿主里跑、也能在内存里跑测试。

## 代码落点

| 事 | 文件 |
| --- | --- |
| 边界与内存实现 | `src/repository/manuscript-storage.ts` |
| 路径与读写 | `src/repository/manuscript-repository.ts` |
| 事实类型 | `src/domain/novel-types.ts` |
| 提交语义 | `src/application/studio-service.ts` 的 `persist` / `persistThreads` |

## 代价与边界

- 一本书一个 JSON 意味着**整本重写**。长篇小说到几十万字时，`book.json` 只存索引与章纲，
  正文在 `chapters/*.md` 里，所以重写的是目录不是正文。这条边界不能破。
- 决策日志 `jsonl` 只追加，不提供删除。撤回用新记录表达。
- 没有跨设备同步，也没有导出成第三方工程格式（明确不做，见 03）。

## 怎么验证

```bash
cd abilities/plugins/mahua-writing-team
npx vitest run test/repository.test.ts 2>/dev/null || npx vitest run   # 存储测试在整套里
grep -n "BOOK_INDEX_PATH\|expectedRevision" src/repository/manuscript-repository.ts | head
```
