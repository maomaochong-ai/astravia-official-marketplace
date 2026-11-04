# WordCraft 的决策记录

这个目录属于 WordCraft 这一支 craft 插件。

- `craft-0001` … `craft-0012` 与 `craft-CONTEXT.md`：整族共用，与其余 craft 插件逐字节相同，
  由 `tests/craft-docs.test.mjs` 守护。
- `0006-payload-pin.md`（本应用特有）：曾经钉住的上游 zip 与摘要；「首次打开再下载、由回环 hub 发文件」
  那条链路已被 `craft-0011` 取代。现在站点仍然来自上游的包，但下载发生在打包时，见 `craft-0012`。
- 想看「站点从哪来」，读 `craft-0012-the-site-is-upstreams-release-bundle.md`；
  想看「为什么不是自研内核」，读 `craft-0001` 与 `craft-0011`。
