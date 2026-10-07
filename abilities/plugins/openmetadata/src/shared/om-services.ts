/**
 * OpenMetadata 插件侧的 services 绑定和代理客户端。
 *
 * 宿主 ctx.services.request 转发请求到本地代理进程（plugin.json providers.services[om-proxy]），
 * 代理进程不受 network.allowedHosts 限制，可以 fetch 任意 OM 实例 URL。
 */

export const OM_PROXY_SERVICE_ID = "om-proxy";

export interface OmServicesApi {
  request<T = unknown>(
    serviceId: string,
    request: {
      path: string;
      method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
      headers?: Record<string, string>;
      body?: unknown;
      responseType?: "json" | "text";
      timeoutMs?: number;
    },
  ): Promise<{ ok: boolean; status: number; statusText: string; headers: Record<string, string>; body: T }>;
}

let services: OmServicesApi | null = null;

export function bindOmServices(api: OmServicesApi | null): void {
  services = api;
}

export function getOmServices(): OmServicesApi | null {
  return services;
}

export class OmProxyError extends Error {
  readonly code: string;
  readonly statusCode?: number;
  readonly omResponse?: unknown;

  constructor(code: string, message: string, options: { statusCode?: number; omResponse?: unknown } = {}) {
    super(message);
    this.name = "OmProxyError";
    this.code = code;
    this.statusCode = options.statusCode;
    this.omResponse = options.omResponse;
  }
}

/**
 * 调用代理进程的 /om/api/* 路由，转发到 OM /v1/*。
 * path 参数是 OM API 路径（如 /search/query、/lineage/table/fqn）。
 */
export async function omRequest<T = unknown>(
  path: string,
  options: { method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; body?: unknown; timeoutMs?: number } = {},
): Promise<T> {
  const api = services;
  if (!api) {
    throw new OmProxyError("NOT_READY", "OpenMetadata 代理服务未绑定");
  }

  // 构建代理路由路径：/om/api + OM 路径
  const proxyPath = path.startsWith("/om/") ? path : `/om/api${path.startsWith("/") ? path : `/${path}`}`;

  const response = await api.request<{ ok: boolean; data?: T; error?: { code: string; message: string; om_response?: unknown; om_status_code?: number } }>(
    OM_PROXY_SERVICE_ID,
    {
      path: proxyPath,
      method: options.method ?? "GET",
      body: options.body,
      timeoutMs: options.timeoutMs ?? 30_000,
      headers: {},
    },
  );

  // services.request 自身失败（进程未启动、超时等）
  if (!response.ok) {
    throw new OmProxyError("SERVICE_REQUEST_FAILED", `代理服务请求失败：${response.status} ${response.statusText}`);
  }

  const envelope = response.body;
  if (!envelope?.ok) {
    const err = envelope?.error;
    throw new OmProxyError(
      err?.code ?? "OM_ERROR",
      err?.message ?? "OpenMetadata 返回未知错误",
      { statusCode: err?.om_status_code, omResponse: err?.om_response },
    );
  }

  return envelope.data as T;
}

/** 不带 /v1 前缀的原始路径转发（用于 OM /health 等非标准端点）。 */
export async function omRawRequest<T = unknown>(
  path: string,
  options: { method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; body?: unknown } = {},
): Promise<T> {
  return omRequest<T>(`/om/raw${path.startsWith("/") ? path : `/${path}`}`, options);
}
