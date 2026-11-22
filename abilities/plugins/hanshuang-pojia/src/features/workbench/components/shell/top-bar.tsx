import { useTranslation } from "@astravia-org/plugin-sdk";
import type { ChatState, PageId } from "../../state";
import { Icon } from "./icon";

export interface TopBarProps {
	page: PageId;
	chat: ChatState;
}

const DOT: Record<ChatState["status"], string> = {
	disconnected: "bg-text-4",
	idle: "bg-purple",
	streaming: "bg-purple fb-pulse",
};

/** 面包屑 + 宿主对话状态。顶栏不放「发送到对话」：具体动作在各自页面里，带上下文。 */
export function TopBar({ page, chat }: TopBarProps) {
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
		<header className="flex min-h-11 shrink-0 items-center gap-2 border-b border-line-subtle bg-surface-2 px-4">
			<div className="flex min-w-0 flex-1 items-center gap-1.5 text-[11.5px]">
				<Icon name="folder" className="size-3.5 shrink-0 text-text-4" />
				<span className="hidden shrink-0 text-text-4 @min-[560px]:inline">{t("nav.workspace")}</span>
				<span className="hidden shrink-0 text-text-4 @min-[560px]:inline">/</span>
				{/* 页头不再重复标题后，这里是全页唯一可见的标题，所以它得担起标题的分量。 */}
				<span className="min-w-0 truncate text-[13px] font-semibold text-text" title={t(`nav.${page}`)}>{t(`nav.${page}`)}</span>
			</div>

			<div
				className={`flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 ${
					chat.status === "disconnected" ? "border-line-subtle bg-surface-3" : "border-purple/40 bg-purple/10"
				}`}
				title={label}
			>
				<span className={`size-1.5 rounded-full ${DOT[chat.status]}`} />
				<span className={`hidden text-[10.5px] @min-[640px]:inline ${chat.status === "disconnected" ? "text-text-3" : "text-purple"}`}>{label}</span>
			</div>

		</header>
	);
}