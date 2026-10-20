import { formatBytes } from "../../domain/report/report";
import { READ_LIMIT_LABEL } from "../../domain/sample-scope";

/**
 * 宿主把插件的文件访问限制在已打开项目的根目录内（filesystem-service 的 allowedRoots），
 * 越界的路径不会返回 "not found"，而是抛一个被包住的 CapabilityError。IPC 会丢掉 cause，
 * 所以只能按文案识别，换成能照做的说法。
 */
const HOST_PATH_REJECTION =
	/Capability provider failed|outside any known project directory|Resolved path is outside/i;

/** `fs.readBinaryFile` 超限时宿主的原文是 "Binary file too large (>32 MB)"。 */
const HOST_SIZE_REJECTION = /Binary file too large|too large to read/i;

export type SampleFailureKind = "outside-project" | "too-large" | "host-blocked" | "other";

export interface SampleFailure {
	kind: SampleFailureKind;
	/** outside-project / too-large 时是被拒的路径；其余情况是原始错误文案。 */
	detail: string;
	/** too-large 时的字节数，用于给出「180.1 MiB / 上限 32 MiB」这样的对照。 */
	size?: number;
}

/** 本地引擎读不到、只能交给宿主 Agent 的两类：项目外、超出宿主读取上限。 */
export function isHandoffFailure(kind: SampleFailureKind): boolean {
	return kind === "outside-project" || kind === "too-large";
}

export function isHostPathRejection(message: string): boolean {
	return HOST_PATH_REJECTION.test(message);
}

/** 本地预检命中时直接给出结论，不必等 IPC 往返一次再翻译。 */
export function classifySampleFailure(message: string): SampleFailureKind {
	if (HOST_SIZE_REJECTION.test(message)) return "too-large";
	return isHostPathRejection(message) ? "host-blocked" : "other";
}

export function describeSampleFailure(
	failure: SampleFailure,
	t: (key: string, params?: Record<string, string | number>) => string,
	root: string | null,
): string {
	if (failure.kind === "outside-project") {
		return t("panel.error.outsideProjectDetail", { path: failure.detail, root: root ?? "" });
	}
	if (failure.kind === "too-large") {
		return t("panel.error.tooLargeDetail", {
			path: failure.detail,
			size: failure.size ? formatBytes(failure.size) : t("panel.error.unknownSize"),
			limit: READ_LIMIT_LABEL,
		});
	}
	if (failure.kind === "host-blocked") return t("panel.error.outsideProject");
	return failure.detail;
}
