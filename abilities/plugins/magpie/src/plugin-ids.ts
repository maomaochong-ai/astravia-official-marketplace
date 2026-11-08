/** 工作区视图 id：路由为 /workspace/magpie/gateway。 */
export const VIEW_ID = "gateway";

/**
 * 写入宿主模型注册表时使用的 owned provider id。
 * 宿主会把它命名空间化到本插件，因此不必与上游任何名字对齐，但改名会丢掉用户已经接好的那条配置。
 */
export const PROVIDER_ID = "magpie";

/** 内置模型在 Astravia 模型选择器里的显示名（用户可以自行改名，发布时优先保留用户的改动）。 */
export const PROVIDER_DISPLAY_NAME = "Magpie";

export const TOOL_STATUS = "magpie_status";
export const TOOL_MODELS = "magpie_models";
