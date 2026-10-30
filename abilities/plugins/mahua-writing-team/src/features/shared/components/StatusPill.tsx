import { useTranslation } from "@astravia-org/plugin-sdk";
import type { ChapterStatus } from "../../../domain/novel-types.js";

/** 只表达状态，不做装饰：颜色全部来自宿主语义 token，跟随用户主题（ADR 0006）。 */
const TONE: Record<ChapterStatus, string> = {
	planned: "bg-muted text-muted-foreground",
	drafting: "bg-primary/10 text-primary",
	reviewed: "bg-primary/15 text-primary",
	committed: "bg-primary text-primary-foreground",
	blocked: "bg-destructive/15 text-destructive",
};

export function StatusPill({ status }: { status: ChapterStatus }) {
	const { t } = useTranslation();
	return (
		<span
			className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${TONE[status]}`}
		>
			{t(`status.${status}`)}
		</span>
	);
}
