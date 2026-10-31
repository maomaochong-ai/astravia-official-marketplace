import { tryGetStudioRuntime } from "../../../plugin-context.js";
import { STUDIO_TAB_ID } from "../../../studio-ids.js";
import { useConsoleTimeline } from "../console-timeline/use-console-timeline.js";
import { useTranslator } from "../hooks/use-translator.js";
import { rememberRoute } from "../hooks/use-workbench-route.js";
import { elapsedText, lastLandedStudioEvent } from "../workbench-feed.js";
import { elapsedSince } from "../workbench-model.js";

/** 落章卡片在对话里停留多久：过了这段时间卡片自己退场，不再占着消息列表。 */
const CARD_WINDOW_MS = 30 * 60_000;

/**
 * 对话里的落章卡片。
 *
 * 这是「同步单向」最直接的一处兑现：团队在侧栏把一章落盘，对话里没有任何痕迹——
 * 用户只看见自己的消息和团队的回话。卡片补的就是这条缝：**它只报告已经发生的事，
 * 不发起任何事**。点它只是打开运行台看流水，不会让团队多写一个字。
 *
 * 没有落盘就没有卡片，不占位；有落盘也只在 30 分钟内露面。
 */
export function StudioTurnCard() {
	// 宿主可能在插件卸载之后还渲染一帧；拿不到运行时就不画，也不去挂 hook。
	if (!tryGetStudioRuntime()) return null;
	return <LandedCard />;
}

function LandedCard() {
	const runtime = tryGetStudioRuntime();
	const t = useTranslator();
	const events = useConsoleTimeline();

	const landed = lastLandedStudioEvent(events);
	if (!runtime || !landed) return null;

	const at = Date.parse(landed.at);
	if (!Number.isFinite(at) || Date.now() - at > CARD_WINDOW_MS) return null;

	const open = () => {
		rememberRoute("console");
		runtime.ctx.ui.openActivityTab(STUDIO_TAB_ID);
	};

	return (
		<div className="mahua-root w-full">
			<div className="flex items-center gap-3 rounded-panel border border-line bg-raised px-3 py-2.5 shadow-raise">
				<span className="icon-[solar--book-2-bold] size-4 shrink-0 text-cinnabar" />
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-1.5">
						<span className="font-display text-body-sm font-semibold text-ink">{t("landed.title")}</span>
						{landed.chapter ? (
							<span className="min-w-0 truncate font-mono text-[10px] text-ink-faint">{`chapters/${landed.chapter}.md`}</span>
						) : null}
					</div>
					<div className="mt-0.5 truncate text-[10px] text-ink-soft">
						{t("landed.detail", {
							doing: t(landed.textKey, landed.textParams),
							ago: elapsedText(elapsedSince(landed.at, Date.now()), t),
						})}
					</div>
				</div>
				<button
					type="button"
					onClick={open}
					className="flex h-7 shrink-0 items-center gap-1 rounded-control border border-line px-2.5 text-[10px] text-ink transition-colors hover:bg-inset"
				>
					{t("landed.open")}
					<span className="icon-[lucide--arrow-right] size-3" />
				</button>
			</div>
		</div>
	);
}
