# 元素骨架与场景数据

这份文档只记上游的既有事实，每条都给出源码位置。插件没有自己的元素模型。

## 骨架 → 元素

`excalidraw_scene` 的 `apply` 把 `elements` 交给上游的 `convertToExcalidrawElements`
（`packages/element/src/transform.ts:680`）。签名：

```ts
convertToExcalidrawElements(
  elements: ExcalidrawElementSkeleton[] | null,
  opts?: { regenerateIds?: boolean; renderEnvironment?: RenderEnvironment },
): ExcalidrawElement[]
```

- `regenerateIds` 默认 `true`（`transform.ts:699`）：每个元素的 `id` 换成新的，`created` 也刷新。
  批内 `start.id`/`end.id` 仍能解析，因为 transform 内部维护 `oldToNewElementIdMap`（`transform.ts:690`）。
- 本插件在 `mode: "insert"` 时传 `regenerateIds: false`，好让新元素引用画布上**已有**元素的 id。

各类型的必需字段（`dev-docs/docs/@excalidraw/excalidraw/api/excalidraw-element-skeleton.mdx`）：

| 类型 | 必需 | 说明 |
| --- | --- | --- |
| `rectangle` / `ellipse` / `diamond` | `type`,`x`,`y` | 宽高缺省用 `DEFAULT_DIMENSION`（`transform.ts:707-714`） |
| `text` | `type`,`x`,`y`,`text` | 宽高由 `measureText` 算（`transform.ts:753-773`）；手填会被覆盖 |
| `line` / `arrow` | `type`,`x`,`y` | `points` 自动补成 `[(0,0),(w,h)]`（`transform.ts:723-751`）；箭头默认 `endArrowhead: "arrow"` |
| 任意容器 + `label` | `label.text` | 未给尺寸时按 label 反推（`transform.ts:707-714`） |
| `frame` | `type`,`children[]` | `children` 是元素 id |
| `stickynote` | `type`,`x`,`y` | 默认 250×250，必有底色，最小 75×75 |

容器 label 的可选键：`textAlign`（`left`/`center`/`right`）、`verticalAlign`（`top`/`middle`）、`fontSize`、
`strokeColor`、`fontFamily`。

箭头绑定的两种写法（同一份文档）：

```json
{ "type": "arrow", "x": 200, "y": 40, "start": { "id": "box-1" }, "end": { "id": "box-2" } }
```

```json
{ "type": "arrow", "x": 200, "y": 40, "start": { "type": "rectangle" }, "end": { "type": "ellipse" } }
```

第二种由上游按箭头位置去找形状；第一种要求被引用元素带 `id` 且在同一批（或已在画布上）。

## 完整元素 → 元素

`skeleton: false` 走 `restoreElements`（`packages/excalidraw/data/restore.ts`）：补齐缺省值、迁移旧版本字段，
但**不计算文字尺寸**——文字元素必须自带 `width`/`height`，否则拿到 0 尺寸。

最小可用元素（无 `id`/`seed`/`version`/`index` 也能恢复）形如：

```json
{ "type": "rectangle", "x": 0, "y": 0, "width": 180, "height": 90 }
```

## `read` 的输出

桥把每个元素过一遍 `compactElement`（`src/bridge/host-bridge.js`）：

- 去掉 `seed`、`version`、`versionNonce`、`updated`、`index`；
- `x`/`y`/`width`/`height`/`angle` 保留一位小数；
- 单次最多 300 个元素，超出时 `truncated: true`。

`appState` 只带四个字段：`theme`、`zoom`、`viewBackgroundColor`、`gridSize`。

## `.excalidraw` 文件

`serializeAsJSON`（`packages/excalidraw/data/json.ts:52-72`）：

```json
{
  "type": "excalidraw",
  "version": 2,
  "source": "<导出地址>",
  "elements": [],
  "appState": {},
  "files": {}
}
```

常量来源：`EXPORT_DATA_TYPES.excalidraw = "excalidraw"`（`packages/common/src/constants.ts:348`）、
`VERSIONS.excalidraw = 2`（`constants.ts:420`）、MIME `application/vnd.excalidraw+json`（`constants.ts:316`）。

导出的 `appState` 是 `cleanAppStateForExport` 的结果，不是全部 app state。
