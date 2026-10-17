/**
 * 流程示意图外框：只负责可访问名称与最大宽度。
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
			<div className="mx-auto flex w-full max-w-[26rem] flex-col">{children}</div>
		</figure>
	);
}
