/**
 * 画布渠道的方向管理（ADR-0006 决策 2）。
 *
 * 这里只保留「宿主 → 画布」：把宿主的文本模型写成画布里的一个自定义渠道，让画布里
 * 的对话也能用上宿主的模型。反方向（画布渠道 → 宿主）已经删掉了——它抄的是画布用户
 * 自己填的密钥，而 `GET /api/admin/channels` 是 system 作用域，用户的渠道根本不在其中，
 * 于是它永远只会导出 0 条（ADR-0013 记录了这次审计）。把画布的图片/视频模型接进宿主
 * 走的是媒体 Provider，不复制凭据，见 `canvas-media-provider.ts`。
 */
import type { PluginContext } from "../../runtime-contract";
import { bridgeRequest, bridgeToken, BridgeError } from "./bridge-client";

export { BridgeError as BridgeChannelError } from "./bridge-client";

/** 渠道名前缀：画布没有「来源」字段，只能靠名字认领自己的条目。 */
export const CHANNEL_PREFIX = "astravia-bridge-";

interface CanvasChannel {
  id: string;
  name: string;
  baseUrl: string;
  apiKey?: string;
  models?: string[];
}

interface ChannelListBody {
  data?: { channels?: CanvasChannel[] };
  channels?: CanvasChannel[];
  code?: string;
}

function channelsOf(body: ChannelListBody | undefined): CanvasChannel[] {
  return body?.data?.channels ?? body?.channels ?? [];
}

export interface BridgeChannelResult {
  channelId: string;
  created: boolean;
  models: string[];
}

/**
 * 把宿主的文本模型写成画布里的一个渠道。
 *
 * baseUrl 指回 shim 的 `/bridge/v1`，画布后端会把它当上游——所以 `CANVAS_ALLOWED_PRIVATE_UPSTREAM_HOSTS`
 * 必须放行 127.0.0.1（见 boot.mjs 的 backendEnv）。渠道是 system scope，密钥入库后
 * 不可读回，更新时就地重写同一个本地 token。
 */
export async function provisionBridgeChannel(
  ctx: PluginContext,
  baseUrl: string | undefined,
): Promise<BridgeChannelResult> {
  if (!baseUrl) {
    throw new BridgeError("canvas-channel-write-failed", "canvas service is not running");
  }
  const token = await bridgeToken(ctx);
  const list = await ctx.ai.listModels();
  const models = list.models.filter((model) => model.input.includes("text")).map((model) => model.modelKey);
  if (models.length === 0) {
    throw new BridgeError("no-text-models", "the host has no text model available");
  }

  const existing = await bridgeRequest<ChannelListBody>(ctx, { path: "/bridge/admin/channels", method: "GET" });
  const current = channelsOf(existing).find((channel) => channel.name.startsWith(CHANNEL_PREFIX));
  const payload = {
    name: `${CHANNEL_PREFIX}host-text`,
    baseUrl: `${baseUrl}/bridge/v1`,
    apiKey: token,
    models,
    enabled: true,
  };

  if (current) {
    await bridgeRequest(ctx, { path: `/bridge/admin/channels/${current.id}`, method: "PATCH", body: payload });
    return { channelId: current.id, created: false, models };
  }
  const created = await bridgeRequest<{ data?: { channel?: CanvasChannel }; channel?: CanvasChannel }>(ctx, {
    path: "/bridge/admin/channels",
    method: "POST",
    body: payload,
  });
  const channel = created.data?.channel ?? created.channel;
  if (!channel?.id) {
    throw new BridgeError("canvas-channel-write-failed", "canvas accepted the channel but returned no id");
  }
  return { channelId: channel.id, created: true, models };
}
