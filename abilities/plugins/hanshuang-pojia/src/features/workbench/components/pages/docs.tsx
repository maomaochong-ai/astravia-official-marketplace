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

/**
 * 文档体积。四舍五入到整 KB 时，几百字节的小文件会显示成「0 KB」——
 * 那不是「空」，只是不足一格，所以写成 <1 KB。
 */
function kilobytes(bytes: number): string {
	if (bytes < 1024) return "<1 KB";
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

	// 筛选位置存在 model 里：切到案例视图会卸载这一页，本地 state 会把筛选悄悄清掉。
	const { group, topic } = model.knowledge;
	const selectGroup = (next: string | null) => model.patchKnowledge({ group: next, topic: null });
	const selectTopic = (next: string | null) => model.patchKnowledge({ topic: next });
	// 原生 <details> 不响应内部点击：选完必须显式收起，否则菜单一直挂在工具栏上。
	const filterRef = useRef<HTMLDetailsElement | null>(null);
	const closeFilter = () => {
		if (filterRef.current) filterRef.current.open = false;
	};
	const [openId, setOpenId] = useState<string | null>(null);
	// 右键菜单：只存坐标与目标 id，动作都在渲染时决定。
	const [menu, setMenu] = useState<{ left: number; top: number; id: string } | null>(null);
	/**
	 * 右键坐标换成「相对面板」的坐标。
	 *
	 * 之前用的是 fixed + clientX/Y：面板贴在窗口右侧时，菜单会画到宿主界面上。
	 * 现在换成 absolute（与预览弹窗同一基准 = 面板根的定位上下文），并在面板内收边：
	 * 菜单永远落在这一格里，既不越界，也不会被文档列表的滚动容器裁掉（它是 .fb-page 的兄弟）。
	 */
	const openMenuAt = (event: React.MouseEvent<HTMLElement>, id: string) => {
		event.preventDefault();
		const root = (event.currentTarget as HTMLElement).closest<HTMLElement>("[data-panel-root]");
		const rect = root?.getBoundingClientRect();
		const WIDTH = 176;
		const HEIGHT = 168;
		const left = event.clientX - (rect?.left ?? 0);
		const top = event.clientY - (rect?.top ?? 0);
		setMenu({
			left: Math.max(8, Math.min(left, (rect?.width ?? 320) - WIDTH - 8)),
			top: Math.max(8, Math.min(top, (rect?.height ?? 480) - HEIGHT - 8)),
			id,
		});
	};

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
	const visibleGroups = (group ? docs.groups.filter(item => item.id === group) : docs.groups).map(entry => ({
		...entry,
		topics: topic ? entry.topics.filter(item => item.id === topic) : entry.topics,
	}));

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
	// 摘要与卡标题都沿用这一个名字：两处各写一遍迟早会写岔。
	const groupLabel = t(DOC_GROUPS.find(entry => entry.id === group)?.labelKey ?? "docs.group.kb");
	const filterLabel = topic ? `${groupLabel} / ${topic}` : groupLabel;

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
				{/* 工具栏：搜索 + 分级筛选 + 计数。与案例页同一套间距；窄面板换行而不是把搜索框挤没。 */}
				<div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1.5 rounded-xl bg-surface-2 px-3 py-2 ring-1 ring-line-subtle">
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

					<details ref={filterRef} className="fb-menu relative shrink-0">
						<summary
							className={`flex cursor-pointer list-none items-center gap-1 rounded-md border px-1.5 py-1 text-[10.5px] transition-colors ${
								filterOpen ? "border-accent/40 bg-accent-soft text-accent" : "border-line-subtle text-text-2 hover:bg-surface-hover"
							}`}
						>
							<Icon name="filter" className="size-3" />
							<span className="max-w-[160px] fb-wrap">
								{filterOpen ? filterLabel : t("docs.filter")}
							</span>
						</summary>
						<div className="absolute end-0 top-full z-30 mt-1 max-h-[60vh] w-56 overflow-y-auto rounded-lg bg-surface-2 p-1 shadow-lg ring-1 ring-line-strong">
							<button
								type="button"
								onClick={() => {
									selectGroup(null);
									closeFilter();
								}}
								className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[11.5px] ${
									group === null ? "bg-accent-soft text-accent" : "text-text-2 hover:bg-surface-hover"
								}`}
							>
								<span className="min-w-0 flex-1 fb-wrap">{t("docs.group.all")}</span>
								<span className="font-mono text-[9.5px] text-text-4">{total}</span>
							</button>
							{groupCounts.map(item => {
								const open = item.id === group;
								const label = t(DOC_GROUPS.find(entry => entry.id === item.id)?.labelKey ?? "docs.group.kb");
								const topics = docs.groups.find(entry => entry.id === item.id)?.topics ?? [];
								return (
									<div key={item.id}>
										{/* 再点一次已选中的组：先退子目录，再退组。 */}
										<button
											type="button"
											onClick={() => selectGroup(open ? (topic === null ? null : item.id) : item.id)}
											className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[11.5px] ${
												open ? "bg-accent-soft text-accent" : "text-text-2 hover:bg-surface-hover"
											}`}
										>
											<span className="min-w-0 flex-1 fb-wrap">{label}</span>
											<span className="font-mono text-[9.5px] text-text-4">{item.count}</span>
										</button>
										{/* 第二级：子目录。指南页承诺的「语料组与子目录两级筛选」落在这里。 */}
										{open
											? topics.map(sub => (
													<button
														key={sub.id}
														type="button"
														onClick={() => {
															selectTopic(topic === sub.id ? null : sub.id);
															closeFilter();
														}}
														className={`flex w-full items-center gap-2 rounded py-1 pe-2 ps-6 text-left text-[10.5px] ${
															topic === sub.id ? "bg-accent-soft text-accent" : "text-text-3 hover:bg-surface-hover hover:text-text-2"
														}`}
													>
														<span className="min-w-0 flex-1 fb-wrap font-mono">{sub.id}</span>
														<span className="font-mono text-[9.5px] text-text-4">{sub.entries.length}</span>
													</button>
												))
											: null}
									</div>
								);
							})}
						</div>
					</details>

					<span className="ms-auto flex shrink-0 items-center gap-1 font-mono text-[10.5px] text-text-4">
						{docs.searching ? <Spinner className="size-3" /> : null}
						{listing ? listing.length : docs.totals.documents}
					</span>
				</div>

				{/* 目录：吃满主区，分组两级缩进。 */}
				<Card
					testId="docs-list-card"
					title={listing ? t("docs.search.results") : filterOpen ? filterLabel : t("docs.nav.title")}
					bodyClassName="p-0"
					fill
				>
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
										onContextMenu={event => openMenuAt(event, hit.entry.id)}
										className="flex w-full flex-col gap-0.5 border-b border-line-subtle px-3 py-1.5 text-left last:border-0 hover:bg-surface-hover"
									>
										<span className="w-full fb-wrap text-[11.5px] text-text">{hit.entry.title}</span>
										<span className="w-full fb-wrap font-mono text-[10.5px] text-text-4">{hit.entry.id}</span>
										{hit.snippet ? <span className="line-clamp-3 w-full text-[10.5px] leading-snug text-text-3" title={hit.snippet}>{hit.snippet}</span> : null}
									</button>
								))
							)
						) : !docs.ready ? (
							<div className="px-3 py-6 text-center text-[11.5px] text-text-4">{t("docs.index.loading")}</div>
						) : (
							visibleGroups.map(entry => (
								<div key={entry.id} className="border-b border-line-subtle last:border-0">
									<div className="bg-surface-2 px-3 py-1 text-[10.5px] font-semibold uppercase tracking-wide text-text-4">
										{t(DOC_GROUPS.find(item => item.id === entry.id)?.labelKey ?? "docs.group.kb")}
									</div>
									{entry.topics.map(topicEntry => (
										<div key={`${entry.id}-${topicEntry.id}`}>
											{topicEntry.id ? <div className="px-3 pt-1.5 pb-0.5 font-mono text-[10.5px] text-text-4">{topicEntry.id}</div> : null}
											{topicEntry.entries.map(doc => (
												<button
													key={doc.id}
													data-doc-id={doc.id}
													type="button"
													onClick={() => setOpenId(doc.id)}
													onContextMenu={event => openMenuAt(event, doc.id)}
													className="flex w-full items-center gap-2 px-3 py-1 text-left hover:bg-surface-hover"
												>
													<span className="min-w-0 flex-1 fb-wrap text-[11.5px] text-text">{doc.title}</span>
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
					<div className="absolute inset-0 z-40" onClick={() => setMenu(null)} onContextMenu={event => { event.preventDefault(); setMenu(null); }} />
					<div
						className="absolute z-50 w-44 overflow-hidden rounded-lg bg-surface-2 py-1 shadow-lg ring-1 ring-line-strong"
						style={{ left: menu.left, top: menu.top }}
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
	const dialog = useRef<HTMLDivElement | null>(null);
	const restoreTo = useRef<HTMLElement | null>(null);

	// Esc 关闭 + 打开时把焦点移进弹窗、关闭时还给触发它的按钮。
	// 只靠遮罩点击是不够的：键盘用户会一直 Tab 到遮罩后面的列表里，等于走丢。
	useEffect(() => {
		if (!open) return;
		restoreTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		dialog.current?.focus();
		const onKey = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			event.stopPropagation();
			onClose();
		};
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("keydown", onKey);
			restoreTo.current?.focus();
		};
	}, [open, onClose]);

	if (!open || !entry) return null;

	return (
		<div className="fb-overlay" onClick={onClose}>
			<div
				ref={dialog}
				role="dialog"
				aria-modal="true"
				aria-label={entry.title}
				tabIndex={-1}
				className="flex max-h-[88%] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-surface-2 ring-1 ring-line-strong outline-none"
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
						<div className="fb-wrap text-[12px] font-semibold text-text">{entry.title}</div>
						<div className="fb-wrap font-mono text-[10.5px] text-text-4">{entry.path}</div>
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
