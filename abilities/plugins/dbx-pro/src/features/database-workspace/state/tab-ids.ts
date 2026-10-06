/**
 * 工作台 tab 身份工具 — 统一 id 生成与标签命名。
 *
 * 早期各调用点各自拼 `tab-${Date.now().toString(36)}`，同一毫秒内创建两个 tab
 * （连续点击「新建查询」、双击树节点、批量打开）就会撞 id；而 reducer 的 addTab
 * 曾经按 id 去重，撞上的那个 tab 会被静默丢弃。
 *
 * 现在所有 tab id 都从 nextTabId() 取：毫秒时间戳 + 模块级单调计数，
 * 同一毫秒内多次创建也保证唯一（计数在模块生命周期内不重复）。
 */

/** 可视化产物画廊 tab 的固定 id（单例：重复打开只激活，不追加）。 */
export const GALLERY_TAB_ID = "tab-gallery";

let tabSeq = 0;

/** 生成唯一 tab id；prefix 用于区分 tab 类别（如 "viz"、"hist"）。 */
export function nextTabId(prefix = "tab"): string {
	const seq = (tabSeq++).toString(36);
	return `${prefix}-${Date.now().toString(36)}-${seq}`;
}

/** 下一个「查询 N」标签名：按已有标签的最大编号递增，避免重名。 */
export function nextQueryLabel(tabs: ReadonlyArray<{ label: string }>): string {
	const maxIdx = tabs.reduce((max, t) => {
		const m = t.label.match(/^查询 (\d+)/);
		return m ? Math.max(max, Number(m[1])) : max;
	}, 0);
	return `查询 ${maxIdx + 1}`;
}
