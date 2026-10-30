import { readJsonFile, writeJsonFile, type PluginStorageApi } from "@astravia-org/plugin-sdk";
import { feedStore } from "./feed-store.js";
import type { FeedEvent } from "./feed-types.js";

/** 活动流的持久化位置：与作品数据分开，清掉它不影响正文。 */
const FEED_PATH = "console/feed.json";

/** 一次团队回合会连着来十几条事件，逐条落盘等于逐条写文件，所以合并到一个窗口里写。 */
const WRITE_DELAY_MS = 1200;

interface FeedFile {
	version: 1;
	events: FeedEvent[];
}

function isFeedEvent(value: unknown): value is FeedEvent {
	if (typeof value !== "object" || value === null) return false;
	const event = value as Record<string, unknown>;
	return (
		typeof event.id === "string" &&
		typeof event.at === "string" &&
		typeof event.textKey === "string" &&
		(event.origin === "team" || event.origin === "studio" || event.origin === "agent") &&
		(event.status === "start" || event.status === "done" || event.status === "failed")
	);
}

/** 读回上一次会话的活动流；文件缺失或格式不对就当没有，不拦启动。 */
export async function hydrateFeed(storage: PluginStorageApi): Promise<void> {
	try {
		const file = await readJsonFile<FeedFile>(storage, FEED_PATH);
		if (!file || !Array.isArray(file.events)) return;
		feedStore.hydrate(file.events.filter(isFeedEvent));
	} catch {
		// 读失败不是错误：活动流是观感，不是账本。
	}
}

/** 把总线接到存储上，返回卸载函数（会补写最后一批事件）。 */
export function attachFeedPersistence(storage: PluginStorageApi): () => void {
	let timer: ReturnType<typeof setTimeout> | null = null;

	const write = (events: readonly FeedEvent[]): Promise<unknown> =>
		writeJsonFile(storage, FEED_PATH, { version: 1, events: [...events] } satisfies FeedFile).catch(
			() => undefined,
		);

	feedStore.setSink((events) => {
		if (timer) return;
		timer = setTimeout(() => {
			timer = null;
			void write(feedStore.getSnapshot());
		}, WRITE_DELAY_MS);
	});

	return () => {
		feedStore.setSink(null);
		if (timer) {
			clearTimeout(timer);
			timer = null;
			void write(feedStore.getSnapshot());
		}
	};
}
