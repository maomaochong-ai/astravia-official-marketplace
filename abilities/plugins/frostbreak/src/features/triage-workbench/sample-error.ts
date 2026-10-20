/**
 * 宿主把插件的文件访问限制在已打开项目的根目录内（filesystem-service 的 allowedRoots），
 * 越界的路径不会返回 "not found"，而是抛一个被包住的 CapabilityError。
 * 原始文案对用户没有意义，这里换成能照做的说法。
 */
const HOST_PATH_REJECTION =
	/Capability provider failed|outside any known project directory|Resolved path is outside/i;

export function isHostPathRejection(message: string): boolean {
	return HOST_PATH_REJECTION.test(message);
}

export function sampleErrorText(message: string, t: (key: string) => string): string {
	return isHostPathRejection(message) ? t("panel.error.outsideProject") : message;
}
