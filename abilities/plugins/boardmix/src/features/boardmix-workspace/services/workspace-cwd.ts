/**
 * 工具层要的 cwd：截图得落在项目里，模型才能用 `Read` 打开它。
 * `ctx.fs.writeFile` 只认项目根内的路径，而工具侧拿不到 cwd，
 * 所以由面板（`useActivityTab()`）在渲染时把它交过来。
 */
let workspaceCwd: string | null = null;

export function setBoardmixWorkspace(cwd: string | null): void {
	workspaceCwd = typeof cwd === "string" && cwd.length > 0 ? cwd : null;
}

export function boardmixWorkspace(): string | null {
	return workspaceCwd;
}
