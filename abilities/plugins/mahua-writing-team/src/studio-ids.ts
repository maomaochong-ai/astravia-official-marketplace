/**
 * 工作台在宿主里的挂载点 id。
 *
 * 只有一处：活动面板里的一张标签页（`STUDIO_TAB_ID`）。从前还有第二个注册——一个工作区视图，
 * 用来把界面搬到整页路由上；那个位置的侧栏仍会列出「麻花小说网」，而它又做不到「只有插件」，
 * 于是既多余又做不到。现在「变大」由界面自己的全屏键完成，常量只剩一个，也就不必再单列两个
 * 常量去区分命名空间。
 *
 * 单独成文件只为了把它放在叶子模块里：注册处与界面都要读，谁也别 import 谁。
 */
export const STUDIO_TAB_ID = "studio";

/**
 * 插件 id，与 `plugin.json` 的 `id` 逐字一致。
 *
 * 只在一个地方用到：全屏时把界面 `createPortal` 到 `body`，得在那里自己再挂一层
 * `[data-astravia-plugin-root]` —— 插件 CSS 被编译进 `@scope ([data-astravia-plugin-root=<id>])`，
 * 搬出宿主挂载点之后不补这一层样式就全丢。不写常量就得去 DOM 里猜自己属于哪个作用域。
 */
export const STUDIO_PLUGIN_ID = "mahua-writing-team";
