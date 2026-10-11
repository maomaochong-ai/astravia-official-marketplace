import type { ReactNode } from "react";

import Icon from "../Icon";

/**
 * 画布上的一个节点。和上一版「12 列网格里的一个盒子」不同，看板的组件在这里是数据流上的
 * 一个环节：顶部标题条（折叠 / 改名 / 引擎标记），体内联全部参数，左右边缘挂类型化插槽。
 *
 * 坐标约定 —— NodeGraph 里连线的端点用同一套算法算出来，所以端点永远落在插槽上：
 *   第 i 行的行心，相对节点顶部 = 标题 30 + 内边距 8 + 行高 24 × i + 12
 * 插槽不另占一行：它就是它所在的那一行，行的文字说明它是什么、从哪来。
 */

export const HEAD_H = 30;
export const ROW_H = 24;
const BODY_PAD = 8;

/** 第 i 行的行心相对节点顶部的偏移。 */
export function rowDy(row: number) {
	return HEAD_H + BODY_PAD + ROW_H * row + ROW_H / 2;
}

/** 数据类型决定插槽颜色，也决定连线的颜色：同一种数据在画布上是同一种颜色。 */
export const TONE = {
	table: "var(--color-series-1)",
	result: "var(--color-ai)",
	chart: "var(--color-series-2)",
	control: "var(--color-warning)",
};

type Socket = { row: number; tone: string };

type Props = {
	title: string;
	type: string;
	icon: string;
	tone: string;
	x: number;
	y: number;
	w: number;
	h: number;
	selected?: boolean;
	inputs?: Socket[];
	outputs?: Socket[];
	children: ReactNode;
};

const HANDLE = "absolute size-1.5 rounded-[1px] border border-background bg-accent";

export default function NodeCard({
	title,
	type,
	icon,
	tone,
	x,
	y,
	w,
	h,
	selected = false,
	inputs = [],
	outputs = [],
	children,
}: Props) {
	return (
		<div
			className={`absolute flex flex-col rounded-card border bg-surface-raised ${
				selected ? "z-10 border-accent shadow-[0_0_0_3px_var(--color-accent-soft)]" : "border-border"
			}`}
			style={{ left: x, top: y, width: w, height: h }}
		>
			<header className="flex h-[30px] shrink-0 items-center gap-1.5 border-b border-border bg-background px-2">
				<Icon name="icon-[lucide--chevron-down]" className="size-3 shrink-0 text-faint" />
				<span
					className="grid size-[18px] shrink-0 place-items-center rounded-[4px] bg-neutral-muted"
					style={{ color: tone }}
				>
					<Icon name={icon} className="size-3" />
				</span>
				<span className="min-w-0 flex-1 truncate text-[11px] font-medium text-surface-foreground">
					{title}
				</span>
				<span className="shrink-0 font-mono text-[9px] text-faint">{type}</span>
			</header>

			<div className="flex min-h-0 flex-1 flex-col overflow-hidden px-2 py-2">{children}</div>

			{inputs.map((s, i) => (
				<span
					key={`in-${i}`}
					title="输入插槽"
					className="absolute -left-[5px] size-2.5 rounded-full border-2 border-surface-raised"
					style={{ top: rowDy(s.row) - 5, background: s.tone }}
				/>
			))}
			{outputs.map((s, i) => (
				<span
					key={`out-${i}`}
					title="输出插槽"
					className="absolute -right-[5px] size-2.5 rounded-full border-2 border-surface-raised"
					style={{ top: rowDy(s.row) - 5, background: s.tone }}
				/>
			))}

			{selected ? (
				<>
					<span className={`${HANDLE} -top-[3px] -left-[3px]`} />
					<span className={`${HANDLE} -top-[3px] left-1/2 -ml-[3px]`} />
					<span className={`${HANDLE} -top-[3px] -right-[3px]`} />
					<span className={`${HANDLE} top-1/2 -left-[3px] -mt-[3px]`} />
					<span className={`${HANDLE} top-1/2 -right-[3px] -mt-[3px]`} />
					<span className={`${HANDLE} -bottom-[3px] -left-[3px]`} />
					<span className={`${HANDLE} -bottom-[3px] left-1/2 -ml-[3px]`} />
					<span className={`${HANDLE} -right-[3px] -bottom-[3px]`} />
				</>
			) : null}
		</div>
	);
}

/** 节点里的一行。行高固定 24，插槽的行心就是按它算的，所以不要在这些行上加外边距。 */
export function NodeRow({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="flex h-6 shrink-0 items-center gap-2">
			<span className="w-[46px] shrink-0 truncate text-[10px] text-muted">{label}</span>
			<span className="flex min-w-0 flex-1 items-center">{children}</span>
		</div>
	);
}

/** 只读读数（字段名、表名、行数这类），mono 对齐。 */
export function NodeValue({ children, mono = false }: { children: ReactNode; mono?: boolean }) {
	return (
		<span
			className={`min-w-0 flex-1 truncate text-[10px] text-surface-foreground ${
				mono ? "font-mono tabular-nums" : ""
			}`}
		>
			{children}
		</span>
	);
}

/** 可改的下拉参数。节点里的参数不是「打开面板才看得见」，它就在节点上。 */
export function NodeSelect({ children }: { children: ReactNode }) {
	return (
		<span className="flex h-[18px] min-w-0 flex-1 items-center gap-1 rounded-[4px] border border-border bg-surface px-1.5">
			<span className="min-w-0 flex-1 truncate text-[10px] text-surface-foreground">{children}</span>
			<Icon name="icon-[lucide--chevron-down]" className="size-2.5 shrink-0 text-faint" />
		</span>
	);
}

/** 分段参数（图表类型、聚合方式这类二选一）。 */
export function NodeSeg({ options, active }: { options: string[]; active: string }) {
	return (
		<span className="flex h-[18px] min-w-0 shrink-0 items-center gap-0.5 rounded-[4px] border border-border bg-surface p-0.5">
			{options.map((o) => (
				<span
					key={o}
					className={`flex h-[13px] shrink-0 items-center rounded-[3px] px-1.5 text-[9px] whitespace-nowrap ${
						o === active ? "bg-accent-soft font-medium text-accent" : "text-muted"
					}`}
				>
					{o}
				</span>
			))}
		</span>
	);
}
