/**
 * 宿主能力的最小类型边界。
 *
 * 这里只声明插件从宿主 SDK 用到的类型，不把画布业务协议写进来。
 */
import type { PluginContext, PluginServiceStatus } from "@astravia-org/plugin-sdk";

export type { PluginContext, PluginServiceStatus };

/** 画布服务在宿主中的标识 */
export const SERVICE_ID = "open-ai-canvas";

/** 插件工作区视图标识 */
export const VIEW_ID = "open-ai-canvas-view";
