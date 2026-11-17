# craft-0032：编辑器等它被打开时再加载

- **状态：** 已接受
- **日期：** 2026-11-17
- **背景：** 十五个 craft 插件（designcraft 为参照，其余十四个共用同一份 `src/**`）安装后宿主启动变慢
- **适用：** designcraft / effectcraft / filmcraft / lightcraft / pdfcraft / vectorcraft / photocraft /
  cadcraft / deckcraft / figcraft / gridcraft / wordcraft / texturecraft / materialcraft / craft-anything

## 问题

宿主的启动流程是「激活全部已装插件」。十五个 craft 插件共用一份外壳，而 `src/index.tsx` 里
`import { CraftTab } from "./features/editor/components/craft-tab.tsx"` 是**静态**导入，于是每个插件
激活时都要下载并执行整棵编辑器子树：

| 项 | 体量 |
|---|---|
| 入口 chunk（含编辑器） | 111.9 KB（gzip 37.4 KB） |
| 其中只在打开 tab 时才需要的部分 | 67 KB（`use-craft-editor` 29.5 KB、`boot-cover` 8.7 KB、`site-document` 7.6 KB 及其 47 KB bridge 源码、`strings`、`open-document`…） |
| 十五份合计 | ≈ 1.65 MB 没人打开过的代码在每次启动时解析 |

配合 `retention: "warm"` 与「`:active` 才唤醒」两条已有约束，真正的问题是**激活期**的成本：
静置时没有任何 canvas，但十五份编辑器已经被解析过一次。

## 决定

`src/index.tsx` 用 `lazy()` + `Suspense` 动态导入编辑器：

```tsx
const CraftTab = lazy(() =>
  import("./features/editor/components/craft-tab.tsx")
    .then((module) => ({ default: module.CraftTab }))
    .catch(() => ({ default: EditorUnavailable })),
);
```

三条附带约束：

1. **fallback 与 tab 同色**（`bg-neutral-950`），加载编辑器时不闪白；
2. **加载失败要能读**：多了一条协议边界，失败时给一块写着应用名的占位，而不是把异常抛给宿主
   （tab 里没有任何东西值得因此白屏）；
3. **只这一处改动**：`src/**` 的其余文件在十五个插件之间仍然逐字节一致，`tests/craft-parity.test.mjs`
   守着这条约束。

## 实测

同一份源码、同一套依赖，`vite build` 前后：

| | 改前 | 改后 |
|---|---|---|
| 入口 chunk | 111.9 KB | 45–46 KB |
| 编辑器 chunk | —（在同一份里） | 65–66 KB（`assets/craft-tab-*.js`，`import()` 按需） |
| 单插件激活下载（remoteEntry 21 + MF runtime 63 + 入口） | 196 KB | 130 KB |
| 十五插件合计激活 | ≈ 2.9 MB | ≈ 1.95 MB |
| 延后到「有人真的打开」 | 0 | ≈ 1.0 MB |

产物核验：15/15 的入口 chunk 里是 `import("./craft-tab-*.js")`，没有静态 `from "./craft-tab-`。

## 已知边界

- **MF runtime 每个插件一份 63 KB**，这是 `@astravia-org/plugin-vite` 的产物形态，插件侧改不掉；
  要压下去得让宿主共享 MF runtime。
- **工具仍在激活期注册**（约 40 KB 源码）：宿主要在下一次请求前拿到工具表，这一半不能延后。
- **首次打开 tab 多一次 chunk 请求**：本地协议、单文件、几十 KB，比启动时十五份一起解析划算。
