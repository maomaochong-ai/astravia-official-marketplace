/**
 * 探测结果的小缓存：TTL + 单飞（single-flight）。
 *
 * 为什么需要它：面板的 `refresh()` 在**每次工具调用结束**都会请求 `/api/state`，
 * 而这个接口要问 docker「daemon 在不在」「镜像在不在」——两次子进程，实测 3.1 秒；
 * 本机模式下还要再跑一遍工具链 `--version`，又 4.6 秒。也就是说：每调一次工具，
 * 就有几秒钟花在重复回答同一个问题上，而且这些子进程会跟真正的扫描抢 CPU 与磁盘。
 *
 * 两条语义，分开写清楚：
 *
 *  - **TTL**：多久之后允许重新探测。纯读接口用这个。
 *  - **单飞**：并发请求共享同一个在飞的 Promise。没有它，一轮里的 N 个并发工具调用
 *    会各起一份探测，N 倍开销。
 *  - **强制**：`force` 跳过缓存（用户点了「刷新环境」、装了 docker、拉了镜像、
 *    或者模型主动查了一次环境），并且**也参与单飞**——强制只意味着"别用旧值"，
 *    不意味着"同时跑十份"。
 *
 * 故意不做的事：不缓存失败（失败也要走 TTL，否则 docker 起起来的瞬间面板还写着不可用），
 * 但失败的 TTL 更短。
 */

export interface CacheEntry<T> {
	value: T;
	/** 写入时刻（毫秒）。 */
	at: number;
}

export interface ProbeCache<T> {
	/** 读缓存；`force` 为真时不看旧值。并发调用共享同一个在飞的探测。 */
	get(force?: boolean): Promise<T>;
	/** 当前缓存值（可能过期），没有就是 undefined。 */
	peek(): T | undefined;
	/** 丢掉缓存（下一次 get 一定重探）。 */
	invalidate(): void;
}

export interface ProbeCacheOptions<T> {
	probe: () => Promise<T>;
	/** 成功结果的存活时间。 */
	ttlMs: number;
	/** 失败结果的存活时间（默认取 ttlMs 的 1/4，且至少 500ms）。 */
	failureTtlMs?: number;
	/** 判定"这次探测算失败"：默认抛错才算失败。 */
	isFailure?: (value: T) => boolean;
	now?: () => number;
	/** 单飞测试用：把在飞的 Promise 暴露出来（生产代码不需要）。 */
	onProbe?: () => void;
}

export function createProbeCache<T>(options: ProbeCacheOptions<T>): ProbeCache<T> {
	const { probe, ttlMs, isFailure, now = Date.now, onProbe } = options;
	const failureTtl = options.failureTtlMs ?? Math.max(500, Math.floor(ttlMs / 4));
	let entry: CacheEntry<T> | undefined;
	let inFlight: Promise<T> | undefined;

	const fresh = (): boolean => {
		if (!entry) return false;
		const age = now() - entry.at;
		const failed = isFailure ? isFailure(entry.value) : false;
		return age < (failed ? failureTtl : ttlMs);
	};

	return {
		async get(force = false) {
			if (!force && fresh()) return entry!.value;
			if (inFlight) return inFlight;
			onProbe?.();
			inFlight = probe()
				.then((value) => {
					entry = { value, at: now() };
					return value;
				})
				.finally(() => {
					inFlight = undefined;
				});
			return inFlight;
		},
		peek() {
			return entry?.value;
		},
		invalidate() {
			entry = undefined;
		},
	};
}
