/**
 * 「装在哪」：容器应用与随包工具链的安装位置（纯函数）。
 *
 * 为什么需要它：用户选了容器之后，插件用的是镜像里的工具链、容器里的 `/workspace`、
 * 宿主机上的 docker 数据目录。这三处分散在四个系统默认路径里，而面板此前一个都不说。
 * 用户问的原话是"能不能有个入口看到不同系统的容器应用装在哪，点了能打开"。
 *
 * 两条纪律：
 *  - **容器内路径不能对宿主"打开"**：它在容器里，宿主的文件管理器没有这个文件。
 *    那些条目给的是"在容器里看一眼"的命令，点击 = 复制，不假装能打开。
 *  - **宿主路径要标存在与否**：路径是猜的（各系统默认值），猜测必须能被证伪；
 *    `exists` 由服务用 fs 探一次，面板照实画（存在=可点开，不存在=灰色并说明）。
 */

export type InstallScope = "host" | "container" | "reference";

export interface InstallPath {
	/** 稳定 id，面板用来做 key 与"展开哪一条"。 */
	id: string;
	scope: InstallScope;
	/** `win32` / `darwin` / `linux`；`reference` 条目标的是它所描述的系统。 */
	os: "win32" | "darwin" | "linux";
	label: string;
	path: string;
	/** 宿主路径是否存在；容器/参考条目为 undefined（无法从宿主确认）。 */
	exists?: boolean;
	/** 容器条目的"怎么看"命令（点击时复制）。 */
	command?: string;
}

export interface InstallPathsInput {
	platform: NodeJS.Platform;
	/** docker 可用且这次选的是容器；否则只给宿主工具链与数据目录。 */
	docker: boolean;
	/** 镜像名（容器条目的说明里会用到）。 */
	image: string;
	/** 运行中的容器名；没有沙箱时为空。 */
	container?: string | null;
	/** 随包工具链目录（宿主机上真实存在）。 */
	toolchainDir?: string | null;
	/** 插件数据目录（台账、笔记、偏好）。 */
	dataDir?: string | null;
	/** 当前会话的工作目录（宿主机上真实存在）。 */
	workspace?: string | null;
}

/** 各系统上 docker 的默认安装位置。只有当前系统那条会被探"存在与否"。 */
const DOCKER_HOST_PATHS: Record<"win32" | "darwin" | "linux", Array<{ label: string; path: string }>> = {
	win32: [
		{ label: "docker 程序", path: "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe" },
		{ label: "docker 数据", path: "%LOCALAPPDATA%\\Docker\\wsl" },
		{ label: "镜像存储", path: "%PROGRAMDATA%\\DockerDesktop\\image" },
	],
	darwin: [
		{ label: "docker 程序", path: "/usr/local/bin/docker" },
		{ label: "docker 数据", path: "~/Library/Containers/com.docker.docker/Data" },
		{ label: "镜像存储", path: "~/Library/Containers/com.docker.docker/Data/vms/0" },
	],
	linux: [
		{ label: "docker 程序", path: "/usr/bin/docker" },
		{ label: "docker 数据", path: "/var/lib/docker" },
		{ label: "镜像存储", path: "/var/lib/docker/overlay2" },
	],
};

/** 容器内的工具链落点：镜像把 CLI 放在这几个目录里，`/workspace` 是挂载点。 */
const CONTAINER_PATHS: Array<{ label: string; path: string }> = [
	{ label: "工具栏", path: "/usr/local/bin" },
	{ label: "Strix 包", path: "/opt/strix" },
	{ label: "工作目录", path: "/workspace" },
];

const OS_LABEL: Record<"win32" | "darwin" | "linux", string> = {
	win32: "Windows",
	darwin: "macOS",
	linux: "Linux",
};

function asOs(platform: NodeJS.Platform): "win32" | "darwin" | "linux" {
	if (platform === "win32") return "win32";
	if (platform === "darwin") return "darwin";
	return "linux";
}

/**
 * 组装条目。顺序即阅读顺序：这次真正用到的（本机 docker / 容器）在前，
 * 其它系统的默认位置作为参考排在后面——README 里能查到的东西，不必抢视线。
 */
export function installPaths(input: InstallPathsInput): InstallPath[] {
	const current = asOs(input.platform);
	const entries: InstallPath[] = [];

	if (input.docker) {
		for (const item of DOCKER_HOST_PATHS[current]) {
			entries.push({
				id: `docker-${current}-${item.label}`,
				scope: "host",
				os: current,
				label: item.label,
				path: item.path,
				// exists 由调用方补（服务会探）；这里不猜。
			});
		}
	}

	if (input.container) {
		for (const item of CONTAINER_PATHS) {
			entries.push({
				id: `container-${item.path}`,
				scope: "container",
				os: current,
				label: item.label,
				path: item.path,
				command: `docker exec -it ${input.container} sh -lc 'ls -ld ${item.path}'`,
			});
		}
	}

	if (input.toolchainDir) {
		entries.push({
			id: "host-toolchain",
			scope: "host",
			os: current,
			label: "随包工具链",
			path: input.toolchainDir,
		});
	}
	if (input.dataDir) {
		entries.push({ id: "host-data", scope: "host", os: current, label: "台账与笔记", path: input.dataDir });
	}
	if (input.workspace) {
		entries.push({ id: "host-workspace", scope: "host", os: current, label: "当前工作目录", path: input.workspace });
	}

	// 其它系统的默认位置：只在这个容器真的被别处用时才有意义，作为参考列出。
	for (const os of ["win32", "darwin", "linux"] as const) {
		if (os === current) continue;
		const item = DOCKER_HOST_PATHS[os][0]!;
		entries.push({
			id: `reference-${os}`,
			scope: "reference",
			os,
			label: `${OS_LABEL[os]} 默认 docker`,
			path: item.path,
		});
	}

	return entries;
}

/** 一条条目能不能被点击"打开"：只有宿主上存在、且不是容器内的路径。 */
export function canReveal(entry: InstallPath): boolean {
	return entry.scope === "host" && entry.exists === true;
}

/** 点击一条条目时该做什么：打开 / 复制命令 / 复制路径。 */
export function clickAction(entry: InstallPath): "reveal" | "copy-command" | "copy-path" {
	if (entry.scope === "container") return "copy-command";
	if (canReveal(entry)) return "reveal";
	return "copy-path";
}
