import { READ_LIMIT_BYTES } from "../../../domain/sample-scope";

/**
 * 用户选中的本机样本先落到工作区，再由宿主的读取通道分析。
 *
 * 为什么不直接读原路径：宿主的 fs 能力只授权到已打开项目的根目录
 * （`assertFilesystemRealPathWithinProject`），项目外的绝对路径连 stat 都拿不到；
 * 而插件 SDK 只有写侧的 `saveAs`，没有「打开文件选择器」。渲染进程的 `File`
 * 对象是唯一能拿到项目外字节的入口，所以复制一份进工作区是唯一可行路线。
 */
export const IMPORT_DIRECTORY = ".hanshuang/samples";

/** 落在工作区内的相对路径，`resolveSamplePath` 会按 cwd 的分隔符拼好。 */
export function importRelativePath(name: string): string {
	return `${IMPORT_DIRECTORY}/${importName(name)}`;
}

/**
 * 只保留文件名本身：`webkitRelativePath` 与手工构造的 `File` 都可能带分隔符，
 * 原样拼进工作区路径就等于让选择器的输入决定写盘位置。
 */
export function importName(raw: string): string {
	const base = raw.split(/[\\/]+/).filter(Boolean).pop() ?? "";
	const cleaned = base
		// 路径分隔符之外，Windows 文件名禁用字符与 NUL 都换成下划线。
		.replace(/[\u0000-\u001f<>:"|?*]/g, "_")
		.trim();
	if (cleaned === "" || cleaned === "." || cleaned === "..") return `sample-${Date.now()}`;
	return cleaned;
}

export function isTooLarge(size: number): boolean {
	return size > READ_LIMIT_BYTES;
}

/** 大样本分块拼串：一次性 `String.fromCharCode(...bytes)` 在几 MB 上就会爆栈。 */
export function bytesToBase64(bytes: Uint8Array): string {
	const CHUNK = 0x2000;
	let binary = "";
	for (let index = 0; index < bytes.length; index += CHUNK) {
		binary += String.fromCharCode(...bytes.subarray(index, index + CHUNK));
	}
	return btoa(binary);
}

/** `Blob.arrayBuffer` 在老一点的渲染进程里没有，FileReader 兜底。 */
function readBytes(file: Blob): Promise<ArrayBuffer> {
	if (typeof file.arrayBuffer === "function") return file.arrayBuffer();
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as ArrayBuffer);
		reader.onerror = () => reject(reader.error ?? new Error("Could not read the selected file."));
		reader.readAsArrayBuffer(file);
	});
}

export async function readFileAsBase64(file: File): Promise<string> {
	return bytesToBase64(new Uint8Array(await readBytes(file)));
}

export function fileList(files: FileList | null | undefined): File[] {
	if (!files) return [];
	return Array.from(files);
}
