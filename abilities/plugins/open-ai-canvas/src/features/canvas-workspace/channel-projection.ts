/**
 * 渠道投影的纯函数层（ADR-0015）。
 *
 * 画布的创作目录读 `GET /api/model-catalog`，数据源是**系统渠道模型**，因此一条模型要能被
 * 创作页看见并使用，必须同时满足：渠道 `enabled`、渠道模型 `enabled`、能力配置可解析、
 * 至少一个已启用的有效价格档（`available` 由它派生）。这套过滤在
 * `backend/internal/app/model_catalog.go` 里逐条成立，所以「连接」写的是三级，
 * 而写没写对只能靠**读回同一张目录**确认。
 *
 * 这里不碰 IO：payload 形状与读回分类都是纯函数，`verify-channel-projection.mjs` 直接测它们。
 */

/** 画布没有「来源」字段，只能用名字前缀认领自己的渠道。 */
export const BRIDGE_CHANNEL_PREFIX = "astravia-bridge-";
export const BRIDGE_CHANNEL_NAME = `${BRIDGE_CHANNEL_PREFIX}host-text`;
/** 画布目录里给这批模型的分组名。 */
export const BRIDGE_CHANNEL_LABEL = "Astravia";
/** shim 暴露的是 OpenAI 兼容的 `/bridge/v1`，所以协议只能是它。 */
export const BRIDGE_CHANNEL_PROTOCOL = "chat-completion";

/** 创建渠道时**不带** `models`：那条路径会建出禁用且无价的渠道模型。 */
export const EMPTY_CHANNEL_MODELS: string[] = [];

export interface HostTextModel {
  modelKey: string;
  displayName: string;
  contextWindow: number;
  maxOutputTokens: number;
}

export interface BridgeChannelPayload {
  name: string;
  baseUrl: string;
  apiKey: string;
  models: string[];
  enabled: boolean;
}

export interface BridgeChannelModelPayload {
  modelKey: string;
  providerModelKey: string;
  displayName: string;
  channelLabel: string;
  capability: "text";
  protocol: string;
  enabled: boolean;
  billingMode: "fixed_request";
  unitPriceMicrocredits: number;
  priceConfigured: boolean;
  capabilityConfig: {
    version: number;
    text: {
      streaming: boolean;
      contextWindowTokens: number;
      maxOutputTokens: number;
      references: {
        promptMaxChars: number;
        maxImages: number;
        maxImageBytes: number;
        maxVideos: number;
        maxVideoBytes: number;
      };
    };
  };
}

export type BlockedReason = "unavailable" | "not-text" | "no-capability";

export interface ProjectionReport {
  channelFound: boolean;
  usable: string[];
  blocked: Array<{ modelKey: string; reason: BlockedReason }>;
  missing: string[];
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const number = typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : fallback;
  return Math.min(max, Math.max(min, number));
}

/**
 * 能力参数按画布自己的校验区间夹住：上下文 4096–10,000,000，输出 256–1,000,000
 * 且必须小于上下文，提示词字符数至少 1（`model_capability_validate.go:19-37`）。
 */
export function textCapabilityConfig(model: Pick<HostTextModel, "contextWindow" | "maxOutputTokens">) {
  const contextWindowTokens = clampInt(model.contextWindow, 4096, 10_000_000, 128_000);
  const maxOutputTokens = clampInt(model.maxOutputTokens, 256, Math.min(1_000_000, contextWindowTokens - 1), 16_384);
  return {
    version: 1,
    text: {
      streaming: true,
      contextWindowTokens,
      maxOutputTokens,
      references: {
        promptMaxChars: 32_000,
        maxImages: 0,
        maxImageBytes: 0,
        maxVideos: 0,
        maxVideoBytes: 0,
      },
    },
  };
}

/**
 * 只投影文本能力。shim 的 `/bridge/v1/images|videos/generations` 恒回
 * `501 host-media-not-exposed`，把媒体模型也写进画布只会造出点了必然失败的条目（ADR-0015 决策 5）。
 */
export function selectBridgeTextModels(
  models: Array<{ modelKey?: unknown; name?: unknown; input?: unknown; contextWindow?: unknown; maxTokens?: unknown }>,
): HostTextModel[] {
  const seen = new Set<string>();
  const selected: HostTextModel[] = [];
  for (const model of models) {
    const modelKey = typeof model.modelKey === "string" ? model.modelKey.trim() : "";
    if (!modelKey || seen.has(modelKey)) continue;
    const input = Array.isArray(model.input) ? model.input : [];
    if (!input.includes("text")) continue;
    seen.add(modelKey);
    selected.push({
      modelKey,
      displayName: typeof model.name === "string" && model.name.trim() ? model.name.trim() : modelKey,
      contextWindow: typeof model.contextWindow === "number" ? model.contextWindow : 0,
      maxOutputTokens: typeof model.maxTokens === "number" ? model.maxTokens : 16_384,
    });
  }
  return selected;
}

export function bridgeChannelPayload(baseUrl: string, token: string): BridgeChannelPayload {
  return {
    name: BRIDGE_CHANNEL_NAME,
    baseUrl: `${baseUrl.replace(/\/+$/, "")}/bridge/v1`,
    apiKey: token,
    models: [...EMPTY_CHANNEL_MODELS],
    enabled: true,
  };
}

/**
 * 免费固定价是刻意的：桥接是本机中继，不产生计费。缺这一级时画布算 `available: false`，
 * 模型在创作页里等于不存在。
 */
export function bridgeChannelModelPayload(model: HostTextModel): BridgeChannelModelPayload {
  return {
    modelKey: model.modelKey,
    providerModelKey: model.modelKey,
    displayName: model.displayName,
    channelLabel: BRIDGE_CHANNEL_LABEL,
    capability: "text",
    protocol: BRIDGE_CHANNEL_PROTOCOL,
    enabled: true,
    billingMode: "fixed_request",
    unitPriceMicrocredits: 0,
    priceConfigured: true,
    capabilityConfig: textCapabilityConfig(model),
  };
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function channelsOf(raw: unknown): Record<string, unknown>[] {
  const body = record(raw);
  const data = record(body.data);
  const list = [data.channels, body.channels].find(Array.isArray);
  return Array.isArray(list) ? list.map(record) : [];
}

/**
 * 读回分类：画布 UI 用的就是这张目录，所以这里是唯一可信的「用户能看见了吗」。
 * 不猜状态码、不看自己刚发的 payload。
 */
export function classifyProjection(raw: unknown, channelId: string, wanted: string[]): ProjectionReport {
  const channel = channelsOf(raw).find((item) => text(item.id) === channelId);
  if (!channel) return { channelFound: false, usable: [], blocked: [], missing: [...wanted] };

  const rows = Array.isArray(channel.models) ? channel.models.map(record) : [];
  const byKey = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const key = text(row.modelKey);
    if (key) byKey.set(key, row);
  }

  const usable: string[] = [];
  const blocked: Array<{ modelKey: string; reason: BlockedReason }> = [];
  const missing: string[] = [];
  for (const modelKey of wanted) {
    const row = byKey.get(modelKey);
    if (!row) {
      missing.push(modelKey);
      continue;
    }
    if (text(row.capability) !== "text") {
      blocked.push({ modelKey, reason: "not-text" });
      continue;
    }
    if (!record(row.capabilityConfig).text) {
      blocked.push({ modelKey, reason: "no-capability" });
      continue;
    }
    if (row.available !== true) {
      blocked.push({ modelKey, reason: "unavailable" });
      continue;
    }
    usable.push(modelKey);
  }
  return { channelFound: true, usable, blocked, missing };
}

/** 需要在自家渠道里删掉的陈旧 modelKey：目录里有、但宿主已经不再提供。 */
export function staleChannelModelKeys(existingKeys: string[], wanted: string[]): string[] {
  const keep = new Set(wanted);
  return existingKeys.filter((key) => key && !keep.has(key));
}
