import { useTranslation } from "@astravia-org/plugin-sdk";
import type { PromptLibrary } from "../../../../domain/prompt-library";
import { getActivePrompt } from "../../../../domain/prompt-library";
import { ASTRAVIA_AGENTS_FILE, DEFAULT_INJECT_BODY, buildAstraviaInjectBlock } from "../../../../domain/inject/astravia-block";
import type { NotifyVariant } from "../../bridge";
import { Card } from "../shell/card";

export interface InjectBlockCardProps {
	library: PromptLibrary;
	notify(message: string, variant?: NotifyVariant): void;
}

/**
 * 注入块预览：把「提示词最终会变成什么」摊开给人看。
 *
 * 等价于上游 FileInjectPanel 的落盘前预览——区别在于宿主只授权插件写项目内路径，
 * `~/.astravia/agent/AGENTS.md` 必须由用户在保存对话框里点一次，所以这里给的是
 * 可复制的块 + 落盘路径，而不是一个会静默写主目录的按钮。
 */
export function InjectBlockCard({ library, notify }: InjectBlockCardProps) {
	const { t } = useTranslation();
	const active = getActivePrompt(library);
	const { block, restoreNote } = buildAstraviaInjectBlock({
		body: active?.content?.trim() || DEFAULT_INJECT_BODY,
		sourceLabel: active?.name ?? undefined,
	});

	function copy() {
		navigator.clipboard?.writeText(block).then(
			() => notify(t("prompt.inject.copied"), "success"),
			() => notify(t("panel.action.copyFailed"), "error"),
		);
	}

	return (
		<Card title={t("prompt.inject.title")} bodyClassName="p-3">
			<div className="space-y-2">
				<div className="flex flex-wrap items-center gap-2 text-[11px] text-text-3">
					<span className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[10.5px] text-text-2">~/.astravia/agent/{ASTRAVIA_AGENTS_FILE}</span>
					<span className="text-text-4">·</span>
					<span>{active ? t("prompt.inject.sourceActive", { name: active.name }) : t("prompt.inject.sourceDefault")}</span>
					<button type="button" onClick={copy} className="ml-auto rounded-md border border-line px-2 py-1 text-[11px] text-text-2 hover:bg-surface-hover hover:text-text">
						{t("prompt.inject.copy")}
					</button>
				</div>
				<pre className="fb-scroll max-h-56 overflow-auto whitespace-pre-wrap rounded-md border border-line-subtle bg-surface-2 p-2.5 text-[10.5px] leading-relaxed text-text-2">{block}</pre>
				<p className="text-[10.5px] leading-relaxed text-text-4">{t("prompt.inject.howTo")}</p>
				<p className="text-[10.5px] leading-relaxed text-text-4">{restoreNote.split("\n")[0]}</p>
			</div>
		</Card>
	);
}
