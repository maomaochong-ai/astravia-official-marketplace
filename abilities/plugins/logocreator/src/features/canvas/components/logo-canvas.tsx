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
import { claimPendingDesignId, onPendingDesignChanged, peekPendingDesignId } from "../pending-design";
import { getHistoryStore } from "../../../plugin-context";
import { publishCanvasSpec } from "../canvas-prompt";
import { useRasterUrl } from "../hooks/use-raster-url";
import { useNotesHandoff } from "../hooks/use-notes-handoff";
import { cachedRender } from "../preview-cache";
import { describeSpec } from "../describe-spec";
import { AiSettingsDialog } from "./ai-settings-dialog";
import { BrandKitDialog } from "./brand-kit-dialog";
import { CanvasDock } from "./canvas-dock";
import { CanvasInspector } from "./canvas-inspector";
import { CanvasSurface } from "./canvas-surface";
import { HistorySheet } from "./history-sheet";
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
		localFailed: t("notify.localFailed"),
		aiDone: (count) => t("notify.aiDone", { count }),
		aiPartial: (failed) => t("notify.aiPartial", { failed }),
	});
	// Reference-aligned hand-off: it knows when to create a session, when the agent is
		// already running, and when the conversation belongs to another project.
	const handoff = useNotesHandoff(
		cwd,
		// “对话式修改”要能真的改到这份稿：把参数一起交底，agent 才不会另猜一套。
		describeSpec(form.spec),
	);
	const notes = useCanvasNotes({
		sendFailed: t("error.notesSend"),
		addFailed: t("error.notesAdd"),
		removeFailed: t("error.notesRemove"),
	});

	const [selectedId, setSelectedId] = useState<string | null>(null);
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
	const visibleNotes = notes.notes.filter((note) => note.designId === null || note.designId === selectedId);
	const pendingCount = visibleNotes.filter((note) => note.status === "pending").length;

	useEffect(() => {
		if (generation.lastCreatedId) setSelectedId(generation.lastCreatedId);
	}, [generation.lastCreatedId]);

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
		const pendingId = peekPendingDesignId(cwd);
		if (!pendingId || claimedRef.current === pendingId) return;
		const record = history.items.find((item) => item.id === pendingId);
		if (!record) {
			// The store has not caught up (or the tool died between writing the id and the
			// record). Wait once for the next emit; if nothing arrives, drop the hand-off so a
			// later generation is not blocked by a stale one.
			if (!waitedRef.current.has(pendingId)) {
				waitedRef.current.add(pendingId);
				setTimeout(() => {
					if (peekPendingDesignId(cwd) === pendingId && !getHistoryStore().get(pendingId)) {
						claimPendingDesignId(cwd);
					}
				}, 4000);
			}
			return;
		}
		claimedRef.current = pendingId;
		waitedRef.current.delete(pendingId);
		claimPendingDesignId(cwd);
		form.load(record.spec);
		setSelectedId(record.id);
	}, [cwd, history.items, form]);

	useEffect(() => {
		if (!history.ready) return;
		if (peekPendingDesignId(cwd)) {
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
		if (!history.ready || peekPendingDesignId(cwd)) return;
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
	// Raster designs are drawn from their blob; vector ones from the spec.
	const rasterUrl = useRasterUrl(selectedRecord);
	// Auto-detected on mount (and after the AI dialog refreshes it): the dock shows the
	// image slot only when this is true.
	const imageAvailable = generation.providers.length > 0;

	return (
		/*
		 * `h-full` 之外给一个**最小高度**：宿主的活动面板容器在某些布局下高度解析为 0，
		 * 而 `h-full` 在那种容器里也是 0 —— 整块画布的绝对定位子元素就被裁没了，
		 * 用户看到的是一块全黑的面板（实际发生过）。min-h 保证任何情况下都有可画的面积。
		 */
		<div ref={rootRef} className="relative flex h-full min-h-[320px] w-full flex-col overflow-hidden bg-background text-foreground">
			{/* Stage — the canvas fills it; nothing here scrolls. */}
			<div className="relative min-h-0 flex-1">
				<div className="absolute inset-0 flex items-center justify-center p-4 pb-16">
					<div className="w-full max-w-[min(100%,34rem)]">
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
							notes.add({ designId: selectedId, text, ...point, scope, part })
						}
						/>
					</div>
				</div>

				{/* Title slot: the design's own name, editable in place (reference keeps a
				    rename field here too). No engine badge — this plugin runs on the host's
				    own models and has no engine of its own to advertise. */}
				<div
					className={`absolute left-3 top-3 z-40 flex max-w-[calc(100%-5.5rem)] items-center gap-1 transition-opacity ${
						inspectorOpen ? "pointer-events-none opacity-0" : "opacity-100"
					}`}
				>
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
					<button
						type="button"
						onClick={() => setHistoryOpen(true)}
						title={t("panel.history")}
						aria-label={t("panel.history")}
						className={`${FOCUS_RING} relative flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground`}
					>
						<IconHistory />
						{history.items.length > 0 ? (
							<span className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-primary" aria-hidden />
						) : null}
					</button>
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

				{/* Recent results, floating over the stage's lower edge — visible the
				    moment a run lands, without stealing the stage. */}
				{history.ready ? (
					<div className="absolute inset-x-0 bottom-16 z-20 px-3">
						<ResultGrid
							compact
							records={history.items.slice(0, 8)}
							ready={history.ready}
							selectedId={selectedId}
							locale={locale}
							label={history.label}
							onSelect={(record) => {
								form.load(record.spec);
								setSelectedId(record.id);
							}}
							onToggleFavorite={(record) => void history.setFavorite(record.id, !record.favorite)}
							onSaveSvg={handleSaveSvg}
							onSavePng={(record) => void handleSavePng(record)}
							onOpenKit={setKitRecord}
							onDelete={(record) => void history.remove(record.id)}
							t={t}
							emptyState={<span />}
						/>
					</div>
				) : null}

				<CanvasDock
					canGenerate={canGenerate}
					running={generation.running}
					mode={generation.mode}
					pendingNotes={pendingCount}
					inspectorOpen={inspectorOpen}
					inspectorTab={inspectorTab}
					onGenerate={() => void generation.generate(form.spec)}
					imageAvailable={imageAvailable}
					onGenerateImage={() => {
						// Ask for this batch on the raster line explicitly: flipping the mode and
						// calling generate in the same tick would still run the vector path.
						void generation.generate(form.spec, { mode: "ai" });
					}}
					// Only when the open design is an AI image: a vector design has no bitmap to edit.
					onGenerateFromReference={
						selectedRecord?.engine === "ai" && selectedRecord.blobId
							? () => {
									const reference = selectedRecord.blobId;
									if (!reference) return;
									void generation.generate(form.spec, { mode: "ai", reference });
								}
							: undefined
					}
					onSurprise={() => void generation.generate(form.spec, { surprise: true })}
					onOpenNotes={() => openInspector("notes")}
					onToggleInspector={() => (inspectorOpen ? setInspectorOpen(false) : openInspector("design"))}
					onOpenKit={() => {
						if (selectedRecord) setKitRecord(selectedRecord);
						else setInspectorOpen(true);
					}}
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
					busy={generation.running}
				/>
			</div>

			<BrandKitDialog record={kitRecord} onClose={() => setKitRecord(null)} t={t} />

			<HistorySheet
				open={historyOpen}
				records={history.items}
				label={history.label}
				locale={locale}
				onClose={() => setHistoryOpen(false)}
				onSelect={(record) => {
					form.load(record.spec);
					setSelectedId(record.id);
				}}
				onToggleFavorite={(record) => void history.setFavorite(record.id, !record.favorite)}
				onDelete={(record) => void history.remove(record.id)}
				onClear={() => void history.clear()}
				t={t}
			/>

			<AiSettingsDialog
				open={aiOpen}
				settings={generation.settings}
				providers={generation.providers}
				denied={generation.aiDenied}
				onClose={() => setAiOpen(false)}
				onChooseProvider={(providerId) => {
					generation.updateSettings({ providerId });
					generation.setMode(providerId ? "ai" : "local");
				}}
				onRefresh={generation.refreshProviders}
				t={t}
			/>


		</div>
	);
}

