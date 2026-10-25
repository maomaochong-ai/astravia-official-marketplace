/**
 * 画布渠道的方向管理（ADR-0006 决策 2 与 3）。
 *
 * 两个方向都必须由用户显式触发——一个是把宿主的文本模型接进画布，另一个是把画布
 * 里已经配好的自定义渠道接进宿主的模型选择器。都做成按钮，不做启动副作用：写渠道
 * 会改动画布的数据库，静默写入等于替用户改配置。
 *
 * 渠道请求全部走 shim 的 `/bridge/admin/*`：那里持着捕获到的管理员会话，插件运行时
 * 没有 cookie 也不该有。
 */
import { SERVICE_ID } from "../../runtime-contract";
import type { PluginContext } from "../../runtime-contract";

const BRIDGE_FILE = "bridge.json";
/** 渠道名前缀：画布没有「来源」字段，只能靠名字认领自己的条目。 */
export const CHANNEL_PREFIX = "astravia-bridge-";

export type BridgeChannelCode =
  | "bridge-token-missing"
  | "canvas-login-required"
  | "canvas-channel-write-failed"
  | "no-text-models";

export class BridgeChannelError extends Error {
  readonly code: BridgeChannelCode;

  constructor(code: BridgeChannelCode, message: string) {
    super(message);
    this.code = code;
  }
}

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

/** shim 启动时把 token 写进服务数据目录；读不到就说明桥还没起来。 */
async function bridgeToken(ctx: PluginContext): Promise<string> {
  const raw = await ctx.services.readDataFile(SERVICE_ID, BRIDGE_FILE).catch(() => null);
  if (!raw) {
    throw new BridgeChannelError("bridge-token-missing", "bridge.json is not present yet");
  }
  try {
    const parsed = JSON.parse(raw) as { token?: string };
    if (typeof parsed.token === "string" && parsed.token.length >= 32) return parsed.token;
  } catch {
    // 落到下面统一报错
  }
  throw new BridgeChannelError("bridge-token-missing", "bridge.json has no usable token");
}

async function adminRequest<T>(
  ctx: PluginContext,
  token: string,
  path: string,
  method: "GET" | "POST" | "PATCH",
  body?: unknown,
): Promise<T> {
  const response = await ctx.services.request<T>(SERVICE_ID, {
    path,
    method,
    headers: { Authorization: `Bearer ${token}` },
    ...(body === undefined ? {} : { body }),
  });
  if (response.status === 401) {
    throw new BridgeChannelError("canvas-login-required", "canvas admin session is not captured");
  }
  if (!response.ok) {
    throw new BridgeChannelError(
      "canvas-channel-write-failed",
      `canvas returned ${response.status}: ${JSON.stringify(response.body).slice(0, 300)}`,
    );
  }
  return response.body;
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
    throw new BridgeChannelError("canvas-channel-write-failed", "canvas service is not running");
  }
  const token = await bridgeToken(ctx);
  const list = await ctx.ai.listModels();
  const models = list.models.filter((model) => model.input.includes("text")).map((model) => model.modelKey);
  if (models.length === 0) {
    throw new BridgeChannelError("no-text-models", "the host has no text model available");
  }

  const existing = await adminRequest<ChannelListBody>(ctx, token, "/bridge/admin/channels", "GET");
  const current = channelsOf(existing).find((channel) => channel.name.startsWith(CHANNEL_PREFIX));
  const payload = {
    name: `${CHANNEL_PREFIX}host-text`,
    baseUrl: `${baseUrl}/bridge/v1`,
    apiKey: token,
    models,
    enabled: true,
  };

  if (current) {
    await adminRequest(ctx, token, `/bridge/admin/channels/${current.id}`, "PATCH", payload);
    return { channelId: current.id, created: false, models };
  }
  const created = await adminRequest<{ data?: { channel?: CanvasChannel }; channel?: CanvasChannel }>(
    ctx,
    token,
    "/bridge/admin/channels",
    "POST",
    payload,
  );
  const channel = created.data?.channel ?? created.channel;
  if (!channel?.id) {
    throw new BridgeChannelError("canvas-channel-write-failed", "canvas accepted the channel but returned no id");
  }
  return { channelId: channel.id, created: true, models };
}

export interface HostExportResult {
  exported: string[];
  skipped: number;
}

/**
 * 把画布里的自定义渠道登记成宿主可选的模型来源（ADR-0006 决策 3）。
 *
 * 只搬运用户在画布界面里自己填的凭据。system 渠道的 apiKey 是占位符（画布从不下发
 * system 渠道的真实密钥），那些跳过——拿占位符去请求只会得到一个 401。
 */
export async function exportCanvasChannelsToHost(ctx: PluginContext): Promise<HostExportResult> {
  const token = await bridgeToken(ctx);
  const list = await adminRequest<ChannelListBody>(ctx, token, "/bridge/admin/channels", "GET");
  const candidates = channelsOf(list).filter(
    (channel) =>
      typeof channel.apiKey === "string" &&
      channel.apiKey.length > 0 &&
      channel.apiKey !== "system" &&
      /^https?:\/\//.test(channel.baseUrl ?? "") &&
      (channel.models?.length ?? 0) > 0,
  );

  const providers: Record<string, {
    baseUrl: string;
    apiKey: string;
    displayName: string;
    models: Array<{ id: string }>;
  }> = {};
  for (const channel of candidates) {
    providers[`open-ai-canvas.${channel.id}`] = {
      baseUrl: channel.baseUrl,
      apiKey: channel.apiKey as string,
      displayName: channel.name || channel.id,
      // 不声明 api：渠道的协议方言由用户在画布里选的 provider 决定，
      // 这里硬写 "openai" 会把一个 Anthropic 兼容渠道错标成 OpenAI 协议。
      models: (channel.models ?? []).map((id) => ({ id })),
    };
  }

  // 整集合替换：这次导出的清单就是插件拥有的全部 provider。上一次导出过、这次在画布
  // 里已经删掉的渠道会被一并移除，与用户在画布里的意图一致。
  await ctx.models.replaceOwnedProviders(providers);
  return {
    exported: Object.keys(providers).map((id) => id.replace("open-ai-canvas.", "")),
    skipped: channelsOf(list).length - candidates.length,
  };
}
