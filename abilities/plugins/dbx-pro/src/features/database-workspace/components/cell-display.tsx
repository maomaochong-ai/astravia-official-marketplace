/**
 * CellDisplay — 结果单元格的值渲染（按类型区分样式）。
 * 纯展示组件：NULL / 布尔 / 数字 / 对象 / 链接 / 普通文本各有视觉处理。
 */

import type { JSX } from "react";

export function CellDisplay({ value }: { value: unknown }): JSX.Element {
	if (value === null || value === undefined) {
		return <span className="italic text-muted-foreground/70">NULL</span>;
	}
	if (typeof value === "boolean") {
		return <span className="text-foreground/70">{String(value)}</span>;
	}
	if (typeof value === "number") {
		return <span className="font-mono text-foreground/80">{String(value)}</span>;
	}
	if (typeof value === "object") {
		return <span className="font-mono text-foreground/70">{JSON.stringify(value)}</span>;
	}
	const text = String(value);
	if (/^https?:\/\//i.test(text)) {
		return (
			<span className="text-foreground/80 underline decoration-foreground/30">{text}</span>
		);
	}
	return <span>{text}</span>;
}
