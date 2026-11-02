import { useTranslator } from "../../hooks/use-translator";

type Props = {
	/** 待删书目的书名；`null` 表示不在确认态，这时只可能剩下失败提示。 */
	title: string | null;
	/** 删除请求在飞：确认按钮置灰、文案换成「删除中」。 */
	removing: boolean;
	/** 上一次删除失败的原因。`null` 表示没失败过。 */
	error: string | null;
	onCancel: () => void;
	onConfirm: () => void;
};

/**
 * 删除的确认带与失败提示，坐在列表下方。
 *
 * 抽成组件而不是留在 `LibraryPage` 里：页面容器该只管组合，这种「两个按钮 + 一条错误」
 * 的可交互控件是它自己的一层职责。
 *
 * `error` 不依赖 `title`：确认带被关掉之后仍可能留着上次的失败原因，
 * 这时候只该剩那一行说明，不能再摆一对没有对象的按钮。
 */
export function LibraryDeletePrompt({ title, removing, error, onCancel, onConfirm }: Props) {
	const t = useTranslator();

	return (
		<>
			{title !== null && (
				<div className="mx-2 mt-1.5 mb-1.5 flex shrink-0 items-center gap-2 rounded-control bg-fail-soft px-3 py-1.5 text-micro text-fail">
					<span className="min-w-0 flex-1 truncate">{t("library.deleteAsk", { title })}</span>
					<button
						type="button"
						onClick={onCancel}
						className="shrink-0 whitespace-nowrap rounded-control px-2 py-0.5 text-ink-soft transition-colors hover:bg-wash hover:text-ink"
					>
						{t("library.deleteCancel")}
					</button>
					<button
						type="button"
						disabled={removing}
						onClick={onConfirm}
						className="shrink-0 whitespace-nowrap rounded-control bg-fail px-2 py-0.5 font-semibold text-white transition-colors hover:bg-fail/90 disabled:opacity-60"
					>
						{removing ? t("book.deleting") : t("book.deleteRun")}
					</button>
				</div>
			)}

			{error !== null && (
				<p className="mx-2 mb-1.5 rounded-control bg-fail-soft px-3 py-1.5 text-[10px] leading-4 text-fail">
					{t("book.deleteFailed")} · {error}
				</p>
			)}
		</>
	);
}
