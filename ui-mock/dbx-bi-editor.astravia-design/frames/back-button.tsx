export const frame = { width: 1440, height: 1000, title: "BI · 顶栏返回按钮" };

import Icon from "../components/Icon";
import EditorToolbar from "../components/editor/EditorToolbar";

/**
 * 细节帧 — 顶栏最左端那颗返回按钮。
 *
 * 为什么值得单独立一帧：编辑态里只有它一个按钮不修改这份看板，而是要**离开**这份看板
 * （其余按钮改的是数据、公式、布局）。出口是唯一一个「按错就丢工作」的控件，所以它得把
 * 合同交代完整：命中区多大、与标题之间那条竖线是什么、悬停/按下/聚焦各长什么样，
 * 以及有未保存更改时按下去会发生什么。
 *
 * 第一块用的是**真实复用的** <EditorToolbar />（1:1），不是在这里重画一遍 —— 重画的比例
 * 迟早和编辑态对不上，而这一帧的全部意义就是「编辑态里那颗按钮就是这个尺寸」。
 */

const STATE_SPECS = [
	{ name: "默认", cls: "text-muted", note: "无底色 · 图标 muted" },
	{
		name: "悬停",
		cls: "bg-neutral-muted text-surface-foreground",
		note: "neutral-muted 40% · 图标提亮",
	},
	{
		name: "按下",
		cls: "bg-border-strong text-surface-foreground",
		note: "实底 · 不位移、不缩放",
	},
	{
		name: "聚焦",
		cls: "bg-neutral-muted text-surface-foreground shadow-[0_0_0_2px_var(--color-accent-soft)]",
		note: "同悬停 + 2px accent 外环",
	},
	{ name: "保存中", cls: "text-faint", note: "禁用 · 图标 faint" },
];

const SPECS = [
	["命中区", "28 × 28", "size-7，不小于 24 的可点下限"],
	["图标", "14 × 14", "lucide arrow-left · 线宽 1.5"],
	["圆角", "6", "radius-control，与所有控件一致"],
	["左侧边距", "12", "顶栏 px-3，与右端按钮簇对称"],
	["与竖线间距", "8", "gap-2"],
	["竖线", "1 × 20", "border 色，分隔出口与看板标题"],
	["顶栏高", "48", "h-12，按钮垂直居中"],
];

const BEHAVIORS = [
	["点击", "回到「BI 数据资产」列表，退出当前看板"],
	["有未保存", "先拦截：保存并离开 / 不保存离开 / 取消"],
	["键盘", "⌘[ 与点击等效；⌘S 只保存、不离开"],
	["回到哪里", "列表保留上次的搜索、筛选与页码"],
	["无障碍", "title 即 aria-label「返回 BI 数据资产」"],
];

const EXITS = [
	["保存中", "按钮转 faint 且忽略点击 —— 半保存状态下离开会丢改动"],
	["有未保存", "先三选一：保存并离开 / 不保存离开 / 取消，默认聚焦第一项"],
	["从产物进来", "同一颗按钮回到产物列表，不回 BI 资产 —— 来处即去处"],
];

const TICKS = [0, 12, 40, 48];

const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

/** 顶栏左端的尺寸带：12 边距 / 28 命中区 / 8 间距 / 竖线，全部 1:1 对齐真实坐标。 */
function DimBand() {
	return (
		<svg viewBox="0 0 1360 30" className="h-[30px] w-full" fill="none" aria-hidden>
			<line x1="0" y1="10" x2="48" y2="10" stroke="var(--color-border-strong)" strokeWidth="1" />
			{TICKS.map((t) => (
				<line
					key={t}
					x1={t}
					y1="5"
					x2={t}
					y2="15"
					stroke="var(--color-border-strong)"
					strokeWidth="1"
				/>
			))}
			<text
				x="6"
				y="27"
				textAnchor="middle"
				fontSize="9"
				fill="var(--color-faint)"
				fontFamily={MONO}
			>
				12
			</text>
			<text
				x="26"
				y="27"
				textAnchor="middle"
				fontSize="9"
				fill="var(--color-faint)"
				fontFamily={MONO}
			>
				28
			</text>
			<line x1="48" y1="15" x2="70" y2="24" stroke="var(--color-border-strong)" strokeWidth="1" />
			<text x="74" y="27" fontSize="9" fill="var(--color-faint)" fontFamily={MONO}>
				竖线 1 × 20 · 左右各 8 → 看板标题
			</text>
		</svg>
	);
}

/** 2× 放大图：命中区、圆角与图标在同一张图上量。 */
function Zoom() {
	return (
		<svg viewBox="0 0 104 112" className="h-[112px] w-[104px] shrink-0" fill="none" aria-hidden>
			<text x="8" y="9" fontSize="9" fill="var(--color-faint)" fontFamily={MONO}>
				2×
			</text>
			<rect
				x="8"
				y="16"
				width="56"
				height="56"
				rx="12"
				stroke="var(--color-accent)"
				strokeWidth="1.5"
			/>
			<g
				transform="translate(22 30) scale(1.1667)"
				stroke="var(--color-surface-foreground)"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			>
				<path d="M19 12H5" />
				<path d="m12 19-7-7 7-7" />
			</g>
			<line x1="8" y1="80" x2="64" y2="80" stroke="var(--color-border-strong)" strokeWidth="1" />
			<line x1="8" y1="76" x2="8" y2="84" stroke="var(--color-border-strong)" strokeWidth="1" />
			<line x1="64" y1="76" x2="64" y2="84" stroke="var(--color-border-strong)" strokeWidth="1" />
			<text
				x="36"
				y="98"
				textAnchor="middle"
				fontSize="9"
				fill="var(--color-faint)"
				fontFamily={MONO}
			>
				28
			</text>
			<line x1="74" y1="16" x2="74" y2="72" stroke="var(--color-border-strong)" strokeWidth="1" />
			<line x1="70" y1="16" x2="78" y2="16" stroke="var(--color-border-strong)" strokeWidth="1" />
			<line x1="70" y1="72" x2="78" y2="72" stroke="var(--color-border-strong)" strokeWidth="1" />
			<text x="82" y="44" fontSize="9" fill="var(--color-faint)" fontFamily={MONO}>
				28
			</text>
		</svg>
	);
}

function SectionTitle({ title, note }: { title: string; note: string }) {
	return (
		<div className="flex shrink-0 items-baseline gap-2.5">
			<h2 className="text-[13px] font-semibold text-surface-foreground">{title}</h2>
			<span className="font-mono text-[11px] text-faint">{note}</span>
		</div>
	);
}

export default function BackButton() {
	return (
		<div className="flex h-full w-full flex-col overflow-hidden bg-background font-sans text-[14px] text-surface-foreground">
			<header className="flex shrink-0 items-start gap-6 border-b border-border px-10 pt-7 pb-6">
				<div className="min-w-0">
					<span className="font-mono text-[11px] tracking-wide text-accent">
						顶栏 · 最左端
					</span>
					<h1 className="mt-2 text-[22px] leading-tight font-semibold">返回按钮</h1>
					<p className="mt-2 max-w-[720px] text-[13px] leading-relaxed text-muted">
						编辑器里唯一一个不修改这份看板的按钮：它离开。28 × 28 命中区、14px 图标，
						与看板标题之间隔一条 20px 高的竖线 —— 出口和其它改动动作在视觉上必须分开。
					</p>
				</div>
				<div className="ml-auto flex shrink-0 flex-col items-end gap-1 pt-1">
					<span className="font-mono text-[11px] text-faint">IconButton · size="sm"</span>
					<span className="font-mono text-[11px] text-faint">lucide arrow-left</span>
					<span className="font-mono text-[11px] text-faint">出现在 frames/editor</span>
				</div>
			</header>

			<div className="flex min-h-0 flex-1 flex-col gap-6 overflow-hidden px-10 py-6">
				<section className="flex shrink-0 flex-col gap-2">
					<SectionTitle title="上下文" note="顶栏左端 1:1 · 尺寸线对齐真实坐标" />
					<div className="overflow-hidden rounded-card border border-border bg-surface">
						<EditorToolbar />
						<DimBand />
					</div>
				</section>

				<section className="flex shrink-0 flex-col gap-2">
					<SectionTitle title="状态" note="舞台底色 = 顶栏底色 surface-raised" />
					<div className="grid grid-cols-5 gap-3">
						{STATE_SPECS.map((s) => (
							<div
								key={s.name}
								className="flex flex-col gap-2 rounded-card border border-border bg-surface p-3"
							>
								<div className="grid h-[72px] place-items-center rounded-control border border-border bg-surface-raised">
									<span
										className={`grid size-7 place-items-center rounded-control ${s.cls}`}
									>
										<Icon name="icon-[lucide--arrow-left]" className="size-3.5" />
									</span>
								</div>
								<span className="text-[12px] font-medium">{s.name}</span>
								<span className="font-mono text-[10px] leading-relaxed text-faint">
									{s.note}
								</span>
							</div>
						))}
					</div>
				</section>

				<section className="flex shrink-0 flex-col gap-2">
					<SectionTitle title="出口的边界" note="它不修改看板，只负责离开" />
					<div className="grid grid-cols-3 gap-3">
						{EXITS.map(([k, v]) => (
							<div key={k} className="flex flex-col gap-1.5 rounded-card border border-border bg-surface p-3">
								<span className="text-[12px] font-medium">{k}</span>
								<span className="text-[11px] leading-relaxed text-muted">{v}</span>
							</div>
						))}
					</div>
				</section>

				<section className="grid min-h-0 flex-1 grid-cols-12 gap-6">
					<div className="col-span-7 flex flex-col gap-2">
						<SectionTitle title="尺寸与间距" note="单位 px · 全部来自顶栏实际排布" />
						<div className="flex flex-1 items-start gap-6">
							<Zoom />
							<div className="flex min-w-0 flex-1 flex-col">
								{SPECS.map(([k, v, note]) => (
									<div key={k} className="flex items-baseline gap-3 py-[7px]">
										<span className="w-16 shrink-0 text-[11px] text-faint">{k}</span>
										<span className="w-20 shrink-0 font-mono text-[12px] tabular-nums text-surface-foreground">
											{v}
										</span>
										<span className="truncate text-[11px] text-muted">{note}</span>
									</div>
								))}
							</div>
						</div>
					</div>

					<div className="col-span-5 flex flex-col gap-2">
						<SectionTitle title="行为" note="点击之后发生什么" />
						<div className="flex flex-col">
							{BEHAVIORS.map(([k, v]) => (
								<div key={k} className="flex items-baseline gap-3 py-[7px]">
									<span className="w-16 shrink-0 text-[11px] text-faint">{k}</span>
									<span className="min-w-0 flex-1 text-[12px] leading-relaxed text-muted">
										{v}
									</span>
								</div>
							))}
						</div>
					</div>
				</section>
			</div>
		</div>
	);
}
