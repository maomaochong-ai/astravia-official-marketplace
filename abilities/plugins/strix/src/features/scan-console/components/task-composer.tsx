/**
 * Hands an assessment to the host agent.
 *
 * This is the one action the panel owns. It does not run anything itself: it
 * writes the target and the working method into the conversation, and the host
 * agent - running on the model the user already configured - drives Strix's
 * sandbox tools. Reimplementing a scan loop here would duplicate an agent the
 * application already has, and would need a second model credential to do it.
 */

import { useState } from "react";

export interface TaskComposerProps {
	t: (key: string) => string;
	/** Send a prompt into the current conversation. */
	send: (prompt: string) => Promise<unknown>;
	disabled?: boolean;
}

export function TaskComposer({ t, send, disabled }: TaskComposerProps): React.ReactElement {
	const [target, setTarget] = useState("");
	const [sending, setSending] = useState(false);
	const [feedback, setFeedback] = useState<string>();

	const submit = async (): Promise<void> => {
		const value = target.trim();
		if (!value || sending) return;
		setSending(true);
		setFeedback(undefined);
		try {
			await send(t("composer.prompt").replace("{target}", value));
			setFeedback(t("composer.sent"));
			setTarget("");
		} catch (cause) {
			setFeedback(cause instanceof Error ? cause.message : String(cause));
		} finally {
			setSending(false);
		}
	};

	return (
		<section className="astra-strix-card">
			<textarea
				aria-label={t("composer.label")}
				className="astra-strix-input astra-strix-textarea"
				placeholder={t("composer.placeholder")}
				value={target}
				onChange={(event) => setTarget(event.target.value)}
				onKeyDown={(event) => {
					// Enter hands it over; Shift+Enter is a newline for multi-line targets.
					if (event.key === "Enter" && !event.shiftKey) {
						event.preventDefault();
						void submit();
					}
				}}
				rows={2}
				disabled={disabled || sending}
			/>
			<div className="astra-strix-row astra-strix-actions">
				<button
					type="button"
					className="astra-strix-button astra-strix-button-primary"
					onClick={() => void submit()}
					disabled={disabled || sending || !target.trim()}
				>
					{sending ? t("composer.sending") : t("composer.start")}
				</button>
				<span className="astra-strix-dim">
					{feedback ?? (disabled ? t("composer.blocked") : t("composer.hint"))}
				</span>
			</div>
		</section>
	);
}
