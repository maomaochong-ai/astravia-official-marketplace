import { useCallback, useEffect, useRef, useState } from "react";
import type { PluginContext } from "@astravia-org/plugin-sdk";
import { generateMarksWithHost, HostMediaError, listImageProviders, type HostImageProvider } from "../../../domain/ai/host-media";
import { newDesignId, type DesignRecord } from "../../../domain/history-store";
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type PluginSettings } from "../../../domain/settings";
import type { LogoSpec } from "../../../domain/spec";
import { getHistoryStore, getPluginContext } from "../../../plugin-context";

/**
 * One "run": N marks from one brief, **always through the host's image model**.
 *
 * 这个插件不再自带离线出图：logo 的质量来自宿主的图像模型，本地引擎画出来的东西
 * 是另一类产物（矢量草稿），混在一起只会让人以为「点了就能出图、只是难看」。
 * 画布上的二次编辑（改描述、留备注、导出）仍然保留，改动以 prompt 的形式回到会话。
 *
 * 没有连接图像服务时不假装成功：返回空批次，面板负责引导去设置。
 */

export type GenerateMode = "ai";

export interface GenerateOptions {
	/** Existing blob to edit instead of generating from text (image-to-image). */
	reference?: string;
	/** Walk the style list instead of repeating one style. */
	surprise?: boolean;
	/** Overrides the panel setting for this run. */
	count?: number;
}

export interface GenerateBatch {
	/** Ids of the records this run actually stored, in generation order. */
	ids: string[];
	engine: "ai";
}

export interface GenerationApi {
	running: boolean;
	/** Host image models that can do text-to-image right now. */
	providers: HostImageProvider[];
	/** The host denied `media.generate` — the user has to re-authorise the plugin. */
	aiDenied: boolean;
	refreshProviders: () => Promise<void>;
	settings: PluginSettings;
	updateSettings: (patch: Partial<PluginSettings>) => void;
	updateVariations: (value: number) => void;
	generate: (spec: LogoSpec, options?: GenerateOptions) => Promise<GenerateBatch>;
	lastCreatedId: string | null;
}

const STYLE_WALK: LogoSpec["style"][] = [
	"minimal",
	"geometric",
	"luxury",
	"retro",
	"hand-drawn",
	"3d",
	"mascot",
	"gradient",
];

export function useGeneration(messages: {
	aiUnavailable: string;
	/** Shown when nothing is connected: the panel then opens the AI settings. */
	aiNoProvider: string;
	aiFailed: string;
	/** 图像服务连上了但没产出图片时的可执行说明。 */
	aiFailedHint: string;
	aiDone: (count: number) => string;
	aiPartial: (failed: number) => string;
}): GenerationApi {
	const [running, setRunning] = useState(false);
	const [settings, setSettings] = useState<PluginSettings>(DEFAULT_SETTINGS);
	const [providers, setProviders] = useState<HostImageProvider[]>([]);
	const [aiDenied, setAiDenied] = useState(false);
	const [lastCreatedId, setLastCreatedId] = useState<string | null>(null);
	const busy = useRef(false);

	const refreshProviders = useCallback(async () => {
		try {
			const next = await listImageProviders(getPluginContext());
			setProviders(next);
			setAiDenied(false);
			// 记住可用的第一个：用户没选过就默认用它，选过就尊重选择。
			setSettings((current) =>
				current.providerId && next.some((provider) => provider.id === current.providerId)
					? current
					: { ...current, providerId: next[0]?.id },
			);
		} catch (cause) {
			// 两种情况在这里必须分开：宿主没配 provider，或权限没给（升级不带新权限）。
			setProviders([]);
			setAiDenied(cause instanceof HostMediaError && cause.code === "permission-denied");
			if (cause instanceof Error) console.warn("[logocreator] image providers unavailable", cause.message);
		}
	}, []);

	useEffect(() => {
		const ctx = getPluginContext();
		void loadSettings(ctx.storage).then(setSettings);
		void refreshProviders();
	}, [refreshProviders]);

	const updateSettings = useCallback((patch: Partial<PluginSettings>) => {
		setSettings((current) => {
			const next = { ...current, ...patch };
			void saveSettings(getPluginContext().storage, next).catch(() => undefined);
			return next;
		});
	}, []);

	const updateVariations = useCallback(
		(value: number) => {
			const variations = Math.max(1, Math.min(8, Math.round(Number(value) || 1)));
			updateSettings({ variations });
		},
		[updateSettings],
	);

	const generate = useCallback(
		async (spec: LogoSpec, options: GenerateOptions = {}): Promise<GenerateBatch> => {
			if (busy.current) return { ids: [], engine: "ai" };
			const ctx: PluginContext = getPluginContext();

			if (providers.length === 0) {
				ctx.ui.notify({ message: messages.aiNoProvider, variant: "warning" });
				return { ids: [], engine: "ai" };
			}

			busy.current = true;
			setRunning(true);
			const history = getHistoryStore();
			const baseCount = Math.max(1, Math.min(8, options.count ?? settings.variations));
			// 「每种风格各出一张」= 数量 = 风格数；编辑只出一张（换风格就不是「改这张」了）。
			const count = options.reference ? 1 : options.surprise ? STYLE_WALK.length : baseCount;

			const ids: string[] = [];
			const failures: string[] = [];
			try {
				// 逐张提交：每张的 style 不同（surprise），失败也只影响那一张。
				for (let index = 0; index < count; index += 1) {
					const style = options.surprise ? STYLE_WALK[index % STYLE_WALK.length]! : spec.style;
					try {
						const { images, failures: partial } = await generateMarksWithHost(ctx, {
							spec: { ...spec, style },
							count: 1,
							providerId: settings.providerId,
							...(options.reference ? { referenceBlobId: options.reference } : {}),
						});
						failures.push(...partial);
						for (const image of images) {
							const record: DesignRecord = await history.add({
								id: newDesignId(),
								spec: { ...spec, style },
								engine: "ai",
								subject: image.modelId ?? image.providerId,
								blobId: image.blobId,
							});
							ids.push(record.id);
						}
					} catch (cause) {
						failures.push(cause instanceof Error ? cause.message : String(cause));
					}
				}

				if (ids.length > 0) setLastCreatedId(ids[ids.length - 1]!);
				if (ids.length > 0) {
					ctx.ui.notify({ message: messages.aiDone(ids.length), variant: "success" });
				}
				if (failures.length > 0) {
					ctx.ui.notify({ message: messages.aiPartial(failures.length), variant: "warning" });
				}
				if (ids.length === 0) {
					ctx.ui.notify({ message: messages.aiFailedHint, variant: "error" });
				}
			} catch (cause) {
				if (cause instanceof HostMediaError) {
					ctx.ui.notify({
						message: cause.code === "provider-failed" ? messages.aiFailedHint : cause.message,
						title: messages.aiUnavailable,
						variant: "error",
						error: cause,
					});
				} else {
					ctx.ui.notify({ message: messages.aiFailed, error: cause });
				}
			} finally {
				setRunning(false);
				busy.current = false;
			}

			return { ids, engine: "ai" };
		},
		[messages, providers.length, settings.providerId, settings.variations],
	);

	return {
		running,
		providers,
		aiDenied,
		refreshProviders,
		settings,
		updateSettings,
		updateVariations,
		generate,
		lastCreatedId,
	};
}

/** 供面板之外复用的选择器：宿主有没有可用的图像模型。 */
export async function hasImageModel(ctx: PluginContext): Promise<boolean> {
	try {
		return (await listImageProviders(ctx)).length > 0;
	} catch {
		return false;
	}
}

