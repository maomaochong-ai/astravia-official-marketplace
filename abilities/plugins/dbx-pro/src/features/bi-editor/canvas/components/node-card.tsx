/**
 * node-card.tsx — 画布节点卡片。
 *
 * 数据流节点：顶部标题条 + 体内联参数 + 左右插槽。
 * 坐标约定（NodeGraph 连线用同一套 rowDy() 算插槽位置）：
 *   HEAD_H + BODY_PAD + ROW_H × row + ROW_H/2
 */

import { memo, type ReactNode, type PointerEvent } from "react";

export const HEAD_H = 30;
export const ROW_H = 24;
const BODY_PAD = 8;

/** 第 i 行行心相对节点顶部的偏移（连线端点算法同用）。 */
export function rowDy(row: number): number {
	return HEAD_H + BODY_PAD + ROW_H * row + ROW_H / 2;
}

/** 数据类型决定插槽颜色 + 连线颜色。 */
export const TONE = {
	table: "#3b82f6",   // 数据集
	result: "#f59e0b",  // 查询结果 / AI
	chart: "#10b981",   // 图表产物
	control: "#f97316", // 控件
};

type Socket = { row: number; tone: string };

/** socket 事件回调——NodeGraph 注入，NodeCard 调用后返回事件的原生处理。 */
export interface SocketHandlers {
	/** 输出 socket 被按下 → NodeGraph 应启动 pendingLink + 弹出 AddNodeMenu */
	onOutputDown?: (args: { nodeId: string; row: number; tone: string; clientX: number; clientY: number }) => void;
	/** 输入 socket 被按下 → 如果有 pendingLink 就完成连线 */
	onInputDown?: (args: { nodeId: string; row: number; tone: string; clientX: number; clientY: number }) => void;
}

export interface NodeCardProps {
	title: string;
	type: string;
	icon: string;
	tone: string;
	x: number;
	y: number;
	w: number;
	h: number;
	selected?: boolean;
	/** 停用（ComfyUI bypass/mute）：仍渲染但运行时会跳过，视觉上变灰。 */
	muted?: boolean;
	inputs?: Socket[];
	outputs?: Socket[];
	children: ReactNode;
	onPointerDown?: (e: PointerEvent) => void;
	onResizeStart?: (corner: "tl" | "tr" | "bl" | "br", e: PointerEvent) => void;
	nodeId?: string;
	socketHandlers?: SocketHandlers;
}

const HANDLE = "absolute size-1.5 rounded-[1px] border border-surface bg-accent";

export const NodeCard = memo(function NodeCard({
	title, type, icon, tone, x, y, w, h,
	selected = false,
	muted = false,
	inputs = [], outputs = [],
	children,
	onPointerDown,
	onResizeStart,
	nodeId,
	socketHandlers,
}: NodeCardProps) {
	return (
		<div
			className={`absolute flex flex-col rounded-card bg-surface-raised border ${
				muted ? "border-dashed border-border cursor-grab opacity-55"
					: selected ? "z-10 border-accent outline outline-2 outline-dashed outline-offset-2 outline-accent/70 cursor-grab shadow-[0_0_0_3px_rgba(59,130,246,0.25)]"
						: "border-border cursor-grab"
			}`}
			style={{ left: x, top: y, width: w, height: h }}
			data-node-id={nodeId}
			onPointerDown={onPointerDown}
		>
			<header className="flex h-[30px] shrink-0 items-center gap-1.5 border-b border-border bg-surface px-2">
				<span className="icon-[lucide--chevron-down] size-3 shrink-0 text-faint" />
				<span className="grid size-[18px] shrink-0 place-items-center rounded-[4px] bg-background" style={{ color: tone }}>
					<span className={icon} style={{ width: 12, height: 12 }} />
				</span>
				<span className="min-w-0 flex-1 truncate text-[11px] font-medium text-surface-foreground">{title}</span>
				{muted ? (
					<span className="shrink-0 rounded-chip bg-neutral-muted px-1 text-[9px] text-muted">已停用</span>
				) : (
					<span className="shrink-0 font-mono text-[9px] text-faint">{type}</span>
				)}
			</header>

			<div className="flex min-h-0 flex-1 flex-col overflow-hidden px-2 py-2">{children}</div>

			{inputs.map((s, i) => (
				<span
					key={`in-${i}`}
					title="输入插槽"
					data-socket-type="input"
					data-socket-row={s.row}
					data-node-id={nodeId}
					onPointerDown={(e) => {
						e.stopPropagation(); e.preventDefault();
						if (socketHandlers?.onInputDown) socketHandlers.onInputDown({ nodeId: nodeId ?? "", row: s.row, tone: s.tone, clientX: e.clientX, clientY: e.clientY });
					}}
					className="pointer-events-auto absolute -left-[6px] size-3 cursor-crosshair rounded-full border-2 border-surface-raised hover:scale-125 hover:ring-2 hover:ring-accent/40 transition-all"
					style={{ top: rowDy(s.row) - 6, background: s.tone, zIndex: 20 }}
				/>
			))}
			{outputs.map((s, i) => (
				<span
					key={`out-${i}`}
					title="输出插槽"
					data-socket-type="output"
					data-socket-row={s.row}
					data-node-id={nodeId}
					onPointerDown={(e) => {
						e.stopPropagation(); e.preventDefault();
						if (socketHandlers?.onOutputDown) socketHandlers.onOutputDown({ nodeId: nodeId ?? "", row: s.row, tone: s.tone, clientX: e.clientX, clientY: e.clientY });
					}}
					className="pointer-events-auto absolute -right-[6px] size-3 cursor-crosshair rounded-full border-2 border-surface-raised hover:scale-125 hover:ring-2 hover:ring-accent/40 transition-all"
					style={{ top: rowDy(s.row) - 6, background: s.tone, zIndex: 20 }}
				/>
			))}

			{selected && onResizeStart && (
				<>
					<span
						className={`${HANDLE} -top-[3px] -left-[3px] cursor-nwse-resize hover:bg-accent-hover`}
						onPointerDown={(e) => { e.preventDefault(); onResizeStart("tl", e); }}
					/>
					<span className={`${HANDLE} -top-[3px] left-1/2 -ml-[3px]`} />
					<span
						className={`${HANDLE} -top-[3px] -right-[3px] cursor-nesw-resize hover:bg-accent-hover`}
						onPointerDown={(e) => { e.preventDefault(); onResizeStart("tr", e); }}
					/>
					<span className={`${HANDLE} top-1/2 -left-[3px] -mt-[3px]`} />
					<span className={`${HANDLE} top-1/2 -right-[3px] -mt-[3px]`} />
					<span
						className={`${HANDLE} -bottom-[3px] -left-[3px] cursor-nesw-resize hover:bg-accent-hover`}
						onPointerDown={(e) => { e.preventDefault(); onResizeStart("bl", e); }}
					/>
					<span className={`${HANDLE} -bottom-[3px] left-1/2 -ml-[3px]`} />
					<span
						className={`${HANDLE} -right-[3px] -bottom-[3px] cursor-nwse-resize hover:bg-accent-hover`}
						onPointerDown={(e) => { e.preventDefault(); onResizeStart("br", e); }}
					/>
				</>
			)}
			{selected && !onResizeStart && (
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
			)}
		</div>
	);
});

export function NodeRow({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="flex h-6 shrink-0 items-center gap-2">
			<span className="w-[46px] shrink-0 truncate text-[10px] text-muted">{label}</span>
			<span className="flex min-w-0 flex-1 items-center">{children}</span>
		</div>
	);
}

export function NodeValue({ children, mono = false }: { children: ReactNode; mono?: boolean }) {
	return (
		<span className={`min-w-0 flex-1 truncate text-[10px] text-surface-foreground ${mono ? "font-mono tabular-nums" : ""}`}>
			{children}
		</span>
	);
}

export function NodeSelect({ children }: { children: ReactNode }) {
	return (
		<span className="flex h-[18px] min-w-0 flex-1 items-center gap-1 rounded-[4px] border border-border bg-surface px-1.5">
			<span className="min-w-0 flex-1 truncate text-[10px] text-surface-foreground">{children}</span>
			<span className="icon-[lucide--chevron-down] size-2.5 shrink-0 text-faint" />
		</span>
	);
}

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
