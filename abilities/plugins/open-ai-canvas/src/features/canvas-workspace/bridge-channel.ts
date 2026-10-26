/**
 * 画布渠道的投影（ADR-0015）。
 *
 * 「让画布用上 Astravia 的模型」不是在画布里建一条渠道就完事：画布创作页读的是
 * `GET /api/model-catalog`，而那张目录只收**启用的渠道 + 启用的渠道模型 + 可解析的能力配置 +
 * 至少一个有效价格档**。少任何一级，模型在画布里就等于不存在。
 *
 * 所以这里按三级写：渠道（接线）→ 渠道模型（能力与启用）→ 免费固定价档（`available`）。
 * 写完不宣布成功，而是**读回同一张目录**，按 usable / blocked / missing 分类如实报告——
 * 把「我发了请求」当成「用户看得见」正是 CWE-602 的老毛病。
 *
 * 反方向（画布渠道 → 宿主）早已删除：`GET /api/admin/channels` 是 system 作用域，用户渠道不在其中
 * （ADR-0013 记录）。把画布的图片/视频模型接进宿主走媒体 Provider，不复制凭据。
 */
import type { PluginContext } from "../../runtime-contract";
import {
  BRIDGE_CHANNEL_NAME,
  BRIDGE_CHANNEL_PREFIX,
  bridgeChannelModelPayload,
  bridgeChannelPayload,
  classifyProjection,
  selectBridgeTextModels,
  staleChannelModelKeys,
} from "./channel-projection";
import type { BlockedReason } from "./channel-projection";
import { bridgeRequest, bridgeToken, BridgeError } from "./bridge-client";

export { BridgeError as BridgeChannelError } from "./bridge-client";
export { BRIDGE_CHANNEL_PREFIX } from "./channel-projection";

interface CanvasChannel {
  id: string;
  name: string;
}

interface CanvasChannelModel {
  id: string;
  modelKey: string;
}

interface ChannelListBody {
  data?: { channels?: CanvasChannel[] };
  channels?: CanvasChannel[];
}

interface ChannelModelListBody {
  data?: { models?: CanvasChannelModel[] };
  models?: CanvasChannelModel[];
}

export interface BridgeChannelResult {
  channelId: string;
  created: boolean;
  /** 宿主当前提供的文本模型。 */
  requested: string[];
  /** 读回目录后确认「画布看得见且可用」的模型。 */
  usable: string[];
  /** 写进去了但目录判为不可用：价格档、能力配置或启用位没落地。 */
  blocked: Array<{ modelKey: string; reason: BlockedReason }>;
  /** 目录里压根没出现：渠道或渠道模型被上游跳过。 */
  missing: string[];
  /** 写请求本身被拒的模型（能力合同、重复键等）。 */
  rejected: Array<{ modelKey: string; message: string }>;
  /** 在本渠道内清掉的陈旧模型数。 */
  removed: number;
}

function channelsOf(body: ChannelListBody | undefined): CanvasChannel[] {
  return body?.data?.channels ?? body?.channels ?? [];
}

function channelModelsOf(body: ChannelModelListBody | undefined): CanvasChannelModel[] {
  return body?.data?.models ?? body?.models ?? [];
}

function idOf(body: { data?: { channel?: CanvasChannel }; channel?: CanvasChannel } | undefined): string {
  return body?.data?.channel?.id ?? body?.channel?.id ?? "";
}

export async function provisionBridgeChannel(
  ctx: PluginContext,
  baseUrl: string | undefined,
): Promise<BridgeChannelResult> {
  if (!baseUrl) {
    throw new BridgeError("canvas-channel-write-failed", "canvas service is not running");
  }
  const token = await bridgeToken(ctx);
  const listed = await ctx.ai.listModels();
  const models = selectBridgeTextModels(listed.models);
  if (models.length === 0) {
    throw new BridgeError("no-text-models", "the host has no text model available");
  }
  const requested = models.map((model) => model.modelKey);

  // 1. 渠道：只有接线，模型留空（带 models 会让上游建出禁用且无价的渠道模型）。
  const existing = await bridgeRequest<ChannelListBody>(ctx, { path: "/bridge/admin/channels", method: "GET" });
  const channelPayload = bridgeChannelPayload(baseUrl, token);
  const claimed = channelsOf(existing);
  const current = claimed.find((channel) => channel.name === BRIDGE_CHANNEL_NAME)
    ?? claimed.find((channel) => channel.name.startsWith(BRIDGE_CHANNEL_PREFIX));

  let channelId: string;
  let created: boolean;
  if (current) {
    await bridgeRequest(ctx, { path: `/bridge/admin/channels/${current.id}`, method: "PATCH", body: channelPayload });
    channelId = current.id;
    created = false;
  } else {
    const response = await bridgeRequest<{ data?: { channel?: CanvasChannel }; channel?: CanvasChannel }>(ctx, {
      path: "/bridge/admin/channels",
      method: "POST",
      body: channelPayload,
    });
    channelId = idOf(response);
    created = true;
    if (!channelId) {
      throw new BridgeError("canvas-channel-write-failed", "canvas accepted the channel but returned no id");
    }
  }

  // 2. 渠道模型：按 modelKey 就地 upsert。逐条写，单条被拒不该拖垮其余模型。
  const listedModels = await bridgeRequest<ChannelModelListBody>(ctx, {
    path: `/bridge/admin/channels/${channelId}/models`,
    method: "GET",
  });
  const existingModels = channelModelsOf(listedModels);
  const existingByKey = new Map(existingModels.map((model) => [model.modelKey, model.id]));

  const rejected: Array<{ modelKey: string; message: string }> = [];
  for (const model of models) {
    const body = bridgeChannelModelPayload(model);
    const existingId = existingByKey.get(model.modelKey);
    try {
      if (existingId) {
        await bridgeRequest(ctx, { path: `/bridge/admin/channels/${channelId}/models/${existingId}`, method: "PATCH", body });
      } else {
        await bridgeRequest(ctx, { path: `/bridge/admin/channels/${channelId}/models`, method: "POST", body });
      }
    } catch (error) {
      rejected.push({ modelKey: model.modelKey, message: error instanceof Error ? error.message : String(error) });
    }
  }

  // 3. 陈旧条目：只在自家渠道内删，别人的渠道一个字都不动。
  let removed = 0;
  for (const key of staleChannelModelKeys(existingModels.map((model) => model.modelKey), requested)) {
    const id = existingByKey.get(key);
    if (!id) continue;
    try {
      await bridgeRequest(ctx, { path: `/bridge/admin/channels/${channelId}/models/${id}`, method: "DELETE" });
      removed += 1;
    } catch {
      // 删不掉不算失败：目录分类会把它算进 missing/blocked，用户看得见。
    }
  }

  // 4. 读回画布 UI 自己用的那张目录，只有它说的话算数。
  const catalog = await bridgeRequest<unknown>(ctx, { path: "/bridge/canvas/model-catalog", method: "GET" });
  const report = classifyProjection(catalog, channelId, requested);
  if (report.usable.length === 0) {
    throw new BridgeError(
      "canvas-models-invisible",
      `canvas catalog shows none of ${requested.length} model(s) (blocked ${report.blocked.length}, missing ${report.missing.length})`,
    );
  }

  return {
    channelId,
    created,
    requested,
    usable: report.usable,
    blocked: report.blocked,
    missing: report.missing,
    rejected,
    removed,
  };
}
