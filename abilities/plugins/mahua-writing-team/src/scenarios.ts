/**
 * 工具在哪些会话形态里出现。
 *
 * `conversation` 是普通对话，`project` 是团队协作（Studio 的工作就是后者）。
 * 宿主对缺 `scope_use` 的工具 fail-closed，所以每个注册项都展开这一处常量。
 */
export const SCENARIOS = ["conversation", "project"] as const;
