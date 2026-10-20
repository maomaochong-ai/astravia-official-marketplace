/**
 * 宿主把插件的文件访问限制在已打开项目的根目录内（filesystem-service 的 allowedRoots），
 * 越界的路径不会返回 "not found"，而是抛一个被包住的 CapabilityError。IPC 会丢掉 cause，
 * 所以只能按文案识别，换成能照做的说法。
 */
const HOST_PATH_REJECTION =
	/Capability provider failed|outside any known project directory|Resolved path is outside/i;

export type SampleFailureKind = "outside-project" | "host-blocked" | "other";

export interface SampleFailure {
	kind: SampleFailureKind;
	/** outside-project 时是被拒的路径；其余情况是原始错误文案。 */
	detail: string;
}

export function isHostPathRejection(message: string): boolean {
	return HOST_PATH_REJECTION.test(message);
}

/** 本地预检命中时直接给出 outside-project，不必等 IPC 往返一次再翻译。 */
export function classifySampleFailure(message: string): SampleFailureKind {
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
	if (failure.kind === "host-blocked") return t("panel.error.outsideProject");
	return failure.detail;
}
