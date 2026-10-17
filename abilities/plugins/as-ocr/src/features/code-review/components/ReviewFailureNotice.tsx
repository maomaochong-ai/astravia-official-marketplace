import type { JSX } from "react";
import type { ReviewRun } from "../../../review/store.ts";

/**
 * 失败态：原样给出失败原因（辨别「不是 git 仓库」「没有 LLM 端点」「ocr 未安装」靠它），
 * 再给一条能立刻做的动作，不让用户对着红字猜。
 */
export function ReviewFailureNotice({ run }: { run: ReviewRun }): JSX.Element {
	const reason = run.error?.trim() || "未知错误";
	return (
		<div className="m-3 space-y-2 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
			<div className="flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400">
				<span className="icon-[mdi--alert-circle-outline] size-4" />
				失败原因
			</div>
			<p className="whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-foreground/80">
				{reason}
			</p>
			<p className="text-[11px] leading-5 text-muted-foreground">
				{run.engine === "ocr"
					? "ocr 模式需要先配置 LLM 端点；也可以在对话里说「用委托模式审查」，交给当前模型自己审。"
					: "确认会话打开的是 git 仓库目录，并允许插件运行 git 命令；然后在对话里重新说「审查一下改动」。"}
			</p>
		</div>
	);
}
