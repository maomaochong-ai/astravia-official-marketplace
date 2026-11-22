import { useTranslation } from "@astravia-org/plugin-sdk";
import { useEffect, useMemo, useRef, useState } from "react";
import { AiButton } from "../shell/ai-button";
import { Card } from "../shell/card";
import { Icon } from "../shell/icon";
import { Markdown } from "../shell/markdown";
import { ContextMenu } from "../shell/context-menu";
import { PageHeader } from "../shell/page-header";
import { Spinner } from "../shell/spinner";
import type { DocEntry } from "../../services/docs";
import type { PageProps } from "./overview";
import { DOC_GROUPS } from "../../services/docs";
import { usePanelMenu } from "../../hooks/use-panel-menu";
import { downloadMarkdown, safeFileName } from "../../services/download";

/**
 * 文档体积。四舍五入到整 KB 时，几百字节的小文件会显示成「0 KB」——
 * 那不是「空」，只是不足一格，所以写成 <1 KB。
 */
function kilobytes(bytes: number): string {
	if (bytes < 1024) return "<1 KB";
	return `${Math.round(bytes / 1024)} KB`;
}

/*
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
	// 连读：把本段拼成一份正文。null = 未开启（单篇模式）。
	const [reading, setReading] = useState<{ ids: string[]; text: string } | null>(null);
	// 右键菜单：坐标钳位与键盘交给共享的 ContextMenu（与案例库同一套）。
	const menu = usePanelMenu();

	/**
	 * 导出整份清单：把当前筛选下的每篇正文拼成一份 .md。
	 *
	 * 单篇导出只存在于右键菜单里——菜单是「知道它在那儿才找得到」的入口，而「把这一组
	 * 带走」是最常见的诉求。所以工具栏上放一个按钮，导的是**当前可见列表**：
	 * 筛选了什么就导什么，搜索结果也照此办理。
	 */
	const exportListing = async () => {
		const ids = listing ? listing.map(hit => hit.entry.id) : visibleGroups.flatMap(item => item.topics.flatMap(topic => topic.entries.map(doc => doc.id)));
		if (ids.length === 0) return;
		const parts = await Promise.all(
			ids.map(id => docs.readDocument(id).then(text => ({ id, text })).catch(() => null)),
		);
		const body = parts
			.filter((part): part is { id: string; text: string } => part !== null)
			.map(part => `<!-- ${part.id} -->\n\n${part.text}`)
			.join("\n\n---\n\n");
		if (!body.trim()) return;
		const name = safeFileName((topic ?? group ?? "docs") as string, "md");
		downloadMarkdown(name, `# ${filterLabel}\n\n${body}`);
		model.notify(t("menu.exported", { name }), "success");
	};

	/** 导出：把正文写成一个 .md，交给浏览器下载。不经过宿主，所以不需要额外权限。 */
	const exportEntry = async (id: string) => {
		const entry = docs.byId(id);
		if (!entry) return;
		// 正文来自域层（会按需解 gzip 包），不猜资源 URL。
		const text = await docs.readDocument(id).catch(() => null);
		if (!text) return;
		const name = safeFileName(entry.id.split("/").pop() ?? "doc", "md");
		downloadMarkdown(name, text);
		model.notify(t("menu.exported", { name }), "success");
	};

	/**
	 * 一棵文档树上的右键菜单。
	 *
	 * 分组是「先看、再带走、再问、最后杂项」—— 一列 5 个不分组的菜单，用户得逐行读；
	 * 分组之后只需要扫组名。导出分两档：这一篇，还是当前这一屏（含筛选与搜索）。
	 */
	const openDocMenu = (event: React.MouseEvent<HTMLElement>, id: string) => {
		const entry = docs.byId(id);
		menu.openAt(event, {
			heading: entry?.path ?? id,
			groups: [
				{ id: "open", items: [{ id: "preview", label: t("docs.menu.preview"), icon: "eye", run: () => setOpenId(id) }] },
				{
					id: "export",
					items: [
						{ id: "export", label: t("docs.menu.export"), icon: "save", run: () => void exportEntry(id) },
						{
							id: "export-listing",
							label: t("menu.exportIndex"),
							icon: "save",
							hint: String(listing?.length ?? total),
							run: () => void exportListing(),
						},
					],
				},
				{
					id: "chat",
					items: [
						{
							id: "explain",
							label: t("docs.menu.explain"),
							icon: "send",
							run: () => model.askText(`用 read_doc 读 ${id}，把它的方法步骤讲清楚：每一步的输入、产出与判据。`),
						},
						{
							id: "apply",
							label: t("docs.menu.apply"),
							icon: "play",
							run: () => model.askText(`按文档 ${id} 的步骤在当前样本上实际做一遍；每步给出可复核的命令或偏移。`),
						},
					],
				},
				{
					id: "more",
					items: [
						{
							id: "copy",
							label: t("menu.copyPath"),
							icon: "copy",
							run: () => {
								navigator.clipboard?.writeText(id).then(
									() => model.notify(t("menu.copied"), "success"),
									() => model.notify(t("menu.copyFailed"), "error"),
								);
							},
						},
					],
				},
			],
		});
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

	/**
	 * 同段条目：优先「同一子目录」，没有子目录时才用整组。
	 *
	 * 这是「层级很深」的解法：读者点开一篇之后，同一节里还有哪几篇必须一屏看得见，
	 * 而不是靠一条条点「下一条」摸过去。
	 */
	const siblings = useMemo(() => {
		if (!openEntry) return [];
		const byTopic = flat.filter(item => item.group === openEntry.group && item.topic === openEntry.topic);
		return byTopic.length > 1 ? byTopic : flat.filter(item => item.group === openEntry.group);
	}, [flat, openEntry]);

	// 外部 select（例如先例页的「战例研究」）之后要能直接看到正文：
	// 只看「选中项变了」这一次，不对「openId 为空」做出反应 —— 否则关掉弹窗会立即被重开。
	//
	// 首帧先把「当前选中」记下来，再只在**之后**的选中上开弹窗。
	//
	// 上一版把初始值写成 `docs.selected?.id ?? null`：索引是异步加载的，首帧
	// `selected` 还是 null，于是 useDocs 加载完后自己选中的第一篇被当成「外部选中」，
	// 弹窗在用户没点任何东西时就弹了出来。这里用两个 ref 把「已播种」与「已打开的 id」
	// 分开：播种只发生一次，且不触发打开。
	const seeded = useRef(false);
	const openedFor = useRef<string | null>(null);
	useEffect(() => {
		const id = docs.selected?.id ?? null;
		if (!seeded.current) {
			// 首帧只播种，不开窗：这一条是 useDocs 加载完后自己选中的。
			seeded.current = true;
			openedFor.current = id;
			return;
		}
		// 之后的选中变化都来自外部跳转（先例页的「战例研究」等），那时应当直接看正文。
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
								// 子目录 id 可能是空串（文件直接位于组根）：那种不是「一个子目录」，
								// 渲染出来就是一行只有计数的空行 —— 截图里那个孤零零的「5」。
								const topics = (docs.groups.find(entry => entry.id === item.id)?.topics ?? []).filter(sub => sub.id.trim().length > 0);
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

					{/* 导出：导的是**当前可见清单**（筛选/搜索结果照此办理），不是整个语料。 */}
					<button
						type="button"
						onClick={() => void exportListing()}
						title={t("docs.exportHint")}
						className="flex shrink-0 items-center gap-1 rounded-md border border-line-subtle px-1.5 py-1 text-[10.5px] text-text-2 transition-colors hover:bg-surface-hover hover:text-text"
					>
						<Icon name="save" className="size-3" />
						{t("docs.export")}
					</button>
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
										onContextMenu={event => openDocMenu(event, hit.entry.id)}
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
												onContextMenu={event => openDocMenu(event, doc.id)}
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

			{/* 右键菜单：动作分组与键盘都由共享组件负责，与案例库同一套。 */}
			<ContextMenu menu={menu.menu} onClose={menu.close} />

			<DocPreview
				open={openId !== null}
				entry={openEntry}
				body={reading ? reading.text : docs.body}
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
				siblings={reading ? [] : siblings}
				onJump={id => {
					setReading(null);
					docs.select(id);
					setOpenId(id);
				}}
				reading={reading !== null}
				onReadAloud={() => {
					if (reading) {
						setReading(null);
						return;
					}
					// 一次读完本段：顺序取正文，段间用标题分隔。20 篇封顶——
					// 再多就不是「读一段」，而是把整个语料倒进 DOM。
					const picked = siblings.slice(0, 20);
					void Promise.all(
						picked.map(item => docs.readDocument(item.id).then(text => ({ item, text })).catch(() => null)),
					).then(parts => {
						const text = parts
							.filter((part): part is { item: (typeof picked)[number]; text: string } => part !== null)
							.map(part => `# ${part.item.title}\n\n${part.text}`)
							.join("\n\n---\n\n");
						setReading({ ids: picked.map(item => item.id), text });
					});
				}}
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
	siblings,
	onJump,
	onReadAloud,
	reading,
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
	/** 同一段（组或子目录）的条目：给目录用，省掉「一条条点下一条」。 */
	siblings: readonly DocEntry[];
	onJump(id: string): void;
	/** 连读本段：把整段拼成一屏，滚动读完。 */
	onReadAloud(): void;
	reading: boolean;
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
			if (event.key === "Escape") {
				event.stopPropagation();
				onClose();
				return;
			}
			// 翻页键：读一篇文章时最常见的是「下一篇」，不该只能去点按钮。
			if (event.key === "ArrowRight" || event.key === "j") {
				event.preventDefault();
				if (index < total - 1) onStep(index + 1);
			} else if (event.key === "ArrowLeft" || event.key === "k") {
				event.preventDefault();
				if (index > 0) onStep(index - 1);
			}
		};
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("keydown", onKey);
			restoreTo.current?.focus();
		};
	}, [open, onClose, index, total, onStep]);

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
						{/* 连读：一次读完本段，不用点「下一条」。 */}
						<button
							type="button"
							aria-pressed={reading}
							onClick={onReadAloud}
							title={t("docs.reader.continuousHint", { count: siblings.length })}
							className={`rounded-md border px-1.5 py-0.5 text-[10.5px] transition-colors ${
								reading ? "border-accent/50 bg-accent-soft text-accent" : "border-line-subtle text-text-2 hover:bg-surface-hover"
							}`}
						>
							{t("docs.reader.continuous")}
						</button>
						<button
							type="button"
							disabled={index <= 0}
							onClick={() => onStep(index - 1)}
							title={t("docs.reader.prevHint")}
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

				<div className="flex min-h-0 flex-1">
					{/* 目录：同段的全部条目一屏可见。窄面板折叠成一行下拉。 */}
					{siblings.length > 1 ? (
						<nav
							aria-label={t("docs.reader.toc")}
							className="fb-scroll hidden w-[180px] shrink-0 overflow-y-auto border-e border-line-subtle px-1.5 py-2 @min-[560px]:block"
							data-testid="docs-toc"
						>
							<div className="px-1 pb-1 text-[9.5px] uppercase tracking-wider text-text-4">{t("docs.reader.toc")}</div>
							{siblings.map((item, order) => (
								<button
									key={item.id}
									type="button"
									onClick={() => onJump(item.id)}
									aria-current={item.id === entry.id ? "true" : undefined}
									data-doc-id={item.id}
									className={`flex w-full items-baseline gap-1.5 rounded px-1.5 py-1 text-left text-[10.5px] transition-colors ${
										item.id === entry.id ? "bg-accent-soft text-accent" : "text-text-3 hover:bg-surface-hover hover:text-text"
									}`}
								>
									<span className="shrink-0 font-mono text-[9.5px] tabular-nums opacity-70">{order + 1}</span>
									<span className="min-w-0 flex-1 fb-wrap">{item.title}</span>
								</button>
							))}
						</nav>
					) : null}

					<div className="fb-scroll min-h-0 flex-1 overflow-y-auto px-4 py-3" data-testid="docs-body">
						{error ? (
							<p className="py-6 text-center text-[11.5px] text-text-4">{error}</p>
						) : loading ? (
							<div className="flex items-center justify-center gap-2 py-10 text-[11.5px] text-text-4">
								<Spinner className="size-3" />
								{t("docs.reader.loading")}
							</div>
						) : body !== null ? (
							<>
								{/* 连读模式下这一段的所有文档已经在同一个滚动区里，标题即分隔。 */}
								{reading ? <p className="pb-2 text-[10.5px] text-text-4">{t("docs.reader.continuousNote", { count: siblings.length })}</p> : null}
								<Markdown source={body} />
							</>
						) : null}
					</div>
				</div>
			</div>
		</div>
	);
}
