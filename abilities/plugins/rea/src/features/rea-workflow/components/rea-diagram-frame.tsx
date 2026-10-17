/**
 * 流程示意图外框：只负责可访问名称与宽度约束。
 *
 * 不再设 max-width：面板本身已经很窄，再居中限制宽度会让左右留白、并让子节点的
 * 百分比宽度与容器对不齐。图完全跟随容器宽度，内部节点自己用 min-w-0 换行。
 *
 * 宽度上限让图在宽面板里不至于被拉伸成几条长条，在窄面板里则完全跟随容器宽度。
 */

import type { JSX, ReactNode } from "react";

interface FrameProps {
	readonly ariaLabel: string;
	readonly children: ReactNode;
}

export function ReaDiagramFrame({ ariaLabel, children }: FrameProps): JSX.Element {
	return (
		<figure className="m-0">
			<figcaption className="sr-only">{ariaLabel}</figcaption>
			<div className="flex w-full min-w-0 flex-col">{children}</div>
		</figure>
	);
}
