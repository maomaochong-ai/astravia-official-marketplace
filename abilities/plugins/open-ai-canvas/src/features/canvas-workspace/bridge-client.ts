/**
 * 桥的访问层：token、请求、基址。
 *
 * 画布侧的一切请求都要带着 shim 自己签的 Bearer token，而 token 只存在于服务数据目录的
 * `bridge.json` 里（shim 以 `0600` 写入，见 ADR-0006 决策 1）。渠道管理与媒体任务都走
 * 这里，免得两处各写一遍读取和失败映射。
 */
import { SERVICE_ID } from "../../runtime-contract";
import type { PluginContext } from "../../runtime-contract";

export const BRIDGE_FILE = "bridge.json";

export type BridgeCode =
  | "bridge-token-missing"
  | "canvas-login-required"
  | "canvas-unreachable"
  | "canvas-channel-write-failed"
  | "canvas-models-invisible"
  | "canvas-task-rejected"
  | "no-text-models"
  | "no-media-models";

export class BridgeError extends Error {
  readonly code: BridgeCode;

  constructor(code: BridgeCode, message: string) {
    super(message);
    this.code = code;
  }
}

/** shim 启动时把 token 写进服务数据目录；读不到就说明桥还没起来。 */
export async function bridgeToken(ctx: PluginContext): Promise<string> {
  const raw = await ctx.services.readDataFile(SERVICE_ID, BRIDGE_FILE).catch(() => null);
  if (!raw) {
    throw new BridgeError("bridge-token-missing", "bridge.json is not present yet");
  }
  try {
    const parsed = JSON.parse(raw) as { token?: string };
    if (typeof parsed.token === "string" && parsed.token.length >= 32) return parsed.token;
  } catch {
    // 落到下面统一报错
  }
  throw new BridgeError("bridge-token-missing", "bridge.json has no usable token");
}

export async function serviceBaseUrl(ctx: PluginContext): Promise<string | undefined> {
  const connection = await ctx.services.connection(SERVICE_ID).catch(() => undefined);
  return connection?.baseUrl?.replace(/\/+$/, "");
}

interface BridgeRequestInit {
  path: string;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
}

interface BridgeResponse<T> {
  ok: boolean;
  status: number;
  body: T;
}

function messageOf(body: unknown): string {
  const record = (body ?? {}) as { error?: { code?: string; message?: string } };
  return record.error?.message ?? "";
}

function codeOf(body: unknown): string {
  const record = (body ?? {}) as { error?: { code?: string } };
  return record.error?.code ?? "";
}

/**
 * 失败的语义在 code 上，不在状态码上：401 该引导登录、502 是画布没起、
 * 422 是画布自己拒了参数。调用方按 code 分支，别去猜状态码。
 */
export function bridgeFailure(status: number, body: unknown): BridgeError {
  const code = codeOf(body);
  const message = messageOf(body) || `bridge returned ${status}`;
  if (code === "canvas-login-required") return new BridgeError("canvas-login-required", message);
  if (code === "canvas-unreachable") return new BridgeError("canvas-unreachable", message);
  if (code === "canvas-task-rejected") return new BridgeError("canvas-task-rejected", message);
  if (code === "canvas-channel-write-failed") return new BridgeError("canvas-channel-write-failed", message);
  if (code === "canvas-models-invisible") return new BridgeError("canvas-models-invisible", message);
  return new BridgeError("canvas-unreachable", message);
}

export async function bridgeRequest<T>(ctx: PluginContext, init: BridgeRequestInit): Promise<T> {
  const token = await bridgeToken(ctx);
  const response: BridgeResponse<T> = await ctx.services.request<T>(SERVICE_ID, {
    path: init.path,
    method: init.method,
    headers: { Authorization: `Bearer ${token}` },
    ...(init.body === undefined ? {} : { body: init.body }),
  });
  if (!response.ok) throw bridgeFailure(response.status, response.body);
  return response.body;
}

export async function bridgeAuthHeaders(ctx: PluginContext): Promise<Record<string, string>> {
  return { Authorization: `Bearer ${await bridgeToken(ctx)}` };
}
