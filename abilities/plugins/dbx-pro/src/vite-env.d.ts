/** Vite 资源导入类型（ambient 声明文件：无顶层 import/export）。 */

declare module "*?raw" {
	const content: string;
	export default content;
}

declare module "*?url" {
	const src: string;
	export default src;
}

declare module "*.exe?url" {
	const src: string;
	export default src;
}
