/**
 * 工作台在宿主里的两个挂载点 id。
 *
 * 两个，不是三个：
 *
 * - `STUDIO_TAB_ID` — 活动面板里的「麻花小说网」标签页，日常入口；
 * - `STUDIO_VIEW_ID` — 同界面的整页路由，报头「全屏工作台」键的去处。
 *
 * 为什么非要有第二个：宿主的活动面板永远给会话区留 384px（`ACTIVITY_PANEL_MIN_CHAT_AREA`
 * 在 atom 层夹紧，插件传多大都无效），所以「全屏整个工作台」只能落在宿主的整页路由上。
 * 两者共用同一张 `WorkbenchSurface`，只有 `mode` 不同。
 *
 * 单独成文件只为了把它放在叶子模块里：注册处与界面都要读，谁也别 import 谁。
 */
export const STUDIO_TAB_ID = "studio";
export const STUDIO_VIEW_ID = "studio";
