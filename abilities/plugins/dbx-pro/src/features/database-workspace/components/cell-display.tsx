/**
 * CellDisplay — 结果单元格的值渲染（按类型区分样式）。
 * 纯展示组件：NULL / 布尔 / 数字 / 对象 / 链接 / 普通文本各有视觉处理。
 */

import type { JSX } from "react";

export function CellDisplay({ value }: { value: unknown }): JSX.Element {
	if (value === null || value === undefined) {
		return <span className="italic text-faint">NULL</span>;
	}
	if (typeof value === "boolean") {
		return <span>{String(value)}</span>;
	}
	if (typeof value === "number") {
		return <span className="font-mono">{String(value)}</span>;
	}
	if (typeof value === "object") {
		return <span className="font-mono text-muted">{JSON.stringify(value)}</span>;
	}
	const text = String(value);
	if (/^https?:\/\//i.test(text)) {
		return (
			<span className="text-link underline">{text}</span>
		);
	}
	return <span>{text}</span>;
}
