/**
 * 工作台在宿主里的两个挂载点 id。
 *
 * 同一张界面注册两次形态，各自占一个宿主位置：
 * - `STUDIO_TAB_ID`：活动面板里的一张标签页（窄，跟着对话）；
 * - `STUDIO_VIEW_ID`：一个 `sidebar: false` 的工作区视图（宽，占据主内容区）。
 *
 * 两者是彼此的目的地，不是两种实现：放大 = 打开视图，收回 = 打开标签页。
 * `sidebar: false` 是有意的——它让视图不出现在侧栏列表里（那只入口的 tooltip 走
 * `pluginName`，宿主不解析 `%…%`），入口只由工作台自己的按钮打开。
 *
 * 常量单独成文件，只为了把它放在叶子模块里：注册处与按钮都要读，谁也别 import 谁。
 */
export const STUDIO_TAB_ID = "studio";

export const STUDIO_VIEW_ID = "studio";
