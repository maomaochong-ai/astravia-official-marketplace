/**
 * 面板的对话框（两个屏共用）。
 *
 * 1.1.0 一度把它删了："发消息是宿主的事"。删掉之后面板失去了一件真实的能力——
 * 用户想在看着现场时补一句（"继续上一轮""换成 443"），必须切回聊天区、找对会话、再回来。
 * 那不是"职责划分"，那是把两屏之间的往返成本转嫁给用户。
 *
 * 所以它回来了，但按 1.1.0 学到的那条边界来写：
 *
 *  - **没有第二个 AI**：这里的文字交给宿主的 `sendPrompt`，由宿主的会话、模型与权限执行；
 *  - **不抄对话**：宿主回复只在面板里留摘要（`domain/conversation-digest.ts`），
 *    正文仍在聊天区——两个可滚正文是 0.7.1 删掉的那份冗余；
 *  - **团队会话只读**：宿主的 `sendPrompt` 在团队会话里指向另一个会话，插件侧没有
 *   正确的落点（见会话形态的判据）。
 *
 * 这一层只画控件，不决定能不能发：`canSend` 与 `readOnly` 由 hook 依会话形态给出。
 */

import type { ChangeEvent, KeyboardEvent, ReactElement } from "react";
import { useTypewriter, COMPOSER_HINTS } from "./use-typewriter";

export interface PanelComposerProps {
	t: (key: string, params?: Record<string, string | number>) => string;
	value: string;
	onChange: (value: string) => void;
	onSend: () => void;
	/** 无障碍标签与占位符的键由调用方决定：首屏与工作台说的是两件事。 */
	labelKey: string;
	placeholderKey: string;
	/** 发送中用（宿主在跑）：发送键仍可按，宿主会排队；这里只用来显示忙碌态。 */
	busy?: boolean;
	/** 团队会话：面板没有正确的落点，输入框换成一句说明。 */
	readOnly?: boolean;
	/** 首屏的「工作台」按钮；工作台里不传。 */
	onOpenWorkbench?: () => void;
	/** 工作台里的「新会话」按钮；首屏不传。 */
	onNewSession?: () => void;
	/**
	 * 占位符循环的几句范例（逐字敲出）。
	 *
	 * 为什么不用一句静态提示：这一格绝大多数时间是空的，静态文案只显影一次；
	 * 逐字敲出的短句会让人本能地读一遍。传空数组就退回静态 placeholder。
	 */
	hints?: readonly string[];
}

/** Enter 发送、Shift+Enter 换行；输入法组合中不拦。 */
function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>, submit: () => void): void {
	if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
		event.preventDefault();
		submit();
	}
}

/** 一行起步、最多六行：多行是例外，不是常态。 */
export function composerRows(value: string): number {
	return Math.min(6, Math.max(1, value.split("\n").length));
}

export function PanelComposer({
	t,
	value,
	onChange,
	onSend,
	labelKey,
	placeholderKey,
	busy,
	readOnly,
	onOpenWorkbench,
	onNewSession,
	hints,
}: PanelComposerProps): ReactElement {
	// 有内容就停（不打断输入）、只读就停（那里没有"你可以说"这回事）。
	const typed = useTypewriter(hints ?? COMPOSER_HINTS.scan, { paused: Boolean(readOnly) || value.length > 0 });
	const placeholder = readOnly ? "" : (typed ?? t(placeholderKey));

	const submit = (): void => {
		if (readOnly) return;
		if (!value.trim()) return;
		onSend();
	};

	return (
		<div className="astra-strix-composer-panel" data-readonly={readOnly ? "yes" : "no"}>
			<div
				className="astra-strix-prompt"
				data-busy={busy ? "yes" : "no"}
				data-readonly={readOnly ? "yes" : "no"}
			>
				<div className="astra-strix-prompt-row">
					<span className="astra-strix-prompt-caret" aria-hidden="true">
						&gt;
					</span>
					<label className="astra-strix-prompt-field">
						<textarea
							className="astra-strix-prompt-input"
							aria-label={t(labelKey)}
							placeholder={placeholder}
							rows={composerRows(value)}
							spellCheck={false}
							readOnly={Boolean(readOnly)}
							value={value}
							onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onChange(event.target.value)}
							onKeyDown={(event) => onKeyDown(event, submit)}
						/>
					</label>
				</div>
				<div className="astra-strix-composer-bar">
					{readOnly ? (
						// 团队会话：说明为什么不能在这里发，而不是留一个按了没反应的键。
						<span className="astra-strix-amber astra-strix-readonly-note">{t("launch.teamReadOnly")}</span>
					) : (
						<>
							<span className="astra-strix-dim">{t("launch.hint.send")}</span>
							{onNewSession ? (
								<button type="button" className="astra-strix-go" onClick={onNewSession}>
									{t("nav.newSession")}
								</button>
							) : null}
							{onOpenWorkbench ? (
								<button type="button" className="astra-strix-go" onClick={onOpenWorkbench}>
									{t("nav.workbench")}
								</button>
							) : null}
							<button type="button" className="astra-strix-send" onClick={submit} disabled={!value.trim()}>
								{t("composer.send")}
							</button>
						</>
					)}
				</div>
			</div>
		</div>
	);
}
