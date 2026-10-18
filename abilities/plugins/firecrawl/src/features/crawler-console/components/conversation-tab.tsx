/**
 * Talking to the agent without leaving the console.
 *
 * The crawler used to be a one-way instrument: it produced a result and the user
 * had to switch panes to ask anything about it. This tab keeps the host
 * conversation visible next to the web and posts prompts through the host, so the
 * crawl target and its output stay in the same field of view.
 *
 * It mounts only when selected: the panel otherwise has no conversation hooks,
 * and a tab that is not on screen should not subscribe to the message stream.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useActiveConversation, useConversationMessages } from "@astravia-org/plugin-sdk";
import type { ConversationMessage } from "@astravia-org/plugin-sdk";
import type { CrawlRunSnapshot } from "../services/crawl-run-store";
import { abortTurn, sendPrompt } from "../../../runtime/conversation-prompt";
import { useTranslate } from "../hooks/use-translate";

const MAX_MESSAGES = 40;

export function ConversationTab({ snapshot }: { snapshot: CrawlRunSnapshot }) {
	const t = useTranslate();
	const conversation = useActiveConversation();
	const messages = useConversationMessages();
	const [draft, setDraft] = useState("");
	const [notice, setNotice] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const scrollRef = useRef<HTMLDivElement | null>(null);

	const visible = useMemo<ConversationMessage[]>(
		() => messages.filter((message) => message.text.trim()).slice(-MAX_MESSAGES),
		[messages],
	);

	useEffect(() => {
		const node = scrollRef.current;
		if (node) node.scrollTop = node.scrollHeight;
	}, [visible.length, conversation.isStreaming]);

	const submit = async (text: string) => {
		if (!text.trim() || busy) return;
		setBusy(true);
		setNotice(null);
		const outcome = await sendPrompt(text);
		setBusy(false);
		if (outcome.status === "sent" || outcome.status === "queued") {
			setDraft("");
			if (outcome.status === "queued") setNotice(t("console.chat.queued"));
			return;
		}
		if (outcome.status === "drafted") {
			setDraft("");
			setNotice(t("console.chat.drafted"));
			return;
		}
		setNotice(t("console.chat.failed"));
	};

	const suggestions = [
		snapshot.pages.length > 0 ? t("console.chat.suggest.summary") : t("console.chat.suggest.plan"),
		t("console.chat.suggest.highlights"),
	];

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="flex shrink-0 items-center gap-2 border-b border-border/60 pb-1 text-[10px] text-muted-foreground">
				<span className={`h-1.5 w-1.5 rounded-full ${conversation.id ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
				<span>{conversation.id ? t("console.chat.active") : t("console.chat.idle")}</span>
				{conversation.model ? <span className="truncate opacity-70">{conversation.model}</span> : null}
				{conversation.isStreaming ? (
					<button
						type="button"
						onClick={() => void abortTurn()}
						className="ml-auto rounded bg-destructive/15 px-1.5 py-0.5 text-destructive hover:bg-destructive/25"
					>
						{t("console.chat.stop")}
					</button>
				) : null}
			</div>

			<div ref={scrollRef} className="min-h-0 flex-1 space-y-1.5 overflow-y-auto py-1.5">
				{visible.length === 0 ? (
					<p className="px-1 py-2 text-[11px] leading-relaxed text-muted-foreground">{t("console.chat.empty")}</p>
				) : (
					visible.map((message) => <MessageRow key={message.id} message={message} />)
				)}
				{conversation.isStreaming ? (
					<p className="px-1 text-[10px] text-muted-foreground motion-safe:animate-pulse">{t("console.chat.thinking")}</p>
				) : null}
			</div>

			<div className="flex shrink-0 flex-wrap gap-1 pb-1">
				{suggestions.map((suggestion) => (
					<button
						key={suggestion}
						type="button"
						onClick={() => void submit(suggestion)}
						disabled={busy}
						className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
					>
						{suggestion}
					</button>
				))}
			</div>

			{notice ? <p className="shrink-0 pb-1 text-[10px] text-warning">{notice}</p> : null}

			<div className="flex shrink-0 items-end gap-1">
				<textarea
					value={draft}
					onChange={(event) => setDraft(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === "Enter" && !event.shiftKey) {
							event.preventDefault();
							void submit(draft);
						}
					}}
					rows={2}
					placeholder={t("console.chat.placeholder")}
					className="min-h-[40px] flex-1 resize-none rounded border border-border bg-background px-2 py-1 text-[11px] leading-snug outline-none placeholder:text-muted-foreground/70 focus:border-primary/60"
				/>
				<button
					type="button"
					onClick={() => void submit(draft)}
					disabled={busy || !draft.trim()}
					className="h-[40px] shrink-0 rounded bg-primary px-2 text-[11px] font-medium text-primary-foreground disabled:opacity-40"
				>
					{t("console.chat.send")}
				</button>
			</div>
		</div>
	);
}

function MessageRow({ message }: { message: ConversationMessage }) {
	const t = useTranslate();
	if (message.role === "compaction") {
		return (
			<p className="px-1 text-[9.5px] italic text-muted-foreground/80">
				{message.text.slice(0, 240)}
				{message.text.length > 240 ? "…" : ""}
			</p>
		);
	}
	const mine = message.role === "user";
	return (
		<div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
			<div
				className={`max-w-[92%] rounded px-2 py-1 text-[11px] leading-snug ${
					mine ? "bg-primary/12 text-foreground" : "bg-muted/60 text-foreground"
				}`}
			>
				<span className="mb-0.5 block text-[9px] uppercase tracking-wide text-muted-foreground">
				{mine ? t("console.chat.you") : t("console.chat.agent")}
				</span>
				<span className="whitespace-pre-wrap break-words">
					{message.text.length > 1_200 ? `${message.text.slice(0, 1_200)}…` : message.text}
				</span>
			</div>
		</div>
	);
}
