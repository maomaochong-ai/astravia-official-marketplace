/**
 * REA 引擎（cli provider）自愈：失败后有界重试，恢复后提醒 Agent 回到原来的逆向步骤。
 *
 * 只在 phase === "failed" 时动手 —— "disabled" 是用户/宿主的显式状态，不重试。
 * 每次失败连最多重试 3 次（5s / 15s / 45s），成功后计数归零。
 * 重试机会耗尽后通知用户，并把"降级"交给系统提示块处理（见 agent-integration.ts）。
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
	let warnedStart = false;
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
		if (!warnedStart) {
			warnedStart = true;
			ctx.ui.notify({
				message: ctx.i18n.t("live.engine.schedule", { attempts: String(maxAttempts) }),
				variant: "info",
			});
		}
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
		const lastMessage = store.getSnapshot().providerMessage;
		ctx.ui.notify({
			title: ctx.i18n.t("live.engine.exhaustedTitle"),
			message: lastMessage ?? ctx.i18n.t("live.engine.exhausted"),
			variant: "error",
			error: new Error(lastMessage ?? "rea-agents provider unavailable"),
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
				warnedStart = false;
				if (wasBroken) {
					ctx.ui.notify({ message: ctx.i18n.t("live.engine.recovered"), variant: "success" });
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
			warnedStart = false;
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
