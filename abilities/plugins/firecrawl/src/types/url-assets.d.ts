/** Vite emits `?url` imports as a string path; the plugin does not include vite/client types. */
declare module "*?url" {
	const url: string;
	export default url;
}
