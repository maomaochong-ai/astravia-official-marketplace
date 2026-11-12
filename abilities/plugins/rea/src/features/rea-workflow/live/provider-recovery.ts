/**
 * REA 引擎（cli provider）自愈：失败后有界重试，恢复后提醒 Agent 回到原来的逆向步骤。
 *
 * 只在 phase === "failed" 时动手 —— "disabled" 是用户/宿主的显式状态，不重试。
 * 每次失败连最多重试 3 次（5s / 15s / 45s），成功后计数归零。
 *
 * **只在用户真的调过 REA 时才说话。** 装完插件那一刻引擎通常还没装，这是正常起点，
 * 不是故障：面板的引擎页已经把「没装 / 版本旧 / 没权限」分开写清楚了，再抢一条
 * 「引擎不可用」的右下角提示，用户读到的只会是「这插件是不是不能用」。
 * 即使要报，也不制造 `error`：宿主会因此挂上「复制堆栈」并让提示永不消失，而这里
 * 根本没有栈可看——失败原因本来就在面板的最近输出里。
 */

import type { Disposable, PluginCliProviderStatus, PluginContext } from "@astravia-org/plugin-sdk";
import { logger } from "@astravia-org/plugin-sdk/logger";
import type { ReaLiveStore } from "./session-store";

export interface ReaRecoveryOptions {
	readonly maxAttempts?: number;
	readonly delaysMs?: readonly number[];
}

export interface ReaRecoveryState {
	readonly attempts: number;
	readonly awaiting: boolean;
	readonly exhausted: boolean;
	readonly sawFailure: boolean;
}

export interface ReaRecoveryHandle extends Disposable {
	/** 立即重试一次（用户点了重试按钮时可用）。 */
	retryNow(): Promise<void>;
	state(): ReaRecoveryState;
}

const DEFAULT_DELAYS: readonly number[] = [5_000, 15_000, 45_000];

/** 一条提示活多久：够读完那句话，不够变成一个永久横幅。 */
const ENGINE_NOTICE_MS = 8_000;

export function activateProviderRecovery(
	ctx: PluginContext,
	store: ReaLiveStore,
	providerId: string,
	options: ReaRecoveryOptions = {},
): ReaRecoveryHandle {
	const maxAttempts = options.maxAttempts ?? DEFAULT_DELAYS.length;
	const delays = options.delaysMs ?? DEFAULT_DELAYS;

	let attempts = 0;
	let awaiting = false;
	let exhausted = false;
	let sawFailure = false;
	let timer: ReturnType<typeof setTimeout> | null = null;
	let disposed = false;

	const clearTimer = (): void => {
		if (timer !== null) {
			clearTimeout(timer);
			timer = null;
		}
		awaiting = false;
	};

	const scheduleRetry = (): void => {
		if (disposed || awaiting || exhausted || attempts >= maxAttempts) return;
		const delay = delays[Math.min(attempts, delays.length - 1)] ?? 15_000;
		awaiting = true;
		timer = setTimeout(() => {
			timer = null;
			awaiting = false;
			void attempt();
		}, delay);
	};

	const attempt = async (): Promise<void> => {
		if (disposed) return;
		attempts += 1;
		try {
			await ctx.cliProviders.retry(providerId);
		} catch (error) {
			logger.warn("REA provider retry failed", { error: String(error) });
		}
		if (!disposed && attempts >= maxAttempts && !exhausted) markExhausted();
	};

	const markExhausted = (): void => {
		exhausted = true;
		// 本会话一次 REA 调用都没有：用户只是在看插件，并没打算用它。
		// 面板的引擎页已经把状态与修法写在那里，这时候弹提示只会被读成「插件坏了」。
		if (store.sessionCallCount() === 0) return;
		const reason = store.getSnapshot().providerMessage?.trim();
		ctx.ui.notify({
			title: ctx.i18n.t("live.engine.exhaustedTitle"),
			message: ctx.i18n.t("live.engine.exhausted", {
				message: reason !== undefined && reason.length > 0 ? reason : ctx.i18n.t("live.engine.unknownReason"),
			}),
			variant: "warning",
			durationMs: ENGINE_NOTICE_MS,
		});
	};

	const applyStatus = (status: PluginCliProviderStatus): void => {
		if (status.providerId !== providerId) return;
		store.setProvider(status.phase, status.message);
		switch (status.phase) {
			case "ready": {
				clearTimer();
				const wasBroken = sawFailure;
				attempts = 0;
				exhausted = false;
				sawFailure = false;
				// 同样只在本会话真的用过 REA 时才报：“可以用了”对一个从没打算用它的人也是噪音。
				if (wasBroken && store.sessionCallCount() > 0) {
					ctx.ui.notify({
						message: ctx.i18n.t("live.engine.recovered"),
						variant: "success",
						durationMs: ENGINE_NOTICE_MS,
					});
				}
				return;
			}
			case "failed": {
				sawFailure = true;
				if (exhausted) return;
				if (!awaiting) scheduleRetry();
				return;
			}
			default: {
				// checking / installing / verifying：宿主已经在忙，别抢。
				clearTimer();
				return;
			}
		}
	};

	const statusSubscription = ctx.cliProviders.onStatusChanged((status) => {
		applyStatus(status);
	});

	void ctx.cliProviders
		.getStatus(providerId)
		.then((status) => {
			applyStatus(status);
		})
		.catch((error: unknown) => {
			logger.warn("REA provider status unavailable", { error: String(error) });
		});

	return {
		retryNow: async (): Promise<void> => {
			clearTimer();
			exhausted = false;
			attempts = 0;
			await attempt();
		},
		state: (): ReaRecoveryState => ({ attempts, awaiting, exhausted, sawFailure }),
		dispose: (): void => {
			disposed = true;
			clearTimer();
			statusSubscription.dispose();
		},
	};
}
