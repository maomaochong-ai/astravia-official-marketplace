# Photocraft 的决策记录

这个目录属于 Photocraft 这一支 craft 插件。

- `craft-0001` … `craft-0012` 与 `craft-CONTEXT.md`：整族共用，与其余 craft 插件逐字节相同，
  由 `tests/craft-docs.test.mjs` 守护。
- `0001` … `0011`（不带 `craft-` 前缀）与 `CONTEXT.md`：本应用早期的历史记录，写的是「首次打开从上游
  Release 取 web zip」那条路。那条运行时下载链路已被 `craft-0011` 取代，`craft-0012` 又把站点换成
  「上游发布的那份包」——但下载发生在打包时，不是用户首次打开时。这些文件只作为当时判断的留痕，
  不要再按它们施工；其中 `0005`、`0007`、`0008`、`0010` 与 `0006-payload-pin.md` 的结论都已作废。
- 想看「站点从哪来」，读 `craft-0012-the-site-is-upstreams-release-bundle.md`；
  想看「为什么不是自研内核」，读 `craft-0001` 与 `craft-0011`。
