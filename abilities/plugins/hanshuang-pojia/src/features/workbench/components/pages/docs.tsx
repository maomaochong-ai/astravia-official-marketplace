import { useTranslation } from "@astravia-org/plugin-sdk";
import { useEffect, useMemo, useRef, useState } from "react";
import { AiButton } from "../shell/ai-button";
import { Card } from "../shell/card";
import { Icon } from "../shell/icon";
import { Markdown } from "../shell/markdown";
import { PageHeader } from "../shell/page-header";
import { Spinner } from "../shell/spinner";
import type { DocEntry } from "../../services/docs";
import type { PageProps } from "./overview";
import { DOC_GROUPS } from "../../services/docs";

function kilobytes(bytes: number): string {
	return `${Math.round(bytes / 1024)} KB`;
}

/**
 * 文档页：**整宽的目录列表**，点一条开弹窗读正文。
 *
 * 上一版把「目录 + 正文」做成两栏，窄面板下正文被挤成一条、返回按钮又只翻了个布尔量，
 * 于是「点了看不到内容」。现在：
 *   · 目录吃满主区（不再和正文分宽度），分组按语料组 → 子目录两层缩进；
 *   · 点一行开弹窗，弹窗里是完整正文 + 层级返回（返回目录 / 上一条 / 下一条）；
 *   · 搜索覆盖正文（不再需要「标题 / 全文」两档切换，那个切换实际没人用）。
 */
export function DocsPage({ model, embedded = false }: PageProps & { embedded?: boolean }) {
	const { t } = useTranslation();
	const { docs, chat } = model;
	const listing = docs.hits;

	const [group, setGroup] = useState<string | null>(null);
	const [openId, setOpenId] = useState<string | null>(null);
	// 右键菜单：只存坐标与目标 id，动作都在渲染时决定。
	const [menu, setMenu] = useState<{ x: number; y: number; id: string } | null>(null);

	/** 导出：把正文写成一个 .md，交给浏览器下载。不经过宿主，所以不需要额外权限。 */
	const exportEntry = async (id: string) => {
		const entry = docs.byId(id);
		if (!entry) return;
		// 正文来自域层（会按需解 gzip 包），不猜资源 URL。
		const text = await docs.readDocument(id).catch(() => null);
		if (!text) return;
		const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement("a");
		anchor.href = url;
		anchor.download = `${entry.id.split("/").pop() ?? "doc"}.md`;
		anchor.click();
		URL.revokeObjectURL(url);
	};

	const groupCounts = docs.groups.map(item => ({ id: item.id, count: item.topics.reduce((sum, entry) => sum + entry.entries.length, 0) }));
	const total = groupCounts.reduce((sum, item) => sum + item.count, 0);
	const visibleGroups = group ? docs.groups.filter(item => item.id === group) : docs.groups;

	// 弹窗里的「上一条 / 下一条」按当前可见顺序走，不用另建一份导航状态。
	const flat = useMemo(() => visibleGroups.flatMap(item => item.topics.flatMap(topic => topic.entries)), [visibleGroups]);
	const openEntry = openId ? docs.byId(openId) : null;
	const openIndex = openId ? flat.findIndex(entry => entry.id === openId) : -1;

	// 外部 select（例如先例页的「战例研究」）之后要能直接看到正文：
	// 只看「选中项变了」这一次，不对「openId 为空」做出反应 —— 否则关掉弹窗会立即被重开。
	const openedFor = useRef<string | null>(null);
	useEffect(() => {
		const id = docs.selected?.id ?? null;
		if (id && openedFor.current !== id) {
			openedFor.current = id;
			setOpenId(id);
		}
	}, [docs.selected]);

	const filterOpen = group !== null;

	return (
		<>
			{embedded ? null : (
				<PageHeader
					title={t("page.docs.title")}
					description={t("page.docs.lead")}
					actions={<AiButton label={t("ai.docs")} busy={chat.sending} onClick={() => model.ask("docs")} />}
				/>
			)}

			<div className="fb-page">
				{/* 工具栏：搜索 + 一个分级筛选菜单 + 计数。高度固定一行。 */}
				<div className="flex shrink-0 flex-nowrap items-center gap-1.5 rounded-xl bg-surface-2 px-2.5 py-1.5 ring-1 ring-line-subtle">
					<div className="relative min-w-0 flex-1">
						<Icon name="search" className="pointer-events-none absolute start-2 top-1/2 size-3 -translate-y-1/2 text-text-4" />
						<input
							value={docs.query}
							onChange={event => docs.setQuery(event.target.value)}
							placeholder={t("docs.search.placeholder")}
							aria-label={t("docs.search.placeholder")}
							className="w-full rounded-md border border-line-subtle bg-surface py-1 pe-2 ps-7 text-[11.5px] text-text outline-none placeholder:text-text-4 focus:border-accent"
						/>
					</div>

					<details className="fb-menu relative shrink-0">
						<summary
							className={`flex cursor-pointer list-none items-center gap-1 rounded-md border px-1.5 py-1 text-[10.5px] transition-colors ${
								filterOpen ? "border-accent/40 bg-accent-soft text-accent" : "border-line-subtle text-text-2 hover:bg-surface-hover"
							}`}
						>
							<Icon name="filter" className="size-3" />
							<span className="max-w-[120px] truncate">
								{filterOpen ? t(DOC_GROUPS.find(entry => entry.id === group)?.labelKey ?? "docs.group.kb") : t("docs.filter")}
							</span>
						</summary>
						<div className="absolute end-0 top-full z-30 mt-1 max-h-[60vh] w-56 overflow-y-auto rounded-lg bg-surface-2 p-1 shadow-lg ring-1 ring-line-strong">
							<button
								type="button"
								onClick={() => setGroup(null)}
								className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[11px] ${
									group === null ? "bg-accent-soft text-accent" : "text-text-2 hover:bg-surface-hover"
								}`}
							>
								<span className="min-w-0 flex-1 truncate">{t("docs.group.all")}</span>
								<span className="font-mono text-[9.5px] text-text-4">{total}</span>
							</button>
							{groupCounts.map(item => (
								<button
									key={item.id}
									type="button"
									onClick={() => setGroup(item.id === group ? null : item.id)}
									className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[11px] ${
										group === item.id ? "bg-accent-soft text-accent" : "text-text-2 hover:bg-surface-hover"
									}`}
								>
									<span className="min-w-0 flex-1 truncate">{t(DOC_GROUPS.find(entry => entry.id === item.id)?.labelKey ?? "docs.group.kb")}</span>
									<span className="font-mono text-[9.5px] text-text-4">{item.count}</span>
								</button>
							))}
						</div>
					</details>

					<span className="ms-auto flex shrink-0 items-center gap-1 font-mono text-[10px] text-text-4">
						{docs.searching ? <Spinner className="size-3" /> : null}
						{listing ? listing.length : docs.totals.documents}
					</span>
				</div>

				{/* 目录：吃满主区，分组两级缩进。 */}
				<Card testId="docs-list-card" title={listing ? t("docs.search.results") : t("docs.nav.title")} bodyClassName="p-0" fill>
					<div data-testid="docs-list" className="fb-scroll fb-fill-scroll overflow-y-auto">
						{listing ? (
							listing.length === 0 ? (
								<div className="px-3 py-6 text-center text-[11.5px] text-text-4">
									{docs.searching ? t("docs.search.running") : t("docs.search.empty")}
								</div>
							) : (
								listing.map(hit => (
									<button
										key={hit.entry.id}
										type="button"
										onClick={() => setOpenId(hit.entry.id)}
										onContextMenu={event => {
											event.preventDefault();
											setMenu({ x: event.clientX, y: event.clientY, id: hit.entry.id });
										}}
										className="flex w-full flex-col gap-0.5 border-b border-line-subtle px-3 py-1.5 text-left last:border-0 hover:bg-surface-hover"
									>
										<span className="w-full truncate text-[11.5px] text-text">{hit.entry.title}</span>
										<span className="w-full truncate font-mono text-[10px] text-text-4">{hit.entry.id}</span>
										{hit.snippet ? <span className="line-clamp-2 w-full text-[10.5px] leading-snug text-text-3">{hit.snippet}</span> : null}
									</button>
								))
							)
						) : !docs.ready ? (
							<div className="px-3 py-6 text-center text-[11.5px] text-text-4">{t("docs.index.loading")}</div>
						) : (
							visibleGroups.map(entry => (
								<div key={entry.id} className="border-b border-line-subtle last:border-0">
									<div className="bg-surface-2 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-text-4">
										{t(DOC_GROUPS.find(item => item.id === entry.id)?.labelKey ?? "docs.group.kb")}
									</div>
									{entry.topics.map(topicEntry => (
										<div key={`${entry.id}-${topicEntry.id}`}>
											{topicEntry.id ? <div className="px-3 pt-1.5 pb-0.5 font-mono text-[10px] text-text-4">{topicEntry.id}</div> : null}
											{topicEntry.entries.map(doc => (
												<button
													key={doc.id}
													data-doc-id={doc.id}
													type="button"
													onClick={() => setOpenId(doc.id)}
													onContextMenu={event => {
														event.preventDefault();
														setMenu({ x: event.clientX, y: event.clientY, id: doc.id });
													}}
													className="flex w-full items-center gap-2 px-3 py-1 text-left hover:bg-surface-hover"
												>
													<span className="min-w-0 flex-1 truncate text-[11.5px] text-text">{doc.title}</span>
													<span className="shrink-0 font-mono text-[9.5px] text-text-4">{kilobytes(doc.bytes)}</span>
												</button>
											))}
										</div>
									))}
								</div>
							))
						)}
					</div>
				</Card>
			</div>

			{/* 右键菜单：文档树上的四条常用动作，都在面板内完成。 */}
			{menu ? (
				<>
					<div className="fixed inset-0 z-40" onClick={() => setMenu(null)} onContextMenu={event => { event.preventDefault(); setMenu(null); }} />
					<div
						className="fixed z-50 w-44 overflow-hidden rounded-lg bg-surface-2 py-1 shadow-lg ring-1 ring-line-strong"
						style={{ left: Math.min(menu.x, window.innerWidth - 190), top: Math.min(menu.y, window.innerHeight - 170) }}
						data-testid="docs-menu"
					>
						{(
							[
								["preview", () => setOpenId(menu.id)],
								["export", () => void exportEntry(menu.id)],
								["explain", () => model.askText(`用 read_doc 读 ${menu.id}，把它的方法步骤讲清楚：每一步的输入、产出与判据。`)],
								["apply", () => model.askText(`按文档 ${menu.id} 的步骤在当前样本上实际做一遍；每步给出可复核的命令或偏移。`)],
							] as const
						).map(([key, run]) => (
							<button
								key={key}
								type="button"
								onClick={() => {
									run();
									setMenu(null);
								}}
								className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11.5px] text-text-2 transition-colors hover:bg-accent-soft hover:text-accent"
							>
								<Icon name={key === "export" ? "save" : key === "preview" ? "book" : key === "apply" ? "play" : "send"} className="size-3 shrink-0 text-text-4" />
								{t(`docs.menu.${key}`)}
							</button>
						))}
					</div>
				</>
			) : null}

			<DocPreview
				open={openId !== null}
				entry={openEntry}
				body={docs.body}
				loading={docs.loading}
				error={docs.error}
				onClose={() => setOpenId(null)}
				onStep={next => {
					const target = flat[next];
					if (target) {
						docs.select(target.id);
						setOpenId(target.id);
					}
				}}
				index={openIndex}
				total={flat.length}
			/>
		</>
	);
}

/**
 * 预览弹窗：`absolute` 相对面板根，不用 `fixed` —— 面板只是活动栏的一格，
 * `fixed` 会以整个窗口为基准，宽窗口下弹窗跑到面板外面去。
 */
function DocPreview({
	open,
	entry,
	body,
	loading,
	error,
	onClose,
	onStep,
	index,
	total,
}: {
	open: boolean;
	entry: DocEntry | null;
	body: string | null;
	loading: boolean;
	error: string | null;
	onClose(): void;
	onStep(next: number): void;
	index: number;
	total: number;
}) {
	const { t } = useTranslation();
	if (!open || !entry) return null;

	return (
		<div className="fb-overlay" onClick={onClose}>
			<div
				className="flex max-h-[88%] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-surface-2 ring-1 ring-line-strong"
				onClick={event => event.stopPropagation()}
				data-testid="doc-preview"
			>
				<div className="flex shrink-0 items-start gap-2 border-b border-line-subtle px-3.5 py-2">
					<button
						type="button"
						onClick={onClose}
						className="inline-flex shrink-0 items-center gap-1 rounded-md border border-line-subtle px-1.5 py-0.5 text-[10.5px] text-text-2 transition-colors hover:bg-surface-hover hover:text-text"
					>
						<Icon name="chevron" className="size-3 rotate-180" />
						{t("docs.preview.back")}
					</button>
					<div className="min-w-0 flex-1">
						<div className="truncate text-[12.5px] font-semibold text-text">{entry.title}</div>
						<div className="truncate font-mono text-[10px] text-text-4">{entry.path}</div>
					</div>
					<div className="flex shrink-0 items-center gap-1">
						<button
							type="button"
							disabled={index <= 0}
							onClick={() => onStep(index - 1)}
							className="rounded-md border border-line-subtle px-1.5 py-0.5 text-[10.5px] text-text-2 transition-colors hover:bg-surface-hover disabled:opacity-35"
						>
							{t("docs.preview.prev")}
						</button>
						<button
							type="button"
							disabled={index < 0 || index >= total - 1}
							onClick={() => onStep(index + 1)}
							className="rounded-md border border-line-subtle px-1.5 py-0.5 text-[10.5px] text-text-2 transition-colors hover:bg-surface-hover disabled:opacity-35"
						>
							{t("docs.preview.next")}
						</button>
					</div>
				</div>

				<div className="fb-scroll min-h-0 flex-1 overflow-y-auto px-4 py-3" data-testid="docs-body">
					{error ? (
						<p className="py-6 text-center text-[11.5px] text-text-4">{error}</p>
					) : loading ? (
						<div className="flex items-center justify-center gap-2 py-10 text-[11.5px] text-text-4">
							<Spinner className="size-3" />
							{t("docs.reader.loading")}
						</div>
					) : body !== null ? (
						<Markdown source={body} />
					) : null}
				</div>
			</div>
		</div>
	);
}
