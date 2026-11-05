import { CLOSED_SNAPSHOT, type BoardmixSnapshot } from "../../../domain/boardmix-entry";
import type { PrimitiveGap } from "../../../domain/boardmix-primitive";

export interface BoardmixTabHandle {
	navigate(url: string): Promise<BoardmixSnapshot>;
	snapshot(): BoardmixSnapshot;
	openInBrowser(): Promise<boolean>;
	/** 读访客页的 DOM；不可用时 null（不抛，调用方据此回报 `primitive-unavailable`）。 */
	read(code: string): Promise<unknown>;
	/** 截访客页可见区域，PNG 的 base64；不可用或超时都是 null。 */
	shot(): Promise<string | null>;
	/** 发一串真实输入事件；不可用时 false。 */
	input(events: unknown[]): boolean;
	/** 这个运行时缺哪几个能力；空数组表示三个都在。 */
	gaps(): PrimitiveGap[];
}

let current: BoardmixTabHandle | null = null;
const waiters = new Set<(handle: BoardmixTabHandle | null) => void>();

export function setBoardmixTab(next: BoardmixTabHandle | null): void {
	current = next;
	for (const resolve of [...waiters]) {
		// tab 卸载不等于失败：等它的人立刻拿到 null，由调用方给出「标签页已关闭」。
		if (!next) {
			waiters.delete(resolve);
			resolve(null);
			continue;
		}
		waiters.delete(resolve);
		resolve(next);
	}
}

export function boardmixTab(): BoardmixTabHandle | null {
	return current;
}

/** 工具里用：先开标签页，再等它挂上句柄；超时就是没挂上，不无限等。 */
export function waitForBoardmixTab(timeoutMs = 5000): Promise<BoardmixTabHandle | null> {
	if (current) return Promise.resolve(current);
	return new Promise(resolve => {
		const settle = (handle: BoardmixTabHandle | null) => {
			clearTimeout(timer);
			waiters.delete(settle);
			resolve(handle);
		};
		const timer = setTimeout(() => settle(null), timeoutMs);
		waiters.add(settle);
	});
}

/** 只读入口：没开标签页就返回 closed 快照，绝不为了读而开页。 */
export function snapshotOrClosed(): BoardmixSnapshot {
	const handle = boardmixTab();
	return handle ? handle.snapshot() : CLOSED_SNAPSHOT;
}
