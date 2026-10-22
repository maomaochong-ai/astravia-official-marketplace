const WINDOWS_ABSOLUTE = /^[a-zA-Z]:[\\/]/;

export function isAbsolutePath(value: string): boolean {
	return value.startsWith("/") || WINDOWS_ABSOLUTE.test(value) || value.startsWith("\\\\");
}

function stripQuotes(raw: string): string {
	return raw.trim().replace(/^["']|["']$/g, "");
}

/** 相对路径一律相对会话工作目录解析；".." 直接消掉，不让工具越出 cwd。 */
export function resolveSamplePath(cwd: string, raw: string): string {
	const value = stripQuotes(raw);
	if (value.length === 0) throw new Error("path is required");
	if (isAbsolutePath(value)) return value;
	const separator = cwd.includes("\\") && !cwd.includes("/") ? "\\" : "/";
	const segments = cwd.split(/[\\/]+/).filter(Boolean);
	for (const part of value.split(/[\\/]+/)) {
		if (part === "" || part === ".") continue;
		if (part === "..") {
			if (segments.length > 1) segments.pop();
			continue;
		}
		segments.push(part);
	}
	const joined = segments.join(separator);
	return cwd.startsWith("/") ? `/${joined}` : joined;
}

export function baseName(path: string): string {
	const parts = path.split(/[\\/]+/).filter(Boolean);
	return parts[parts.length - 1] ?? path;
}

/** 折叠 `.` / `..` / 重复分隔符并统一分隔符，用于比较而不是用于读取。 */
function canonicalize(path: string): string {
	const drive = WINDOWS_ABSOLUTE.test(path) ? path.slice(0, 2) : "";
	const segments: string[] = [];
	for (const part of path.slice(drive.length).replace(/\\/g, "/").split("/")) {
		if (part === "" || part === ".") continue;
		if (part === "..") {
			segments.pop();
			continue;
		}
		segments.push(part);
	}
	return `${drive}/${segments.join("/")}`;
}

function isWithin(target: string, root: string, caseInsensitive: boolean): boolean {
	const fold = (value: string) => (caseInsensitive ? value.toLowerCase() : value);
	const normalizedTarget = fold(target);
	const normalizedRoot = fold(root);
	if (normalizedTarget === normalizedRoot) return true;
	return normalizedTarget.startsWith(normalizedRoot.endsWith("/") ? normalizedRoot : `${normalizedRoot}/`);
}

/**
 * 宿主的文件能力只授权到已打开项目的根目录（allowedRoots），越界的路径会抛被包住的
 * CapabilityError 而不是 "not found"。所以在发起 IPC 之前先判一次，把话说在报错之前。
 *
 * 相对路径不算越界：`resolveSamplePath` 会把 `..` 夹在 cwd 内。
 */
export function isOutsideProject(raw: string, cwd: string | null): boolean {
	const value = stripQuotes(raw);
	if (value.length === 0 || !cwd) return false;
	if (value === "~" || value.startsWith("~/") || value.startsWith("~\\")) return true;
	if (!isAbsolutePath(value)) return false;
	const caseInsensitive = WINDOWS_ABSOLUTE.test(value) || WINDOWS_ABSOLUTE.test(cwd);
	return !isWithin(canonicalize(value), canonicalize(cwd), caseInsensitive);
}
