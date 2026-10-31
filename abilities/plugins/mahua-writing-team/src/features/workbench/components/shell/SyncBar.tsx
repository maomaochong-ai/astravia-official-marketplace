import { useTranslator } from "../../hooks/use-translator";

/**
 * 同步带：把「谁在写」和「工作台读到了什么」并排放着。
 *
 * 左边是宿主侧栏里的团队，右边是这页读到的落盘结果，中间一条单向箭头——
 * 这是工作台与团队之间唯一的连接方式：只读，不驱动。所以这里没有任何按钮。
 */
export function SyncBar({
	writer,
	doing,
	file,
	words,
	ago,
	queue,
}: {
	writer: string;
	doing: string;
	file: string;
	words: string;
	ago: string;
	queue: string;
}) {
	const t = useTranslator();

	return (
		<div className="flex h-9 shrink-0 items-center gap-2 px-3 text-micro">
			<span className="flex h-6 min-w-0 items-center gap-1.5 rounded-pill bg-raised px-2.5 shadow-raise">
				<span className="size-1.5 shrink-0 rounded-pill bg-cinnabar" />
				<span className="shrink-0 font-medium text-cinnabar-ink">{t("sync.team")}</span>
				<span className="text-ink-faint">·</span>
				<span className="shrink-0 text-ink">{writer}</span>
				<span className="shrink-0 text-ink-soft">{t("sync.writing")}</span>
				<span className="truncate font-mono text-ink-soft">{doing}</span>
			</span>

			<span className="flex shrink-0 items-center gap-1 text-ink-faint">
				<span className="h-px w-4 bg-line-strong" />
				<span className="icon-[lucide--arrow-right] size-3" />
			</span>

			<span className="flex min-w-0 items-center gap-1.5 text-ink-faint">
				<span className="icon-[lucide--hard-drive-download] size-3 shrink-0" />
				<span className="truncate font-mono">{file}</span>
				<span className="shrink-0 text-ink-soft">{words}</span>
				<span className="shrink-0 text-line-strong">|</span>
				<span className="shrink-0">{ago}</span>
			</span>

			<span className="ml-auto shrink-0 text-[10px] text-ink-faint">{queue}</span>
		</div>
	);
}
