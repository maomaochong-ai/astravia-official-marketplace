# 这个应用是一个 payload 钉子

七个 craft 插件的宿主侧代码逐字节相同（[0001](../craft/0001-seven-copies-and-a-parity-test.md)）。
那为什么不是**一个**插件、里面选应用？

因为插件身份是宿主的安装单位：`plugin.json` 的 id、权限、服务运行时、活动标签槽位、
技能包都挂在它下面。一个插件装六个应用会得到六份 payload、六个服务、六个标签，
却只有一套权限和一次安装——用户没法只装 DesignCraft。

所以边界是：**一个上游应用 = 一个插件**，差异全部收在四个文件里
（`src/app.config.ts`、`plugin.json`、`payload/manifest.json`、展示层），宿主侧代码跟着家族走。

## 这个钉子具体钉了什么

```json
{ "version": "0.16.0", "sha256": "1e74074b…", "app": { "id": "designcraft", "name": "DesignCraft",
  "envPrefix": "DESIGNCRAFT", "sizeLabel": "26 MB", "locale": null } }
```

- `sha256` 是唯一信任锚：下载来的包对不上就拒绝使用，不会"先跑起来再说"。
- `app.locale` 为空意味着 hub 不注入语言种子——这个构建没有可用的中文（见
  [0007](../craft/0007-chinese-comes-from-the-shell.md)）。
- `envPrefix` 是 hub 给这个应用的环境变量前缀，七支之间不能撞。

## 它与其他六支的真实差异

只有三处，且都不在共享代码里：

1. **payload**：版本、字节、大小、下载源。
2. **references**：随包发布的上游文档集合不同（这一支是 `getting-started/`、`guides/`、`faq/`、
   `troubleshooting/` 四组，偏用户向）。
3. **界面行为的上游实现**：DesignCraft 是唯一有 IDML 导入的一支；它的导出对话框有三档
   （PDF / PNG / EPUB），其他几支没有。

## 证据

- Observed：`payload/manifest.json` 与 `README.md` 里的版本、大小、sha256 一致；
  `node --test tests/craft-manifest.test.mjs` 校验清单与 sha256 对齐。
- Inferred：上游 0.16.0 之后如果改了 DOM 结构或事件字段名，合成手势可能失效；
  验证路径是 `capture_canvas` → `click` → `capture_canvas` 看画面有没有变。
