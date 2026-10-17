/**
 * REA 工具名 → 工作流阶段 / 目标类型的映射。
 *
 * 数据来源：rea-agents 的 `src/contracts/toolEffects.ts`（REA_TOOL_NAMES 逐字抄录），
 * 以及 `data/stages.ts` 的 6 个阶段顺序（connect → route → summary → plan → read → finish）。
 *
 * 这里只做"看名字猜阶段"，不做任何真实性断言：分类为 undefined 时界面显示"未归类"，
 * 不阻塞、不报错。Agent 侧仍以 REA 自己的 workflow 状态为准。
 */

import type { TargetKind } from "../data/targets";

/** data/stages.ts 里 6 个阶段的稳定 id（与 STAGES 数组顺序一一对应）。 */
export type ReaStageId = "connect" | "route" | "summary" | "plan" | "read" | "finish";

export const STAGE_ORDER: readonly ReaStageId[] = ["connect", "route", "summary", "plan", "read", "finish"];

export const STAGE_INDEX: Readonly<Record<ReaStageId, number>> = {
	connect: 1,
	route: 2,
	summary: 3,
	plan: 4,
	read: 5,
	finish: 6,
};

/** stage.index（1 起）→ 阶段 id；越界返回 null。 */
export function stageIdForIndex(index: number): ReaStageId | null {
	return STAGE_ORDER[index - 1] ?? null;
}

/** 阶段 id → stage.index（1 起）。 */
export function indexForStageId(id: ReaStageId): number {
	return STAGE_INDEX[id];
}

/**
 * REA 官方工具名清单（207 个）。用于把 host 暴露的 `mcp_<server>_<tool>` 还原成真实工具名。
 * 抄自 rea-agents `src/contracts/toolEffects.ts` 的 TOOL_EFFECTS 键。
 */
const REA_TOOL_NAMES: readonly string[] = `
	list_cutter_sessions cutter_command inspect_with_objdump start_gdb_session gdb_console gdb_session_status start_rizin_debug_session rizin_debug_command
	rizin_debug_session_status close_rizin_debug_session close_gdb_session execute_rizin_command inspect_go_binary inspect_rust_binary inspect_sqlite_database inspect_packet_fields
	inspect_packet_capture inspect_signal_decoders decode_signal_recording inspect_wasm_artifact inspect_evm_interface inspect_web_network_capture observe_web_execution inspect_web_event_listeners
	trace_web_source_location trace_web_module_imports inspect_recorded_crash inspect_binary_layout list_frida_devices list_frida_processes start_frida_session load_frida_script
	resume_frida_session unload_frida_script frida_session_status close_frida_session instrument_with_frida inspect_pe_resources inspect_analysis_view inspect_firmware_regions
	extract_firmware inspect_android_package inspect_pcap_client inspect_pcap_capture identify_flutter_build inspect_dart_aot inspect_apktool_client decode_android_resources
	inspect_jeb_client open_jeb_project list_jeb_units decompile_jeb_item inspect_adb_client list_adb_devices inspect_adb_device list_adb_packages
	pull_adb_package read_adb_logcat inspect_adb_package pull_adb_file push_adb_file capture_adb_screen list_adb_processes list_adb_directory
	list_adb_features list_adb_services inspect_adb_display inspect_adb_window read_adb_setting collect_adb_bugreport resolve_adb_packages install_adb_package
	uninstall_adb_package start_adb_app start_adb_activity stop_adb_app search_android_classes inspect_android_class inspect_android_method trace_android_references
	annotate_native_function inspect_native_load_image inspect_native_dispatch_metadata trace_native_ui_action trace_native_values address_name comment current_address
	current_procedure current_document goto_address inline_comment list_bookmarks list_documents list_names list_procedures
	list_segments list_strings next_address prev_address procedure_address procedure_assembly procedure_callees procedure_callers
	procedure_info read_function_instructions inspect_native_instruction inspect_native_data_type resolve_native_call_targets read_bytes search_bytes address_to_file_offset
	procedure_references procedure_pseudo_code resolve_containing_procedure search_procedures search_strings set_address_name set_addresses_names set_bookmark
	set_comment set_inline_comment unset_bookmark xrefs get_objc_classes get_objc_protocols batch_decompile get_call_graph
	analyze_swift_types find_xrefs_to_name binary_overview analyze_function inspect_native_api trace_feature trace_call_path observe_native_ui
	capture_native_ui_scenario observe_native_calls inspect_macho inspect_signature inspect_plist list_architectures demangle_swift inspect_artifact
	extract_artifact decode_interface_builder inspect_asset_catalog inspect_keyed_archive trace_dylib_resolution inspect_managed_artifact inspect_managed_members inspect_managed_native_boundaries
	compare_managed_members verify_managed_native_boundaries import_managed_reconstruction project_managed_application_graph list_browser_targets inspect_web_page analyze_web_bundle observe_web_session
	discover_webmcp_tools compare_web_captures capture_web_screenshot compare_web_screenshots capture_browser_scenario list_electron_targets inspect_electron_page capture_electron_scenario
	list_javascript_runtime_targets observe_javascript_runtime analyze_javascript_application inspect_electron_fuses export_web_scripts reconcile_javascript_runtime recover_javascript_sources trace_application_feature
	trace_javascript_semantics compare_application_versions compare_source_to_bundle compare_javascript_export_shapes build_reconstruction_obligation_ledger evaluate_reconstruction_coverage project_android_application_graph project_apple_application_graph
	project_harmony_application_graph open_binary close_binary binary_session export_evidence_bundle get_evidence_bundle get_navigation_context inspect_address_context
	import_evidence_bundle capture_process_scenario compare_process_captures compare_artifacts compare_wasm_interfaces compare_functions compare_bundles find_changed_behavior
	build_call_path correlate_static_and_runtime verify_reconstruction list_unknowns record_unknown update_unknown verify_unknown_resolution
`
	.trim()
	.split(/\s+/);

const TOOL_NAME_SET: ReadonlySet<string> = new Set(REA_TOOL_NAMES);

export function isKnownReaTool(name: string): boolean {
	return TOOL_NAME_SET.has(name);
}

export function reaToolNames(): readonly string[] {
	return REA_TOOL_NAMES;
}

/**
 * host 暴露给模型的 MCP 工具名形如 `mcp_plugin-rea-rea_open_binary`。
 * 还原成 REA 自己的工具名，未知工具原样返回。
 */
export function normalizeToolName(raw: string): string {
	if (TOOL_NAME_SET.has(raw)) return raw;
	let name = raw;
	const prefixed = raw.startsWith("mcp_") || raw.startsWith("plugin-") || raw.startsWith("plugin_");
	if (name.startsWith("mcp_")) name = name.slice(4);
	if (TOOL_NAME_SET.has(name)) return name;
	const serverScoped = /^plugin[-_][a-z0-9-]+?[-_][a-z0-9-]+?_(.+)$/.exec(name);
	if (serverScoped?.[1] && TOOL_NAME_SET.has(serverScoped[1])) return serverScoped[1];
	if (prefixed) {
		// 兜底：逐段剥掉前缀，直到命中已知工具名。
		let rest = name;
		while (rest.includes("_")) {
			rest = rest.slice(rest.indexOf("_") + 1);
			if (TOOL_NAME_SET.has(rest)) return rest;
		}
	}
	return name;
}

/**
 * Apple 平台上与类型无关的工具：macOS 应用包和 iOS App 都会用到它们，
 * 目标类型应由被打开的那个制品决定，轮不到工具名裁定。
 * 不单独排除的话，`inspect_plist` 会把已经打开的 macOS 应用从 native 改判成 mobile。
 */
const APPLE_AGNOSTIC_TOOLS: ReadonlySet<string> = new Set([
	"inspect_macho",
	"inspect_signature",
	"inspect_plist",
	"inspect_keyed_archive",
	"inspect_asset_catalog",
	"decode_interface_builder",
	"trace_dylib_resolution",
	"get_objc_classes",
	"get_objc_protocols",
	"analyze_swift_types",
	"demangle_swift",
	"project_apple_application_graph",
]);

/** 目标类型识别用：工具名 → 目标类型（同一工具只归一个类型）。 */
export const TARGET_TOOLS: Readonly<Record<string, TargetKind>> = {
	// JavaScript / Electron
	analyze_javascript_application: "javascript",
	list_javascript_runtime_targets: "javascript",
	observe_javascript_runtime: "javascript",
	reconcile_javascript_runtime: "javascript",
	trace_javascript_semantics: "javascript",
	recover_javascript_sources: "javascript",
	export_web_scripts: "javascript",
	compare_source_to_bundle: "javascript",
	compare_javascript_export_shapes: "javascript",
	analyze_web_bundle: "javascript",
	list_electron_targets: "javascript",
	inspect_electron_page: "javascript",
	inspect_electron_fuses: "javascript",
	capture_electron_scenario: "javascript",
	// .NET / managed
	inspect_managed_artifact: "dotnet",
	inspect_managed_members: "dotnet",
	compare_managed_members: "dotnet",
	import_managed_reconstruction: "dotnet",
	project_managed_application_graph: "dotnet",
	// Native
	inspect_go_binary: "native",
	inspect_rust_binary: "native",
	inspect_binary_layout: "native",
	inspect_artifact: "native",
	extract_artifact: "native",
	binary_overview: "native",
	open_binary: "native",
	inspect_sqlite_database: "native",
	inspect_wasm_artifact: "native",
	inspect_evm_interface: "native",
	inspect_pe_resources: "native",
	// Firmware
	inspect_firmware_regions: "firmware",
	extract_firmware: "firmware",
	inspect_packet_capture: "firmware",
	inspect_packet_fields: "firmware",
	inspect_signal_decoders: "firmware",
	decode_signal_recording: "firmware",
	inspect_pcap_client: "firmware",
	inspect_pcap_capture: "firmware",
	// Web / network
	list_browser_targets: "web",
	inspect_web_page: "web",
	observe_web_session: "web",
	observe_web_execution: "web",
	inspect_web_event_listeners: "web",
	inspect_web_network_capture: "web",
	trace_web_source_location: "web",
	trace_web_module_imports: "web",
	discover_webmcp_tools: "web",
	compare_web_captures: "web",
	capture_browser_scenario: "web",
	// Mobile / Apple / Android
	inspect_android_package: "mobile",
	inspect_adb_device: "mobile",
	list_adb_devices: "mobile",
	inspect_apktool_client: "mobile",
	decode_android_resources: "mobile",
	inspect_jeb_client: "mobile",
	open_jeb_project: "mobile",
	identify_flutter_build: "mobile",
	inspect_dart_aot: "mobile",
	project_android_application_graph: "mobile",
	project_harmony_application_graph: "mobile",
	inspect_macho: "mobile",
	inspect_signature: "mobile",
	inspect_plist: "mobile",
	inspect_keyed_archive: "mobile",
	inspect_asset_catalog: "mobile",
	decode_interface_builder: "mobile",
	trace_dylib_resolution: "mobile",
	get_objc_classes: "mobile",
	get_objc_protocols: "mobile",
	analyze_swift_types: "mobile",
	demangle_swift: "mobile",
	project_apple_application_graph: "mobile",
};

/**
 * 工具名兜底规则（按序首个命中生效）。仅用于 TARGET_TOOLS 未覆盖的工具。
 * 顺序有意义：javascript 必须排在 web 之前，避免 `analyze_web_bundle` 被判成 web。
 */
const TARGET_RULES: readonly { readonly test: RegExp; readonly kind: TargetKind }[] = [
	{ test: /firmware|packet|signal|pcap|binwalk/, kind: "firmware" },
	{
		test: /android|adb_|apktool|jeb|dart|flutter|harmony/,
		kind: "mobile",
	},
	{ test: /managed/, kind: "dotnet" },
	{ test: /javascript|electron|web_bundle|web_scripts/, kind: "javascript" },
	{ test: /^web_|webmcp|browser|_web_/, kind: "web" },
];

/** 从工具名推断目标类型；无法判断返回 null。 */
export function detectTargetFromTool(toolName: string): TargetKind | null {
	if (APPLE_AGNOSTIC_TOOLS.has(toolName)) return null;
	const exact = TARGET_TOOLS[toolName];
	if (exact) return exact;
	for (const rule of TARGET_RULES) {
		if (rule.test.test(toolName)) return rule.kind;
	}
	return null;
}

const EXTENSION_KINDS: readonly { readonly test: RegExp; readonly kind: TargetKind }[] = [
	{ test: /\.(dll|exe|winmd)$/i, kind: "dotnet" },
	{ test: /\.(apk|aab|dex|ipa|hap)$/i, kind: "mobile" },
	// .app 两边都可能是：macOS 应用包（/Applications/Foo.app）和 iOS 解包后的
	// Payload/Foo.app。后面那种由 detectTargetFromText 的前置规则拦住，
	// 其余一律当原生二进制 —— 这正是 Hopper / Ghidra 接手的对象。
	{ test: /\.app$/i, kind: "native" },
	{ test: /\.(bin|elf|so|dylib|img|rom|fw)$/i, kind: "native" },
	{ test: /\.(js|mjs|cjs|asar|jsx|ts)$/i, kind: "javascript" },
	{ test: /^https?:\/\//i, kind: "web" },
];

/** 从参数里的路径/URL 推断目标类型（第二来源，工具名判断不出来时用）。 */
export function detectTargetFromText(text: string | null | undefined): TargetKind | null {
	if (!text) return null;
	if (/index\.android\.bundle/i.test(text)) return "mobile";
	// iOS 解包目录里的 .app 属于移动端，不是 macOS 应用包。
	if (/\/Payload\/[^/]+\.app/i.test(text)) return "mobile";
	for (const rule of EXTENSION_KINDS) {
		if (rule.test.test(text)) return rule.kind;
	}
	return null;
}

/** `project_*_application_graph` 属于重建计划，不是"目标入口"，从 route 阶段排除。 */
const GRAPH_PROJECTION = /^project_.*_application_graph$/;

const CONNECT_RULES: readonly RegExp[] = [
	/^(open_binary|close_binary|binary_session|get_navigation_context)$/,
	/^(start|close|resume|load|unload)_.*(session|script)$/,
	/^list_.*_devices$/,
	/^(gdb|rizin|frida|cutter|adb|apktool|jeb)_.*_status$/,
	/^list_.*_(sessions|units|targets|packages|processes|documents)$/,
	/^open_jeb_project$/,
];

const PLAN_RULES: readonly RegExp[] = [
	/^project_.*_application_graph$/,
	/^build_reconstruction_obligation_ledger$/,
	/^import_managed_reconstruction$/,
];

const FINISH_RULES: readonly RegExp[] = [
	/^(verify_|list_unknowns$|record_unknown$|update_unknown$|verify_unknown_resolution$)/,
	/^(evaluate_reconstruction_coverage|export_evidence_bundle|get_evidence_bundle|import_evidence_bundle)$/,
	/^(correlate_static_and_runtime|find_changed_behavior)$/,
];

const READ_RULES: readonly RegExp[] = [
	/^(analyze_|decompile|inspect_|read_|search_|trace_|observe_|capture_|list_|get_|compare_|discover_|demangle_|decode_|extract_|export_|resolve_)/,
	/^(batch_decompile|binary_overview|address_to_file_offset|read_bytes|search_bytes|get_call_graph|build_call_path|find_xrefs_to_name|find_changed_behavior)$/,
	/^(xrefs|comment|inline_comment|current_address|current_procedure|current_document|address_name|goto_address)$/,
	/^(next_address|prev_address|procedure_|set_|unset_|annotate_|instrument_|load_|unload_|resume_)/,
	/^(gdb_console|cutter_command|execute_rizin_command|rizin_debug_command|inspect_with_objdump)$/,
];

export interface ToolClassification {
	/** 已从 mcp_<server>_<tool> 还原的 REA 工具名。 */
	readonly name: string;
	readonly stage: ReaStageId | null;
	readonly targets: readonly TargetKind[];
}

/** 工具名 → 阶段。summary 阶段没有对应工具，永远返回 null。 */
export function detectStageFromTool(toolName: string): ReaStageId | null {
	for (const rule of CONNECT_RULES) {
		if (rule.test(toolName)) return "connect";
	}
	if (TARGET_TOOLS[toolName] && !GRAPH_PROJECTION.test(toolName)) return "route";
	for (const rule of PLAN_RULES) {
		if (rule.test(toolName)) return "plan";
	}
	for (const rule of FINISH_RULES) {
		if (rule.test(toolName)) return "finish";
	}
	for (const rule of READ_RULES) {
		if (rule.test(toolName)) return "read";
	}
	return null;
}

/** 组合分类：一次算好阶段与目标类型。 */
export function classifyTool(rawName: string): ToolClassification {
	const name = normalizeToolName(rawName);
	const target = detectTargetFromTool(name);
	return {
		name,
		stage: detectStageFromTool(name),
		targets: target ? [target] : [],
	};
}
