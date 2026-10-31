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
	right,
	sync,
}: {
	section?: string;
	right?: React.ReactNode;
	sync?: MastheadSync;
}) {
	const t = useTranslator();

	return (
		<header className="flex h-12 shrink-0 items-center gap-3 border-b border-line-soft px-4">
			<div className="flex min-w-0 shrink-0 items-center gap-2.5">
				<span className="size-[7px] shrink-0 rounded-tile bg-cinnabar" />
				<span className="shrink-0 text-micro-up font-semibold text-ink-faint">{t("masthead.brand")}</span>
				{section ? (
					<>
						<span className="h-3 w-px shrink-0 bg-line-strong" />
						<span className="truncate text-micro font-medium text-ink">{section}</span>
					</>
				) : null}
			</div>

			{sync ? (
				<div className="ml-4 flex min-w-0 flex-1 items-center gap-2.5">
					<Stop state="now" label={t("masthead.stop.write")} value={sync.doing} note={sync.writer} />
					<Thread />
					<Stop state="past" label={t("masthead.stop.land")} value={sync.file} note={sync.words} mono />
					<Thread />
					<Stop state="next" label={t("masthead.stop.read")} value={sync.ago} />
				</div>
			) : (
				<span className="flex-1" />
			)}

			<div className="flex shrink-0 items-center gap-2 text-[10px] text-ink-faint">
				{sync ? <span className="hidden truncate @min-[960px]:inline">{sync.queue}</span> : null}
				{right}
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
			<span className="shrink-0 text-[10px] font-semibold text-ink-faint">{label}</span>
			<span className={`truncate text-micro text-ink ${mono ? "font-mono" : "font-medium"}`}>{value}</span>
			{note ? (
				<span className="hidden shrink-0 items-center gap-1 text-[10px] text-ink-soft @min-[1100px]:flex">
					<span className="text-line-strong">·</span>
					<span className="max-w-[9rem] truncate">{note}</span>
				</span>
			) : null}
		</span>
	);
}
