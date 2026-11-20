import { TOOL_IDS } from "./ids";

/**
 * 工具表的可见性闸门。
 *
 * 32 个工具全部声明 `scope_use: ["conversation","project"]`，两个主场景都命中，
 * 于是每一轮请求都带 56 KB schema。这里把「日常问答会用到」与「只有进实验室才成立」
 * 分开：后者由 kernel 系统提示块按 lab 状态调用 `setToolEnabled` 打开或关上。
 *
 * 分界不是按大小，是按**失手的代价**：`run_radare` / `decompile_*` / `frida_dump`
 * 被误选时会启动外部进程或对着不该碰的目标跑；`install_*` 会改用户机器。
 * 在 lab 关闭的对话里，这些调用没有一次是对的。
 */
export const CORE_TOOL_IDS: readonly string[] = [
	// 看一眼样本，不做深层分析
	"triage_binary",
	"scan_binary_strings",
	// 读随包文档与先例
	"search_docs",
	"read_doc",
	"search_cases",
	// 环境自检与准备：装不上工具的人不该被闸门挡住
	"probe_environment",
	"install_toolchain",
	// 案例记账：scope 与证据条目是最先要写的东西
	"init_task",
	"record_case_note",
	// 注入计划：装契约与装工具链一样，是「先把环境弄对」，与是否实验无关
	"inject_target",
];

const CORE = new Set(CORE_TOOL_IDS);

/** 其余工具只在 lab 开启时出现。顺序沿用 `TOOL_IDS`，便于与自检页对账。 */
export const LAB_ONLY_TOOL_IDS: readonly string[] = TOOL_IDS.filter(id => !CORE.has(id));
