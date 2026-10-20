import { useTranslation } from "@astravia-org/plugin-sdk";
import type { ChatState, PageId } from "../../state";
import { Icon } from "./icon";

export interface TopBarProps {
	page: PageId;
	chat: ChatState;
	sending: boolean;
	/** 顶部白色主按钮：把当前样本交给对话。 */
	onSend(): void;
	canSend: boolean;
}

const DOT: Record<ChatState["status"], string> = {
	disconnected: "bg-text-4",
	idle: "bg-purple",
	streaming: "bg-purple fb-pulse",
};

/** 面包屑 + 宿主对话状态 + 主操作。设计稿的紫色徽标在这里承担「回程」可见性。 */
export function TopBar({ page, chat, sending, onSend, canSend }: TopBarProps) {
	const { t } = useTranslation();
	const label =
		chat.status === "streaming"
			? chat.tool
				? t("chat.state.tool", { tool: chat.tool })
				: t("chat.state.streaming")
			: chat.status === "idle"
				? t("chat.state.connected")
				: t("chat.state.disconnected");

	return (
		<header className="flex h-11 shrink-0 items-center gap-2 border-b border-line bg-surface-2 px-3 @min-[720px]:px-4">
			<div className="flex min-w-0 flex-1 items-center gap-1.5 text-[11.5px]">
				<Icon name="folder" className="size-3.5 shrink-0 text-text-4" />
				<span className="hidden shrink-0 text-text-4 @min-[560px]:inline">{t("nav.workspace")}</span>
				<span className="hidden shrink-0 text-text-4 @min-[560px]:inline">/</span>
				<span className="min-w-0 truncate font-medium text-text-2">{t(`nav.${page}`)}</span>
			</div>

			<div
				className={`flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 ${
					chat.status === "disconnected" ? "border-line bg-surface-3" : "border-purple/40 bg-purple/10"
				}`}
				title={label}
			>
				<span className={`size-1.5 rounded-full ${DOT[chat.status]}`} />
				<span className={`hidden text-[10.5px] @min-[640px]:inline ${chat.status === "disconnected" ? "text-text-3" : "text-purple"}`}>{label}</span>
			</div>

			<button
				type="button"
				onClick={onSend}
				disabled={!canSend || sending}
				className="flex shrink-0 items-center gap-1.5 rounded-md bg-text px-2 py-1 text-[11.5px] font-medium text-surface transition-opacity hover:opacity-90 disabled:opacity-40"
			>
				<Icon name={sending ? "refresh" : "send"} className={`size-3 ${sending ? "motion-safe:animate-spin" : ""}`} />
				<span className="hidden @min-[520px]:inline">{t("chat.sendAction")}</span>
			</button>
		</header>
	);
}
