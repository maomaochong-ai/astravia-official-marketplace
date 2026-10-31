import { useTranslator } from "../../hooks/use-translator";

/**
 * 报头：整页唯一的一条横带。
 *
 * 取代原来的「窗口条 + 同步带」两条——那两条把身份与状态拆开，还各占一行，主区因此被压矮。
 * 现在身份在左（方印 + 站名 + 竖线 + 当前页名），中段是三站串在一根发丝线上：执笔 → 落盘 → 读到，
 * 右端只留一句队列状态与调用方放进去的操作按钮。
 *
 * 三站是单向的：侧栏里的团队写，工作台读。所以线上一枚箭头都没有——方向由站点的大小与
 * 实心度说出来，不必再提醒。
 *
 * 右槽最右端常驻一枚全屏键：它不随页面变，因为「把工作台铺满整窗」是外壳的能力，不是某一页的
 * 动作。全屏后同一条报头就是窗口标题栏——`mahua-drag` 让它可拖，里面每个可点的东西再由
 * `mahua-drag` 的 CSS 反向标记 `no-drag`，否则按钮会被当成拖拽把手点不动。
 */
export interface MastheadSync {
	writer: string;
	doing: string;
	file: string;
	words: string;
	ago: string;
	queue: string;
}

export function StudioMasthead({
	section,
	sync,
	fullscreen = false,
	onToggleFullscreen,
	trafficLights = false,
}: {
	section?: string;
	sync?: MastheadSync;
	/** 已铺满整窗：报头兼作拖拽区，右侧的键换成「退出全屏」。 */
	fullscreen?: boolean;
	onToggleFullscreen?: () => void;
	/** 需要给系统窗口按钮让出左侧空间（mac 全屏）。 */
	trafficLights?: boolean;
}) {
	const t = useTranslator();

	return (
		<header
			className={`mahua-masthead flex h-12 shrink-0 items-center gap-3 px-4 ${
				fullscreen ? "mahua-drag" : ""
			} ${trafficLights ? "mahua-traffic-lights" : ""}`}
		>
			<div className="flex w-[216px] min-w-0 shrink-0 items-center gap-2.5 @max-[640px]:w-auto">
				<span className="size-[7px] shrink-0 rounded-tile bg-cinnabar" />
				<span className="shrink-0 text-micro-up font-semibold tracking-[0.2em] text-ink-faint">{t("masthead.brand")}</span>
				{section ? (
					<>
						<span className="h-3 w-px shrink-0 bg-line-strong" />
						<span className="min-w-0 truncate text-micro font-medium text-ink">{section}</span>
					</>
				) : null}
			</div>

			{sync ? (
				// 三站串起来的同步带在容器窄到 640px 以下就收起：它需要整条宽度才读得清楚，
				// 挤到 260px 时每站只剩一个字，比不显示更难读。外层容器仍需占住 `flex-1`，
				// 否则右槽会跟着跑到报头中间去。
				<div className="ml-5 flex min-w-0 flex-1 items-center gap-2.5">
					<span className="hidden min-w-0 flex-1 items-center gap-2.5 @min-[640px]:flex">
						<Stop state="now" label={t("masthead.stop.write")} value={sync.doing} note={sync.writer} />
						<Thread />
						<Stop state="past" label={t("masthead.stop.land")} value={sync.file} note={sync.words} mono />
						<Thread />
						<Stop state="next" label={t("masthead.stop.read")} value={sync.ago} />
					</span>
				</div>
			) : (
				<span className="flex-1" />
			)}

			<div className="flex shrink-0 items-center gap-2 text-[10px] text-ink-faint">
				{sync ? sync.queue : null}
				{onToggleFullscreen ? (
					<button
						type="button"
						onClick={onToggleFullscreen}
						title={fullscreen ? t("window.exitFullscreen") : t("window.fullscreen")}
						aria-label={fullscreen ? t("window.exitFullscreen") : t("window.fullscreen")}
						aria-pressed={fullscreen}
						className="flex h-6 shrink-0 items-center gap-1.5 rounded-control px-1.5 text-[10px] text-ink-soft transition-colors hover:bg-wash hover:text-ink"
					>
						<span
							className={`${
								fullscreen ? "icon-[solar--minimize-square-2-bold]" : "icon-[solar--maximize-square-2-bold]"
							} size-3.5 shrink-0`}
						/>
						<span className="hidden whitespace-nowrap @[760px]:inline">
							{fullscreen ? t("window.exitFullscreen") : t("window.fullscreen")}
						</span>
					</button>
				) : null}
			</div>
		</header>
	);
}

/** 站点之间的发丝线：均分剩余宽度，越长越说明这一段没人动。 */
function Thread() {
	return <span className="h-px min-w-4 flex-1 bg-line" />;
}

function Stop({
	label,
	value,
	note,
	state,
	mono = false,
}: {
	label: string;
	value: string;
	note?: string;
	state: "now" | "past" | "next";
	mono?: boolean;
}) {
	const dot = state === "now" ? "bg-cinnabar" : state === "past" ? "bg-line-strong" : "border border-line-strong";

	return (
		<span className="flex min-w-0 shrink items-center gap-1.5">
			<span className={`size-[5px] shrink-0 rounded-pill ${dot}`} />
			<span className="shrink-0 text-[10px] font-semibold tracking-[0.14em] text-ink-faint">{label}</span>
			<span className={`min-w-0 truncate text-micro text-ink ${mono ? "font-mono" : "font-medium"}`}>{value}</span>
			{note ? (
				<span className="hidden shrink-0 items-center gap-1 text-[10px] text-ink-soft @min-[1100px]:flex">
					<span className="text-line-strong">·</span>
					<span className="max-w-[9rem] truncate">{note}</span>
				</span>
			) : null}
		</span>
	);
}
