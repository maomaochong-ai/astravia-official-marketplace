# vendor/chart.umd.js

Chart.js v4.4.1 官方 UMD 构建，按原样存放，供导出/预览时内联进 BI 产物 HTML。

| 项 | 值 |
| --- | --- |
| 版本 | 4.4.1 |
| 来源 | `https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.js` |
| npm 制品 | `chart.js@4.4.1`（tarball integrity `sha512-C74QN1bxwV1v2PEujhmKjOZ7iUM4w6BWs23Md/6aOZZSlwMzeCIDGuZay++rBgChYru7/+QFeoQW0fQoP534Dg==`） |
| sha256 | `74401d738dd3e03ee5dfb3b6841210fe2c4ead8a960c4011ca4ba0b78a9fd8f3` |
| 许可 | MIT（见文件头 banner） |

## 为什么内联而不是引用 CDN

看板/大屏产物 HTML 是用户拿走使用的独立文件。只要它引用 CDN，离线、内网或 CDN 不可达时
`Chart` 未定义，产物里唯一的 `<script>` 会在第一行抛错，所有画布保持空白（且没有任何报错提示）。
因此消费端（下载 / 外部打开 / iframe 预览）统一用 `shared/utils/chart-runtime.ts`
把 CDN 引用替换成这份内联库。

## 为什么把文件放进仓库

不是 npm 依赖读取：`chart.js` 的 `exports` 映射不开放 `./dist/chart.umd.js` 子路径导入；
本仓库的 `@astravia-org/*` 依赖走 `.tooling` 本地 `file:` 链接，改依赖树会牵连锁文件。
文件头部的版本 banner 是 `src/test/chart-runtime.test.js` 的内联断言依据。

## 升级步骤

1. 取新版 `https://cdn.jsdelivr.net/npm/chart.js@<ver>/dist/chart.umd.js`
2. 与 npm 制品逐字节比对：`npm pack chart.js@<ver>` → 解包 → `shasum -a 256 package/dist/chart.umd.js`
3. 覆盖本目录的 `chart.umd.js`，同步更新上表版本号与 sha256
4. 更新 `src/test/chart-runtime.test.js` 里的版本 banner 断言，跑 `npm test`
5. 跑 `node --import ./src/test/support/dom-setup.mjs scripts/verify-chart-render.mjs` 确认产物真能渲染
