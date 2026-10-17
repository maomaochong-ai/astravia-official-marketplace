import type { JSX } from "react";
import { useEffect, useState } from "react";
import type { OcrProviderBridge } from "../../../review/provider.ts";
import type { ReviewStore } from "../../../review/store.ts";
import { useOcrStatus } from "../hooks/useOcrStatus.ts";
import { OcrStatusBar } from "./OcrStatusBar.tsx";
import { ReviewIdleState } from "./ReviewIdleState.tsx";
import { ReviewRunView } from "./ReviewRunView.tsx";
import { RunPicker } from "./RunPicker.tsx";

/**
 * 「代码审查」标签页的装配入口：标题 + 运行选择 + 依赖状态 + 结果视图。
 * 这里只做组合，不承载任何业务判断——过滤、分组、空态成因都在下层组件里。
 */
export function ReviewPanel({
	store,
	provider,
}: {
	store: ReviewStore;
	provider: OcrProviderBridge;
}): JSX.Element {
	const [, force] = useState(0);
	useEffect(() => store.subscribe(() => force((n) => n + 1)), [store]);

	const status = useOcrStatus(provider);
	const runs = store.getRuns();
	const [pinnedId, setPinnedId] = useState<string | null>(null);

	const latest = runs[runs.length - 1];
	const pinned = pinnedId ? runs.find((run) => run.id === pinnedId) : undefined;
	const run = pinned ?? latest;

	return (
		<div className="flex h-full flex-col">
			<div className="flex items-center gap-2 border-b border-border px-3 py-2">
				<span className="text-sm font-medium">代码审查</span>
				<span className="text-xs text-muted-foreground">ocr · alibaba/open-code-review</span>
				{run ? (
					<span className="ml-auto">
						<RunPicker runs={runs} activeId={run.id} onSelect={setPinnedId} />
					</span>
				) : null}
			</div>
			<OcrStatusBar provider={provider} status={status} />
			{/* key 绑运行 id：切到另一次运行就重置筛选/隐藏状态，不把上一次的筛选带到这一次。 */}
			{run ? <ReviewRunView key={run.id} run={run} store={store} /> : <ReviewIdleState />}
		</div>
	);
}
