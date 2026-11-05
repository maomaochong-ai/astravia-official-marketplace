import { CLOSED_SNAPSHOT, type BoardmixSnapshot } from "../../../domain/boardmix-entry";

export interface BoardmixTabHandle {
	navigate(url: string): Promise<BoardmixSnapshot>;
	snapshot(): BoardmixSnapshot;
	openInBrowser(): Promise<boolean>;
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
