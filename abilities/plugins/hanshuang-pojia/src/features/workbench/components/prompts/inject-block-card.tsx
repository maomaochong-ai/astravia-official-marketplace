import { useTranslation } from "@astravia-org/plugin-sdk";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PromptLibrary } from "../../../../domain/prompt-library";
import { getActivePrompt } from "../../../../domain/prompt-library";
import { PACKS } from "../../../../domain/inject/packs";
import { ASTRAVIA_AGENTS_FILE, DEFAULT_INJECT_BODY, buildAstraviaInjectBlock } from "../../../../domain/inject/astravia-block";
import type { NotifyVariant } from "../../bridge";
import { Card } from "../shell/card";
import { Markdown } from "../shell/markdown";
import { SegmentedControl } from "../shell/segmented-control";

export interface InjectBlockCardProps {
	library: PromptLibrary;
	notify(message: string, variant?: NotifyVariant): void;
	/** 选中的提示词包；由外层持有，目标矩阵也用同一个值生成计划。 */
	packId?: string;
	onPackChange?(id: string): void;
}

type View = "preview" | "raw";

/**
 * 注入块：**默认看渲染后的样子**，需要对照原文时切一档。
 *
 * 三处按反馈改：
 *   1. 默认 `preview`：注入出去的是 Markdown，先看它会变成什么样才有意义；
 *      原文仍在，要逐字核对时切过去（`raw`）。
 *   2. 底部可**拖动改高度**（默认 260px）：写正文时想拉高，收起来时想压低，
 *      固定高度两头不讨好。拖动用 pointer 事件，键盘也能用（↑↓ 每次 16px）。
 *   3. 原来的「说明 + 提示词包切换」原本在外面裸着，现在都收进同一张卡：
 *      同一件事的信息放在同一个圆角容器里。
 */
export function InjectBlockCard({ library, notify, packId, onPackChange }: InjectBlockCardProps) {
	const { t } = useTranslation();
	const active = getActivePrompt(library);
	const [view, setView] = useState<View>("preview");
	const [packBody, setPackBody] = useState<string | null>(null);
	const [height, setHeight] = useState(260);
	const drag = useRef<{ startY: number; startHeight: number } | null>(null);

	// 选了包就读它的正文；没选包时用当前激活的提示词（或默认契约）。
	useEffect(() => {
		let alive = true;
		if (!packId) {
			setPackBody(null);
			return;
		}
		setPackBody(null);
		void import("../../services/packs").then(({ loadPackBody }) =>
			loadPackBody(packId)
				.then(text => {
					if (alive) setPackBody(text);
				})
				.catch(() => {
					if (alive) setPackBody(null);
				}),
		);
		return () => {
			alive = false;
		};
	}, [packId]);

	const body = useMemo(() => (packId && packBody ? packBody : active?.content?.trim() || DEFAULT_INJECT_BODY), [packId, packBody, active]);
	const { block, restoreNote } = useMemo(
		() => buildAstraviaInjectBlock({ body, sourceLabel: packId ?? active?.name ?? undefined }),
		[body, packId, active],
	);

	const copy = useCallback(() => {
		navigator.clipboard?.writeText(block).then(
			() => notify(t("prompt.inject.copied"), "success"),
			() => notify(t("panel.action.copyFailed"), "error"),
		);
	}, [block, notify, t]);

	const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
		event.preventDefault();
		event.currentTarget.setPointerCapture(event.pointerId);
		drag.current = { startY: event.clientY, startHeight: height };
	};
	const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
		const state = drag.current;
		if (!state) return;
		// 往上拖增高；夹在 160–560 之间，避免把下面的卡挤没，也避免高到没有意义。
		setHeight(Math.min(560, Math.max(160, state.startHeight - (event.clientY - state.startY))));
	};
	const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
		drag.current = null;
		if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
	};

	return (
		<Card title={t("prompt.inject.title")} className="shrink-0">
			<div className="flex flex-col gap-2">
				{/* 说明 + 包切换 + 视图切换：都在同一张卡里。 */}
				<div className="text-[10.5px] leading-relaxed text-text-3">{t("inject.intro")}</div>
				<div className="flex min-w-0 flex-wrap items-center gap-1.5">
					<SegmentedControl<View>
						size="sm"
						value={view}
						onValueChange={setView}
						ariaLabel={t("prompt.preview.view")}
						items={[
							{ value: "preview", label: t("prompt.preview.rendered") },
							{ value: "raw", label: t("prompt.preview.raw") },
						]}
					/>
					{onPackChange ? (
						<div className="flex min-w-0 flex-wrap items-center gap-1">
							{PACKS.map(pack => (
								<button
									key={pack.id}
									type="button"
									onClick={() => onPackChange(packId === pack.id ? "" : pack.id)}
									aria-pressed={packId === pack.id}
									className={`rounded-md px-1.5 py-0.5 text-[10.5px] transition-colors ${
										packId === pack.id ? "fb-selected" : "text-text-3 hover:bg-surface-hover hover:text-text"
									}`}
								>
									{pack.title}
								</button>
							))}
						</div>
					) : null}
					<span className="fb-wrap ms-auto font-mono text-[10.5px] text-text-4">~/.astravia/agent/{ASTRAVIA_AGENTS_FILE}</span>
					<button
						type="button"
						onClick={copy}
						className="shrink-0 rounded-md border border-line-subtle px-2 py-0.5 text-[10.5px] text-text-2 transition-colors hover:bg-surface-hover hover:text-text"
					>
						{t("prompt.inject.copy")}
					</button>
				</div>

				{/* 正文：可拖高度、自己滚；预览默认，原文可切。 */}
				<div style={{ height }} className="fb-scroll overflow-y-auto rounded-lg bg-surface px-3 py-2 ring-1 ring-line-subtle">
					{view === "preview" ? (
						<Markdown source={body} />
					) : (
						<pre className="whitespace-pre-wrap break-words font-mono text-[10.5px] leading-relaxed text-text-2">{block}</pre>
					)}
				</div>
				<div
					role="separator"
					aria-orientation="horizontal"
					aria-valuenow={height}
					aria-valuemin={160}
					aria-valuemax={560}
					tabIndex={0}
					onPointerDown={onPointerDown}
					onPointerMove={onPointerMove}
					onPointerUp={onPointerUp}
					onPointerCancel={onPointerUp}
					onKeyDown={event => {
						if (event.key === "ArrowUp") {
							event.preventDefault();
							setHeight(value => Math.min(560, value + 16));
						} else if (event.key === "ArrowDown") {
							event.preventDefault();
							setHeight(value => Math.max(160, value - 16));
						}
					}}
					className="fb-resize"
					data-testid="inject-resize"
					title={t("inject.resize")}
				/>

				<div className="flex flex-col gap-0.5">
					<p className="break-words text-[10.5px] leading-relaxed text-text-4">{t("prompt.inject.howTo")}</p>
					<p className="break-words text-[10.5px] leading-relaxed text-text-4">{restoreNote.split("\n")[0]}</p>
				</div>
			</div>
		</Card>
	);
}
