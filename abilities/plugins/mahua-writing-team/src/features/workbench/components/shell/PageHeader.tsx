import type { ReactNode } from "react";

/**
 * 页头：一行放标题、元信息与右侧动作。
 *
 * `back` 只用于「从哪来、回哪去」的局部导航（书页 → 书架），因此它是一个回调，
 * 不是路由地址——工作台没有 URL。
 */
export function PageHeader({
	back,
	title,
	meta,
	right,
}: {
	back?: { label: string; onBack(): void };
	title: string;
	meta?: ReactNode;
	right?: ReactNode;
}) {
	return (
		<div className="flex items-end gap-4 pb-5">
			<div className="min-w-0">
				{back && (
					<button
						type="button"
						onClick={back.onBack}
						className="mb-2.5 inline-flex items-center gap-1 text-micro text-ink-soft transition-colors hover:text-ink"
					>
						<span className="icon-[lucide--arrow-left] size-3" />
						{back.label}
					</button>
				)}
				<div className="flex items-baseline gap-3">
					<h1 className="font-display text-display font-semibold text-ink">{title}</h1>
					{meta}
				</div>
			</div>
			<div className="ml-auto flex shrink-0 items-center gap-2 pb-1.5">{right}</div>
		</div>
	);
}
