/**
 * ocr CLI 依赖（宿主托管）：声明侧的 id 常量 + 运行时桥 + 安装进度播报。
 *
 * 安装不是本插件自己动手：宿主读取 `plugin.json#providers.cli` 的声明，在插件启用后
 * 按「探测 → 安装 → 复探 → 就绪」推进，每一步都把 PluginCliProviderStatus（含安装输出）
 * 广播给插件与宿主 UI。这里只做三件事：把 provider id 收在一处、把阶段翻译成人话、
 * 把状态订阅包成面板可用的桥——工具与面板共用同一份文案，避免两处漂移。
 */

import type {
	Disposable,
	PluginCliProviderPhase,
	PluginCliProviderStatus,
	PluginContext,
} from "@astravia-org/plugin-sdk";

/** 必须与 `plugin.json#providers.cli[0].id` 一致。 */
export const OCR_PROVIDER_ID = "ocr";

/** 宿主自动安装时用的 npm 包（与 `plugin.json#providers.cli[0].install.args` 一致）。 */
export const OCR_INSTALL_PACKAGE = "@alibaba-group/open-code-review@latest";

/** 自动安装失败时的离线兜底（README / 详情页 / 工具报错共用一句话）。 */
export const OCR_MANUAL_INSTALL = `npm i -g ${OCR_INSTALL_PACKAGE}`;

/** 阶段 → 面板状态条文案。用 Record 而不是 switch：宿主以后新增阶段会直接编译报错。 */
const PHASE_LABEL: Record<PluginCliProviderPhase, string> = {
	disabled: "ocr 未启用",
	checking: "正在检测 ocr CLI…",
	installing: "正在自动安装 ocr CLI（npm 全局包，约 53 MB）…",
	verifying: "安装完成，正在校验 ocr…",
	ready: "ocr CLI 就绪",
	failed: "ocr CLI 不可用",
};

export function phaseLabel(phase: PluginCliProviderPhase): string {
	return PHASE_LABEL[phase];
}

/** 探测中 / 安装中 / 校验中：这三个阶段面板要显示进度、工具要提示「稍后重试」。 */
export function isProviderBusy(phase: PluginCliProviderPhase): boolean {
	return phase === "checking" || phase === "installing" || phase === "verifying";
}

/**
 * 安装日志（或探测输出）的尾部若干行——npm/npx 的输出可以很长，
 * 面板的 <pre> 与工具报错都只需要末尾那几行。
 */
export function outputTail(recentOutput: string, maxLines = 8, maxChars = 1200): string {
	const lines = recentOutput.trimEnd().split("\n").filter((line) => line.trim() !== "");
	const tail = lines.slice(-maxLines).join("\n");
	return tail.length > maxChars ? tail.slice(tail.length - maxChars) : tail;
}

/** 面板消费的最小接口：读快照、订阅变化、手动重试。 */
export interface OcrProviderBridge {
	getStatus(): Promise<PluginCliProviderStatus>;
	onStatusChanged(listener: (status: PluginCliProviderStatus) => void): Disposable;
	retry(): Promise<void>;
}

export function createOcrProviderBridge(ctx: PluginContext): OcrProviderBridge {
	return {
		getStatus: () => ctx.cliProviders.getStatus(OCR_PROVIDER_ID),
		onStatusChanged: (listener) =>
			ctx.cliProviders.onStatusChanged((status) => {
				if (status.providerId === OCR_PROVIDER_ID) listener(status);
			}),
		retry: () => ctx.cliProviders.retry(OCR_PROVIDER_ID),
	};
}

/**
 * 安装进度播报：面板没打开时用户也该知道「在装」和「装失败」。
 *
 * 只在「进入 installing / failed」以及「播报过的流程最终就绪」时提示：
 * 每次启动本来就会走一遍 checking → ready，那属于正常探测，不该弹 toast。
 */
export function watchOcrProvider(ctx: PluginContext): Disposable {
	let announced = false;
	let previous: PluginCliProviderPhase | null = null;
	return ctx.cliProviders.onStatusChanged((status) => {
		if (status.providerId !== OCR_PROVIDER_ID) return;
		if (status.phase === previous) return;
		previous = status.phase;

		if (status.phase === "installing") {
			announced = true;
			ctx.ui.notify({
				message: `首次使用需要 ocr CLI，正在自动安装 ${OCR_INSTALL_PACKAGE}（约 53 MB）。进度可随时在「审查」面板查看。`,
				variant: "info",
				durationMs: 8000,
			});
			return;
		}
		if (status.phase === "failed") {
			announced = true;
			ctx.ui.notify({
				message: `ocr CLI 安装失败：${status.message || outputTail(status.recentOutput, 3) || "原因未知"}。可在「审查」面板点「重试安装」。`,
				variant: "error",
				error: status.message ?? outputTail(status.recentOutput, 6),
			});
			return;
		}
		if (status.phase === "ready" && announced) {
			announced = false;
			ctx.ui.notify({ message: "ocr CLI 安装完成，现在可以审查改动了。", variant: "success" });
		}
	});
}
