const WINDOWS_ABSOLUTE = /^[a-zA-Z]:[\\/]/;

export function isAbsolutePath(value: string): boolean {
	return value.startsWith("/") || WINDOWS_ABSOLUTE.test(value) || value.startsWith("\\\\");
}

function stripQuotes(raw: string): string {
	return raw.trim().replace(/^["']|["']$/g, "");
}

/**
 * 相对路径一律相对会话工作目录解析，而且不能比 cwd 本身更靠上：`..` 在项目根就拦住。
 * 命令通道（r2 / jadx / apktool 的参数）不经过宿主 fs 的项目根校验，所以边界只能在这里成立；
 * 早先的写法只挡住弹到 `/`，cwd 有两层以上时 `../x` 就跑到项目外了。
 */
export function resolveSamplePath(cwd: string, raw: string): string {
	const value = stripQuotes(raw);
	if (value.length === 0) throw new Error("path is required");
	if (isAbsolutePath(value)) return value;
	const separator = cwd.includes("\\") && !cwd.includes("/") ? "\\" : "/";
	const segments = cwd.split(/[\\/]+/).filter(Boolean);
	const floor = segments.length;
	for (const part of value.split(/[\\/]+/)) {
		if (part === "" || part === ".") continue;
		if (part === "..") {
			if (segments.length <= floor) continue; // the project root is a hard floor: `..` clamps here
			segments.pop();
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
 * 相对路径在这里不算越界，因为 `resolveSamplePath` 会把 `..` 在 cwd 处拦住。没有工作目录时
 * 就没有可校验的根，绝对路径一律当越界——命令通道不经过宿主 fs，不能先放行再指望后者拦。
 */
export function isOutsideProject(raw: string, cwd: string | null): boolean {
	const value = stripQuotes(raw);
	if (value.length === 0) return false;
	if (value === "~" || value.startsWith("~/") || value.startsWith("~\\")) return true;
	if (!cwd) return isAbsolutePath(value);
	const caseInsensitive = WINDOWS_ABSOLUTE.test(value) || WINDOWS_ABSOLUTE.test(cwd);
	// A relative path is relative to the open project, so it can only escape through `..`.
	// Comparing it as if it were absolute would reject every relative path.
	const resolved = isAbsolutePath(value) ? value : `${cwd.replace(/[\\/]+$/, "")}/${value}`;
	return !isWithin(canonicalize(resolved), canonicalize(cwd), caseInsensitive);
}

/** `child` 就是 `parent` 或在它下面——工具要把目录当输出目标前先用这个判一次。 */
export function containsPath(parent: string, child: string): boolean {
	if (!parent || !child) return false;
	const caseInsensitive = WINDOWS_ABSOLUTE.test(parent) || WINDOWS_ABSOLUTE.test(child);
	return isWithin(canonicalize(child), canonicalize(parent), caseInsensitive);
}
