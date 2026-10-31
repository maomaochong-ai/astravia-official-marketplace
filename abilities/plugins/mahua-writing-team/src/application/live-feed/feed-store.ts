import type { FeedDraft, FeedEvent } from "./feed-types.js";

/** 环形缓冲上限：运行台只留最近这些条，更早的靠 `book.checkpoints` 去查。 */
export const FEED_LIMIT = 200;

type Listener = () => void;
type Sink = (events: readonly FeedEvent[]) => void;

/**
 * 活动流的进程内总线。
 *
 * 为什么是内存总线而不是订阅存储：hook handler 由宿主的渲染进程桥调用
 * （`coding-agent-hook-invocation.ts`），与插件 UI 在**同一个 JS 上下文**里，
 * 所以一次 `append` 就能同步通知已挂载的运行台，不需要轮询、不需要刷新。
 * `ctx.storage` 没有 watch/subscribe，只负责跨 reload 的持久化。
 */
class FeedStore {
	private events: FeedEvent[] = [];
	private listeners = new Set<Listener>();
	private sink: Sink | null = null;
	private seq = 0;

	subscribe = (listener: Listener): (() => void) => {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	};

	getSnapshot = (): readonly FeedEvent[] => this.events;

	/** 最新在最前，与落盘时间线的倒序同一口径。 */
	append(draft: FeedDraft): FeedEvent {
		const event: FeedEvent = { ...draft, id: `${draft.at}#${(this.seq += 1)}` };
		const next = [event, ...this.events];
		this.events = next.length > FEED_LIMIT ? next.slice(0, FEED_LIMIT) : next;
		this.emit();
		return event;
	}

	/** 只在流是空的时候灌入历史：hook 先到说明这一轮已经有真事件，历史不该压在它前面。 */
	hydrate(events: readonly FeedEvent[]): void {
		if (this.events.length > 0 || events.length === 0) return;
		this.events = [...events].slice(0, FEED_LIMIT);
		// 序号要接着历史往下数：进程重启后 seq 从 0 起，与灌回来的 id 撞车会让
		// React key 重复、同一个 key 渲染两条事件。
		this.seq = Math.max(this.seq, ...this.events.map(suffixOf));
		this.emit();
	}

	clear(): void {
		if (this.events.length === 0) return;
		this.events = [];
		this.emit();
	}

	setSink(sink: Sink | null): void {
		this.sink = sink;
	}

	private emit(): void {
		for (const listener of this.listeners) listener();
		this.sink?.(this.events);
	}
}

/** `2026-10-31T…#12` 里的 12；不是这个形状就返回 0（旧记录不参与推进序号）。 */
function suffixOf(event: FeedEvent): number {
	const at = event.id.lastIndexOf("#");
	if (at === -1) return 0;
	const value = Number(event.id.slice(at + 1));
	return Number.isFinite(value) ? value : 0;
}

export const feedStore = new FeedStore();
