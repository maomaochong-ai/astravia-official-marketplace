import { useEffect, useState } from "react";
import { tryGetStudioRuntime } from "../../../plugin-context.js";

/** 运行时可能比首次渲染晚一步到（冷启动 / 热重载 / 插件重新启用），这个间隔足够把空窗补上。 */
const RETRY_MS = 200;

/** 60 秒还没等到就停——再等下去只是白烧定时器，骨架留在原地比无限轮询诚实。 */
const MAX_TRIES = 300;

/**
 * 运行时到没到。
 *
 * `plugin-context` 是个普通模块变量，没有订阅；一次渲染读到 null 之后不会再变。
 * 之前两处守卫都是「读一次、没有就画骨架」，于是凡是早到的渲染都会留下永久骨架。
 * 这里在缺失时按 200ms 复查，出现即停。
 */
export function useStudioRuntimeReady(): boolean {
	const [ready, setReady] = useState(() => tryGetStudioRuntime() !== null);

	useEffect(() => {
		if (ready) return;
		let tries = 0;
		const timer = setInterval(() => {
			tries += 1;
			if (tryGetStudioRuntime() !== null) {
				clearInterval(timer);
				setReady(true);
				return;
			}
			if (tries >= MAX_TRIES) clearInterval(timer);
		}, RETRY_MS);
		return () => clearInterval(timer);
	}, [ready]);

	return ready;
}
