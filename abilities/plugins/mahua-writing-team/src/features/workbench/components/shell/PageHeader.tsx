import type { ReactNode } from "react";

/**
 * 页头：一行放标题、元信息与右侧动作。
 *
 * `back` 只用于「从哪来、回哪去」的局部导航（书页 → 书架），因此它是一个回调，
 * 不是路由地址——工作台没有 URL。
 *
 * 标题必须能收：面板可以拖到 320px，而标题是这一页唯一不可省的信息。所以左块自己占满
 * 剩余宽度（`flex-1` + `min-w-0`），标题再 `truncate`——两步缺一不可，少了 `flex-1` 它
 * 拿不到可收缩的长度，`truncate` 就不生效，长标题会把整行（连带右侧按钮）顶出纸面。
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
		<div className="flex flex-wrap items-center gap-x-4 gap-y-2">
			<div className="min-w-0 flex-1">
				{back && (
					<button
						type="button"
						onClick={back.onBack}
						className="mb-2.5 inline-flex items-center gap-1 rounded-control px-1.5 py-0.5 text-micro text-ink-soft transition-colors hover:bg-wash hover:text-ink"
					>
						<span className="icon-[solar--alt-arrow-left-bold] size-3" />
						{back.label}
					</button>
				)}
				<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
					<h1 className="min-w-0 truncate font-display text-display font-semibold text-ink">{title}</h1>
					{meta ? <span className="min-w-0 flex-1 basis-[12ch]">{meta}</span> : null}
				</div>
			</div>
			<div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">{right}</div>
		</div>
	);
}
