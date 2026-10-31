/**
 * 两个宿主的挂载点 id，单独成文件只为了打断循环导入。
 *
 * 标签与整页互相引用（整页里要回到标签，标签里要放大到整页），而两边的组件树又都
 * 汇聚到 `WorkbenchSurface`。把常量放进这个不 import 任何东西的叶子模块，`studio-tab`
 * 与 `studio-view` 就都能直接取到，不必经由对方。
 */
export const STUDIO_TAB_ID = "studio";

/** 整页视图 id：宿主的 `/workspace/<pluginId>/<viewId>` 路由用它。 */
export const STUDIO_VIEW_ID = "workbench";
