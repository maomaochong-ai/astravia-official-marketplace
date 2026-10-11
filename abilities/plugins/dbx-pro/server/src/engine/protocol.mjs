/**
 * dbx-pro 引擎协议层：错误码、HTTP 状态映射、信封与 JSON 安全化。
 *
 * 设计约束（来自 .dbx-refactor/engine-runtime.md 与 implementation-plan.md §2）：
 * 引擎会被打包成**多个独立 bundle**（main.mjs 与每个 driver 各一份），
 * protocol 模块因此在各 bundle 内各内联一份 —— 跨 bundle 判断错误**不能用 instanceof**，
 * 只能用鸭子类型标记 `engineError === true`。见 isEngineError()。
 */

// 0.1.1：修复第三轮审计的 B1/B2/B3（字符串感知剥离、打开前头校验、密钥缺失拒绝启动）。
// 产物字节变了就必须抬版本，否则宿主不会重装已有版本（见 scripts/build-engine.mjs）。
// 0.0.18：dbx_execute_query 传 max_rows；写 / DDL 统一走自研驱动（dbx-mcp 子进程永久零提权）；
// 新增 POST /schemas；dbx-mcp /mcp 端点的工具错误改回 JSON-RPC error。
// 0.0.19：读路径真服务端分页（子查询包裹 + LIMIT/OFFSET，COUNT 单独取）；
// max_rows 不再被页大小夹住 —— 大表 SELECT 一次拉全表导致的超时由此消除。
// 0.0.20：新增 POST /reveal（系统文件管理器定位导出文件，供「打开所在文件夹」）。
export const ENGINE_VERSION = "0.0.20";
export const PROTOCOL_VERSION = 1;

/** 请求体上限：与宿主 16MB 响应上限错开，留足序列化余量。 */
export const MAX_BODY_BYTES = 8 * 1024 * 1024;
/** 对齐 dbx EXECUTE_QUERY_LIMIT = 50（MCP 工具默认行数）。 */
export const DEFAULT_ROW_LIMIT = 50;
export const MAX_ROW_LIMIT = 5_000;
/** 单请求执行预算上限（宿主 ctx.services.request 硬上限 5min）。 */
export const MAX_TIMEOUT_MS = 300_000;

/**
 * 错误码 → HTTP 状态；未登记的码一律 500。
 * 只登记真正会被抛出的码 —— 挂一个从不抛出的码会让人误以为该场景有保护。
 */
const STATUS_BY_CODE = Object.freeze({
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  PAYLOAD_TOO_LARGE: 413,
  // 写闸门：未确认 → SQL_BLOCKED（router 抛，见 /query）
  SQL_BLOCKED: 403,
  WRITE_BLOCKED: 403,
  CONFIRM_MISMATCH: 403,
  // 引擎侧连接不存在（classifyError 归类后在 /query 等路径抛）
  CONNECTION_NOT_FOUND: 404,
  WRITE_UNSUPPORTED: 501,
  DRIVER_UNSUPPORTED: 501,
  DRIVER_ERROR: 502,
  CONNECTION_ERROR: 502,
  DBX_MCP_ERROR: 502,
  // 「API 接入」（插件自有数据源路径，见 src/api-source/）——
  // 上游接口的问题一律 5xx（用户改不了），配置/入参问题一律 4xx。
  API_HTTP_ERROR: 502,
  API_INVALID_JSON: 502,
  API_UNAVAILABLE: 502,
  CONNECTION_FAILED: 502,
  API_RATE_LIMITED: 503,
  API_ENGINE_UNAVAILABLE: 501,
  API_PATH_NOT_FOUND: 400,
  API_SOURCE_NOT_REFERENCED: 400,
  AUTH_MISSING: 400,
  AUTH_FAILED: 401,
  TIMEOUT: 504,
  INTERNAL: 500,
});

export function httpStatusForCode(code) {
  return STATUS_BY_CODE[code] ?? 500;
}

export class EngineError extends Error {
  constructor(code, message, detail) {
    super(message);
    this.name = "EngineError";
    this.code = code;
    this.detail = detail;
    this.engineError = true;
  }
}

export function engineError(code, message, detail) {
  return new EngineError(code, message, detail);
}

export function isEngineError(value) {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    value.engineError === true &&
    typeof value.code === "string"
  );
}

/**
 * 把任意抛出物收敛成 EngineError。
 * 只做分类，不改写 message —— 用户看到的必须是原始错误文本（审计要求：错误要诚实）。
 */
export function normalizeThrown(thrown) {
  if (isEngineError(thrown)) return thrown;
  const message = thrown instanceof Error ? thrown.message : String(thrown);
  const rawCode =
    thrown && typeof thrown === "object" && typeof thrown.code === "string" ? thrown.code : null;
  if (rawCode === "ERR_SQLITE_ERROR" || rawCode === "ERR_OUT_OF_RANGE") {
    return new EngineError("DRIVER_ERROR", message, { driverCode: rawCode });
  }
  return new EngineError("INTERNAL", message, rawCode ? { driverCode: rawCode } : undefined);
}

export function ok(data) {
  return { ok: true, data };
}

export function fail(thrown) {
  const error = normalizeThrown(thrown);
  return {
    ok: false,
    error:
      error.detail === undefined
        ? { code: error.code, message: error.message }
        : { code: error.code, message: error.message, detail: error.detail },
  };
}

/** BigInt 是否能用 Number 无损表示。 */
function isSafeBigInt(value) {
  return value <= BigInt(Number.MAX_SAFE_INTEGER) && value >= BigInt(Number.MIN_SAFE_INTEGER);
}

/**
 * JSON.stringify 的 replacer：node:sqlite 在 setReadBigInts 下会给出 BigInt，
 * 二进制列给出 Uint8Array —— 两者原生 JSON.stringify 都会失败或语义错误。
 * 规则：可无损的 BigInt → Number；超范围 → 十进制字符串；二进制 → {__type:"blob",base64,bytes}。
 */
export function jsonReplacer(_key, value) {
  if (typeof value === "bigint") {
    return isSafeBigInt(value) ? Number(value) : value.toString();
  }
  if (value instanceof Uint8Array) {
    return {
      __type: "blob",
      bytes: value.byteLength,
      base64: Buffer.from(value).toString("base64"),
    };
  }
  return value;
}

export function stringifyJson(value) {
  return JSON.stringify(value, jsonReplacer);
}
