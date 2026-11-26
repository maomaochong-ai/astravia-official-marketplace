import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type JSX } from "react";
import { useActiveConversation, useTranslation } from "@astravia-org/plugin-sdk";
import { renderLogo, resolveMark } from "../../../domain/engine/compose";
import { newDesignId, type DesignRecord } from "../../../domain/history-store";
import { kitSlug } from "../../../domain/brand-kit";
import { previewUrl } from "../../../domain/render-png";
import { getPluginContext, reportError } from "../../../plugin-context";
import { FOCUS_RING } from "../../../shared/styles/tokens";
import { IconClose, IconEye, IconHistory, IconRename, IconReset } from "../../../shared/components/icons";
import { useCanvasNotes } from "../hooks/use-canvas-notes";
import { useDesignHistory } from "../hooks/use-design-history";
import { useGeneration } from "../hooks/use-generation";
import { useLogoForm } from "../hooks/use-logo-form";
import { savePngFile, saveSvgFile } from "../services/export-files";
import { claimPendingDesignIds, onPendingDesignChanged, peekPendingDesignIds } from "../pending-design";
import { getHistoryStore } from "../../../plugin-context";
import { publishCanvasSpec } from "../canvas-prompt";
import { useRasterUrl } from "../hooks/use-raster-url";
import { useNotesHandoff } from "../hooks/use-notes-handoff";
import { invalidateDesignDocuments, listDesignDocuments, type DesignDocumentRef } from "../../../domain/design-library";
import { readManifest } from "../../../domain/design-folder";
import { cachedRender } from "../preview-cache";
import { describeSpec } from "../describe-spec";
import { AiSettingsDialog } from "./ai-settings-dialog";
import { BrandKitDialog } from "./brand-kit-dialog";
import { CanvasDock } from "./canvas-dock";
import { CanvasInspector } from "./canvas-inspector";
import { CanvasSurface } from "./canvas-surface";
import { VariantGrid } from "./variant-grid";
import { DesignSwitcher } from "./design-switcher";
import { VersionsSheet } from "./versions-sheet";
import { specForVersion } from "../../../domain/design-versions";
import { ResultGrid } from "./result-grid";



/**
 * The tab: a canvas, not a form.
 *
 * Same anatomy as the reference design plugin, for the same reason — a 400–600 px
 * side panel has room for exactly one subject:
 *
 *   stage (fixed, fills)      · art, click-to-pin, pan-free single frame
 *   floating top-left         · brand + engine badge (title slot)
 *   floating top-right        · history / AI source / reset
 *   floating bottom dock      · generate · surprise · design panel · notes · kit
 *   right inspector           · the form or the notes list, as a rail
 *
 * The previous build was a single scrolling column: the canvas scrolled away under
 * a five-screen form, and the primary verb lived at the bottom of it. Nothing in
 * this file may reintroduce page-level scrolling — the stage is `flex-1 min-h-0`
 * and only the inspector scrolls.
 */
export function LogoCanvas(): JSX.Element {
	const { t, locale } = useTranslation();
	// The panel belongs to one conversation. Everything that can reach the *wrong*
	// conversation (pending hand-off, composer decoration) is keyed by this cwd.
	const cwd = useActiveConversation().cwd;
	const form = useLogoForm();
	const history = useDesignHistory({
		saveFailed: t("error.historyLoad"),
		updateFailed: t("error.historyUpdate"),
		removeFailed: t("error.historyRemove"),
		clearFailed: t("error.historyClear"),
	});
	const generation = useGeneration({
		aiUnavailable: t("notify.aiUnavailable"),
		aiNoProvider: t("notify.aiNoProvider"),
		aiFailed: t("notify.aiFailed"),
		aiFailedHint: t("notify.aiFailedHint"),
		localFailed: t("notify.localFailed"),
		aiDone: (count) => t("notify.aiDone", { count }),
		aiPartial: (failed) => t("notify.aiPartial", { failed }),
	});

	// 选中的稿 + 本批 id 必须先于 handoff 声明：备注的分流依赖它们。
	const [selectedId, setSelectedId] = useState<string | null>(null);
	/** 本批（一次工具调用）产出的全部稿 id；缩略图轨据此渲染。 */
	const [batchIds, setBatchIds] = useState<string[]>([]);
	/** 本批多张时默认铺网格；「放大」某张后进入单张画布（备注/缩放在那里）。 */
	const [staged, setStaged] = useState(false);
	/** 手动重扫设计包清单：用户刚在对话里生成一份，切换器要能立刻看到。 */
	const [forceScan, setForceScan] = useState(false);
	// Reference-aligned hand-off: it knows when to create a session, when the agent is
		// already running, and when the conversation belongs to another project.
	const handoff = useNotesHandoff(
		cwd,
		// “对话式修改”要能真的改到这份稿：把参数一起交底，agent 才不会另猜一套。
		describeSpec(form.spec),
		// 备注按稿分流：面板上看到的集合 = 会被发出去的集合。
		selectedId,
	);
	const notes = useCanvasNotes({
		sendFailed: t("error.notesSend"),
		addFailed: t("error.notesAdd"),
		removeFailed: t("error.notesRemove"),
	});

	const [openFolder, setOpenFolder] = useState<string | null>(null);
	const [docs, setDocs] = useState<DesignDocumentRef[]>([]);
	const [docsLoading, setDocsLoading] = useState(true);
	const [kitRecord, setKitRecord] = useState<DesignRecord | null>(null);
	const [aiOpen, setAiOpen] = useState(false);
	const [historyOpen, setHistoryOpen] = useState(false);
	const [inspectorOpen, setInspectorOpen] = useState(false);
	const [editingName, setEditingName] = useState(false);
	const [nameDraft, setNameDraft] = useState("");
	const [inspectorTab, setInspectorTab] = useState<"design" | "notes">("design");

	const subject = useMemo(() => resolveMark(form.spec).subject, [form.spec]);
	// Typing stays at caret speed; the mark repaints on the next idle slot.
	const deferredSpec = useDeferredValue(form.spec);
	// Cached by spec: the stage and the rail ask for the same renders repeatedly, and
	// each miss costs an SVG build plus a URI-encoded copy of it.
	const preview = useMemo(() => cachedRender(deferredSpec).url, [deferredSpec]);
	const canGenerate = Boolean(form.spec.brandName.trim()) || form.spec.type === "wordmark";
	const visibleNotes = notes.notes.filter(
		(note) =>
			// 品牌级备注（designId === null）跨稿共用；挂在某一稿上的备注还要同一工作区。
			(note.designId === null || note.designId === selectedId) && (note.cwd == null || note.cwd === cwd),
	);
	const pendingCount = visibleNotes.filter((note) => note.status === "pending").length;

	useEffect(() => {
		if (generation.lastCreatedId) setSelectedId(generation.lastCreatedId);
	}, [generation.lastCreatedId]);

	/**
	 * 工作区里的设计稿清单。
	 *
	 * 首次等 `history.ready` 再扫：面板刚挂上是读取高峰，此时再递归列文件只会拖慢首帧。
	 * 生成完一份新稿后（`lastCreatedId` 变化）清缓存重扫，切换器立刻能看到它。
	 */
	useEffect(() => {
		if (!history.ready) return;
		let alive = true;
		setDocsLoading(true);
		void listDesignDocuments(getPluginContext().fs, cwd, forceScan)
			.then(items => {
				if (alive) setDocs(items);
			})
			.finally(() => {
				if (alive) setDocsLoading(false);
			});
		return () => {
			alive = false;
		};
	}, [history.ready, cwd, generation.lastCreatedId, forceScan]);

	/**
	 * 切到另一份设计稿。
	 *
	 * 直接读它的 `.astravia-log` 并载入 spec，不新建历史记录 —— 用户只是在看已有的稿，
	 * 不是又生成了一份。
	 */
	const openDocument = useCallback(
		async (doc: DesignDocumentRef) => {
			const manifest = await readManifest(getPluginContext().fs, doc.folder, doc.slug);
			if (!manifest) return;
			form.load(manifest.spec);
			setSelectedId(null);
			setOpenFolder(doc.folder);
		},
		[form],
	);

	/**
	 * 面板挂载自检：量一下自己占多大。
	 *
	 * “tab 打开了但里面什么都没有” 有两种成因：组件根本没挂载，或者挂载了但宿主给的
	 * 高度是 0（绝对定位的子元素全被裁掉）。后者单靠看界面分不出来，所以把面积打一行日志：
	 * 看到 `0×0` 就知道是布局问题，看到有尺寸却黑屏就是渲染问题。
	 */
	const rootRef = useRef<HTMLDivElement | null>(null);
	useEffect(() => {
		const node = rootRef.current;
		if (!node) return;
		const { offsetWidth: width, offsetHeight: height } = node;
		console.info("[logocreator] panel mounted", { width, height });
		if (height === 0) console.warn("[logocreator] the host gave the panel zero height; the min-height fallback is what is showing");
	}, []);

	// A tool created a design while the panel was closed → show that one. Opening the
	// tab again must not clobber half-finished work, so only an empty form is seeded.
	const claimedRef = useRef<string | null>(null);
	/** Pending ids we already waited on; a hand-off that never resolves is dropped, not kept. */
	const waitedRef = useRef<Set<string>>(new Set());
	const revealPending = useCallback(() => {
		// Peek, look the record up, and only then consume.
		//
		// Claiming first was a real defect: a tool writes the design and opens the tab; the
		// panel mounts and runs this before the store has hydrated the new record, the
		// lookup missed, and the id was already gone — so the canvas kept showing the
		// previous design. That is exactly the "image generated but the canvas did not
		// switch" report. Peeking keeps the hand-off alive until the record exists.
		const pendingIds = peekPendingDesignIds(cwd);
		const pendingId = pendingIds[0] ?? null;
		if (!pendingId || claimedRef.current === pendingId) return;
		if (!pendingId || claimedRef.current === pendingId) return;
		const record = history.items.find((item) => item.id === pendingId);
		if (!record) {
			// The store has not caught up (or the tool died between writing the id and the
			// record). Wait once for the next emit; if nothing arrives, drop the hand-off so a
			// later generation is not blocked by a stale one.
			if (!waitedRef.current.has(pendingId)) {
				waitedRef.current.add(pendingId);
				setTimeout(() => {
					if (peekPendingDesignIds(cwd)[0] === pendingId && !getHistoryStore().get(pendingId)) {
						claimPendingDesignIds(cwd);
					}
				}, 4000);
			}
			return;
		}
		claimedRef.current = pendingId;
		waitedRef.current.delete(pendingId);
		claimPendingDesignIds(cwd);
		// 整批交给缩略图轨：一次出三张就铺三张；主图仍是最后生成的那张。
		setBatchIds(pendingIds.filter((id) => getHistoryStore().get(id)));
		form.load(record.spec);
		setSelectedId(record.id);
	}, [cwd, history.items, form]);

	useEffect(() => {
		if (!history.ready) return;
		if (peekPendingDesignIds(cwd).length > 0) {
			revealPending();
			return;
		}
		if (form.spec.brandName) return;
		const latest = history.items[0];
		if (latest) {
			form.load(latest.spec);
			setSelectedId(latest.id);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [cwd, history.ready, history.items.length]);

	/**
	 * A design that arrives while the panel is open.
	 *
	 * The hand-off above covers "tool wrote it, then opened the tab". This covers the other
	 * half: the tab was already open when the agent generated something. Nothing selected yet
	 * (or the selection is an older record) → follow the newest **AI** record, because that is
	 * the one the conversation just produced. A deliberate selection of a vector design is
	 * never stolen: it has a brand name in the form and the check stops.
	 */
	useEffect(() => {
		if (!history.ready || peekPendingDesignIds(cwd).length > 0) return;
		const newest = history.items[0];
		if (!newest || newest.engine !== "ai") return;
		if (newest.id === selectedId) return;
		if (form.spec.brandName.trim() && selectedId) return;
		form.load(newest.spec);
		setSelectedId(newest.id);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [cwd, history.ready, history.items[0]?.id]);

	useEffect(() => onPendingDesignChanged(revealPending), [revealPending]);

	// Publish the open design so the composer chip can carry it into a prompt.
	useEffect(() => {
		publishCanvasSpec(cwd, form.spec);
	}, [cwd, form.spec]);

	/** The offline planner's bridge: three planned specs become three stored designs. */
	const handlePlan = async (candidates: { spec: typeof form.spec }[]) => {
		for (const candidate of candidates) {
			const rendered = renderLogo(candidate.spec);
			// The hook owns error reporting; the id is ours so the reveal can point at it.
			await history.add({ id: newDesignId(), spec: candidate.spec, engine: "local", subject: rendered.subject });
		}
		// Select the first candidate: the planner's order is the recommendation order.
		if (candidates[0]) form.load(candidates[0].spec);
	};

	const commitName = () => {
		setEditingName(false);
		const next = nameDraft.trim().slice(0, 48);
		if (next === form.spec.brandName) return;
		form.patch({ brandName: next });
		// Renaming the open design is also a rename of the history entry it came from,
		// otherwise the rail keeps showing the old label next to the new artwork.
		if (selectedId) void history.rename(selectedId, next);
	};

	const openInspector = (tab: "design" | "notes") => {
		setInspectorTab(tab);
		setInspectorOpen(true);
	};

	const handleSaveSvg = (record: DesignRecord) => {
		const ctx = getPluginContext();
		if (record.engine === "local") {
			void saveSvgFile(ctx.fs, record.spec, renderLogo(record.spec).svg).then((path) => {
				if (path) ctx.ui.notify({ message: t("notify.saved", { path }), variant: "success" });
			});
			return;
		}
		ctx.ui.notify({ message: t("notify.aiSvgUnavailable"), variant: "info" });
	};

	const handleSavePng = async (record: DesignRecord) => {
		const ctx = getPluginContext();
		if (record.engine === "local") {
			const path = await savePngFile(ctx.fs, record.spec, renderLogo(record.spec).svg, 2048);
			if (path) ctx.ui.notify({ message: t("notify.saved", { path }), variant: "success" });
			return;
		}
		if (!record.blobId) return;
		try {
			const blob = await ctx.storage.readBlob(record.blobId);
			if (!blob) throw new Error("The stored image is missing");
			const path = await ctx.fs.saveAs(`${kitSlug(record.spec)}-ai.png`, blob.data, "base64", {
				title: t("tile.savePng"),
				filters: [{ name: "PNG", extensions: ["png"] }],
			});
			if (path) ctx.ui.notify({ message: t("notify.saved", { path }), variant: "success" });
		} catch (cause) {
			reportError(t("notify.saveFailed"), cause);
		}
	};

	const selectedRecord = selectedId ? history.items.find((item) => item.id === selectedId) : undefined;
	// 本批记录按生成顺序解析；存储里查不到的（工具写了 id 但记录没落地）直接丢弃。
	const batchRecords = batchIds
		.map((id) => history.items.find((item) => item.id === id))
		.filter((item): item is NonNullable<typeof item> => Boolean(item));
	// Raster designs are drawn from their blob; vector ones from the spec.
	const rasterUrl = useRasterUrl(selectedRecord);
	// Auto-detected on mount (and after the AI dialog refreshes it): the dock shows the
	// image slot only when this is true.
	const imageAvailable = generation.providers.length > 0;

	/**
	 * 跑一批并把这一批交给画布。
	 *
	 * 上一版这里直接调 `generation.generate`：它只 `setLastCreatedId`（最后一张），
	 * 于是「面板生成 4 张」在画布上只会有 1 张——网格只对工具生成的批次生效。
	 * 现在把整批 id 拿回来，网格才真的是「这一批」。
	 */
	const runBatch = useCallback(
		async (options?: Parameters<typeof generation.generate>[1]) => {
			setStaged(false);
			const batch = await generation.generate(form.spec, options);
			if (batch.ids.length > 0) setBatchIds(batch.ids);
		},
		[generation, form.spec],
	);

	return (
		/*
		 * `h-full` 之外给一个**最小高度**：宿主的活动面板容器在某些布局下高度解析为 0，
		 * 而 `h-full` 在那种容器里也是 0 —— 整块画布的绝对定位子元素就被裁没了，
		 * 用户看到的是一块全黑的面板（实际发生过）。min-h 保证任何情况下都有可画的面积。
		 */
		<div ref={rootRef} className="relative flex h-full min-h-[320px] w-full flex-col overflow-hidden bg-background text-foreground">
			{/* Stage — the canvas fills it; nothing here scrolls. */}
			<div className="relative min-h-0 flex-1">
				{/*
				 * 一次生成多张时，画布主体就是这一批：铺成网格，点哪张选中哪张，
				 * 「放大」进单张画布（备注与缩放都在那里）。单张时退回原来的画布。
				 * 上一版把这一批放在 dock 上方，两者抢同一块底部空间、直接叠在一起。
				 */}
				{(history.ready && batchRecords.length > 1 && !staged) || generation.running ? (
					<VariantGrid
						records={batchRecords}
						selectedId={selectedId}
						onSelect={(record) => {
							form.load(record.spec);
							setSelectedId(record.id);
						}}
						onStage={(record) => {
							form.load(record.spec);
							setSelectedId(record.id);
							setStaged(true);
						}}
						// 生成中先铺骨架：格子数 = 本次设置要出几张。
						pending={generation.running ? generation.settings.variations : 0}
					/>
				) : (
					<div className="absolute inset-0 flex items-center justify-center p-4 pb-16">
						<div className="w-full max-w-[min(100%,34rem)]">
							{/*
							 * 首次打开：设计历史还在从宿主存储里读，先给一句「正在打开 Logo 设计引擎」。
							 * 第二次起存储已在本进程内 hydrate 完，`history.ready` 首帧就是 true，不会闪。
							 * 这不是装饰：面板刚从宿主滑出时如果直接画空白，用户会以为插件挂了。
							 */}
							{history.ready ? null : (
								<div data-testid="engine-skeleton" className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
									<span className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
									<span className="text-[11.5px]">{t("panel.openingEngine")}</span>
								</div>
							)}
							{history.ready ? (
							<CanvasSurface
								previewUrl={preview}
								alt={t("panel.previewAlt")}
								notes={visibleNotes}
								dark={form.spec.surface === "dark"}
								spec={form.spec}
								// Empty = nothing typed and nothing stored: show the cover, not a logo for
								// a brand called "Untitled".
								empty={!form.spec.brandName.trim() && !rasterUrl && history.items.length === 0}
								rasterUrl={rasterUrl}
								onPlace={async (point, text, scope, part) =>
									notes.add({ designId: selectedId, cwd, text, ...point, scope, part })
								}
							/>
							) : null}
						</div>
					</div>
				)}
			</div>


				{/*
				 * 标题区：左边是设计稿切换器 + 可改写的稿名。
				 * 设计稿是磁盘上的 `.astravia-log` 文件，一份文件一份稿。
				 *
				 * 侧栏打开时**不**隐藏这一行：改参数时看不到自己在改哪一版，
				 * 是这个面板最容易迷路的地方；只把右侧让出侧栏宽度。
				 */}
				<div
					data-testid="stage-title-slot"
					className={`absolute left-3 top-3 z-40 flex flex-wrap items-center gap-1 transition-[padding] ${
						inspectorOpen ? "pr-[clamp(15rem,88%,20rem)]" : "max-w-[calc(100%-5.5rem)]"
					}`}
				>
					<DesignSwitcher
						docs={docs}
						// 当前稿：优先用「打开过的包」（openFolder），再用品牌名匹配。
						current={
							openFolder ??
							docs.find(
								(doc) =>
									doc.slug ===
									selectedRecord?.spec.brandName?.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
							)?.folder ??
							null
						}
						loading={docsLoading}
						onSelect={(doc) => void openDocument(doc)}
						onRefresh={() => setForceScan((value) => !value)}
					/>
					{editingName ? (
						<input
							autoFocus
							value={nameDraft}
							onChange={(event) => setNameDraft(event.target.value)}
							onBlur={commitName}
							onKeyDown={(event) => {
								if (event.key === "Enter") commitName();
								if (event.key === "Escape") setEditingName(false);
							}}
							maxLength={48}
							aria-label={t("label.brandName")}
							className="min-w-0 rounded-md border border-ring bg-popover px-1.5 py-0.5 text-[12px] font-medium text-foreground outline-none"
						/>
					) : (
						<button
							type="button"
							onClick={() => {
								setNameDraft(form.spec.brandName);
								setEditingName(true);
							}}
							title={t("canvas.renameHint")}
							className="group flex min-w-0 items-center gap-1 rounded-md bg-popover/95 px-1.5 py-0.5 text-[12px] font-medium text-foreground shadow-sm ring-1 ring-border/60 hover:bg-accent"
						>
							<span className="truncate max-w-[9rem]">{form.spec.brandName || t("canvas.untitled")}</span>
							<IconRename className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
						</button>
					)}
				</div>

				{/* Action rail, floating top-right. */}
				<div
					className={`absolute right-2 top-2 z-40 flex items-center gap-0.5 rounded-lg border border-border/70 bg-popover/95 p-0.5 shadow-sm transition-opacity ${
						inspectorOpen ? "pointer-events-none opacity-0" : "opacity-100"
					}`}
				>
					{/*
					 * 历史（设计版本）只在 dock 里一个入口：
					 * 同一块面板两个按钮位、两个不同图标，是这一版最明显的冗余。
					 */}
					<button
						type="button"
						onClick={() => setAiOpen(true)}
						title={t("panel.ai")}
						aria-label={t("panel.ai")}
						className={`${FOCUS_RING} flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground`}
					>
						<IconEye />
					</button>
					<button
						type="button"
						onClick={form.reset}
						title={t("panel.reset")}
						aria-label={t("panel.reset")}
						className={`${FOCUS_RING} flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground`}
					>
						<IconReset />
					</button>
				</div>

				{/*
				 * 浮动结果栏已移除。
				 *
				 * 它把最近 8 份设计缩略图铺在画布下半部分（截图里那排小图标），与画布本身抢注意力，
				 * 而历史已经是右上市一个按钮 + 一个完整抽屉。同一份数据两个入口，代价是画布看不见了。
				 */}

				<CanvasDock
					canGenerate={canGenerate}
					running={generation.running}
					mode={generation.mode}
					pendingNotes={pendingCount}
					inspectorOpen={inspectorOpen}
					inspectorTab={inspectorTab}
					onGenerate={() => void runBatch()}
					imageAvailable={imageAvailable}
					onGenerateImage={() => {
						// Ask for this batch on the raster line explicitly: flipping the mode and
						// calling generate in the same tick would still run the vector path.
						void runBatch({ mode: "ai" });
					}}
					// Only when the open design is an AI image: a vector design has no bitmap to edit.
					onGenerateFromReference={
						selectedRecord?.engine === "ai" && selectedRecord.blobId
							? () => {
									const reference = selectedRecord.blobId;
									if (!reference) return;
									void runBatch({ mode: "ai", reference });
								}
							: undefined
					}
					onSurprise={() => void runBatch({ surprise: true })}
					onOpenAiSettings={() => setAiOpen(true)}
					onOpenVersions={() => setHistoryOpen(true)}
					onOpenNotes={() => openInspector("notes")}
					onToggleInspector={() => (inspectorOpen ? setInspectorOpen(false) : openInspector("design"))}
					// 没选中稿时不静默无反应：禁用由 canExport 管，这里只处理真正能导出的情况。
					onOpenKit={() => {
						if (selectedRecord) setKitRecord(selectedRecord);
					}}
					canExport={Boolean(selectedRecord)}
				/>

				<CanvasInspector
					open={inspectorOpen}
					tab={inspectorTab}
					onTab={setInspectorTab}
					onClose={() => setInspectorOpen(false)}
					controls={{
						spec: form.spec,
						patch: form.patch,
						activePreset: form.activePreset,
						applyPreset: form.applyPreset,
						variations: generation.settings.variations,
						onVariations: generation.updateVariations,
						subject,
						aiMode: generation.mode === "ai",
						imageLabels: {
							fromImage: t("colour.fromImage"),
							imageFailed: t("error.imageRead"),
							tooLarge: t("error.imageTooLarge"),
						},
					}}
					onPlan={handlePlan}
					notes={visibleNotes}
					onRemoveNote={(id) => void notes.remove(id)}
					onHandToAgent={() => void handoff.sendAll()}
					blockedReason={handoff.blockedReason}
					needsSession={handoff.needsSession}
					workspaceMismatch={handoff.workspaceMismatch}
					busy={generation.running}
				/>

				<BrandKitDialog record={kitRecord} onClose={() => setKitRecord(null)} t={t} />

				{/*
				 * 历史面板 = 设计包的版本清单，不是生成过的图片。
				 * 点某版把画布切到它：矢量按 seed/style 复现（纯函数），位图标注 AI。
				 */}
				<VersionsSheet
					open={historyOpen}
					fs={getPluginContext().fs}
					cwd={cwd}
					locale={locale}
					onClose={() => setHistoryOpen(false)}
					onOpen={(pkg, version) => {
						form.load(specForVersion(pkg, version));
						setSelectedId(null);
						setOpenFolder(pkg.folder);
						// 切到某一版后回到单张画布：网格是本批的视图，不是版本视图。
						setBatchIds([]);
						setStaged(false);
					}}
					// 版本来自磁盘，刷新同时让切换器重扫一次。
					onRefresh={() => setForceScan((value) => !value)}
					t={t}
				/>

			<AiSettingsDialog
				open={aiOpen}
				settings={generation.settings}
				providers={generation.providers}
				denied={generation.aiDenied}
				mode={generation.mode}
				onChooseMode={generation.setMode}
				onClose={() => setAiOpen(false)}
				onChooseProvider={(providerId) => {
					generation.updateSettings({ providerId });
					// 选了 provider 就把引擎切到位图：这是他的选择，不再由自动探测覆盖。
					if (providerId) generation.setMode("ai");
				}}
				onRefresh={generation.refreshProviders}
				t={t}
			/>


		</div>
	);
}

