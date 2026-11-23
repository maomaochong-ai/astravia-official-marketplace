/**
 * 右键菜单：从文件树直接把一个目标交给 REA。
 *
 * 承接上游的「就地开始调查」能力，但只做发起，不做分析：案件由 Agent 用
 * `case_open` 建立，提示词里带上路径与目标类型，并明确要求它在容器/安装包
 * 这类必须先挂载或解包的目标上先说明需要什么，而不是猜测内容。
 *
 * 两份贡献而不是一份：宿主按单一 `resourceType` 匹配，macOS 的 `.app` 在文件树
 * 里是目录，只写 `file` 会永远匹配不到它。
 */
import type { PluginContext, PluginFileExplorerContextMenuContribution } from "@astravia-org/plugin-sdk";
import { reportError } from "../plugin-context";

/** 文件型目标：桌面应用组件、原生与运行时产物、移动包、模型与抓包。 */
export const FILE_TARGET_EXTENSIONS = [
	"app",
	"exe",
	"dll",
	"dylib",
	"so",
	"node",
	"asar",
	"elf",
	"bin",
	"sys",
	"efi",
	"ko",
	"macho",
	"pyc",
	"dex",
	"jar",
	"class",
	"apk",
	"aab",
	"xapk",
	"apks",
	"ipa",
	"pck",
	"unity3d",
	"gguf",
	"safetensors",
	"cubin",
	"ptx",
	"wasm",
	"har",
	"saz",
	"pcap",
	"pcapng",
	"ips",
	"sqlite3",
	"dmg",
	"pkg",
	"msi",
	"crx",
	"xpi",
];

/** 目录型目标：macOS 的应用包与其扩展。 */
export const DIRECTORY_TARGET_EXTENSIONS = ["app", "framework", "appex", "xpc"];

export function createInvestigateActions(ctx: PluginContext): PluginFileExplorerContextMenuContribution[] {
	const start = async (target: string, isDirectory: boolean): Promise<void> => {
		const prompt = ctx.i18n.t("action.investigate.prompt", {
			path: target,
			kind: ctx.i18n.t(isDirectory ? "action.investigate.directory" : "action.investigate.file"),
		});
		try {
			try {
				await ctx.conversation.sendPrompt(prompt);
			} catch {
				// 没有活跃会话：在目标旁边开一个再发一次。
				const separator = Math.max(target.lastIndexOf("/"), target.lastIndexOf("\\"));
				const directory = isDirectory ? target : target.slice(0, separator);
				await ctx.conversation.createSession(directory || ".");
				await ctx.conversation.sendPrompt(prompt);
			}
		} catch (error) {
			reportError(ctx.i18n.t("action.investigate.failed"), error);
		}
	};

	return [
		{
			id: "investigate-with-rea",
			label: "%action.investigate%",
			order: 90,
			when: { resourceType: "file", extensions: FILE_TARGET_EXTENSIONS },
			run: ({ entry }) => start(entry.path, false),
		},
		{
			id: "investigate-with-rea-directory",
			label: "%action.investigate%",
			order: 90,
			when: { resourceType: "directory", extensions: DIRECTORY_TARGET_EXTENSIONS },
			run: ({ entry }) => start(entry.path, true),
		},
	];
}
