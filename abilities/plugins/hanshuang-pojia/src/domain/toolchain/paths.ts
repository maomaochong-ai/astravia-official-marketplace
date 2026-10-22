/** Path helpers shared by the Android and workspace modules. */
export function joinPath(directory: string, name: string): string {
	return directory.endsWith("/") || directory.endsWith("\\") ? `${directory}${name}` : `${directory}/${name}`;
}

export function stemOf(filePath: string): string {
	const base = filePath.split(/[\\/]/).pop() ?? filePath;
	const dot = base.lastIndexOf(".");
	return dot > 0 ? base.slice(0, dot) : base;
}

export function parentOf(filePath: string): string {
	const index = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
	return index > 0 ? filePath.slice(0, index) : ".";
}
