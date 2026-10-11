"""
protocol — 协议常量与错误工厂（对应 server/src/engine/protocol.mjs）。

必须与 Node 版行为完全对齐，因为 dbx-pro 前端 engine-client.ts 依赖：
  - ENGINE_VERSION 在 /health 返回里
  - 错误码字符串（BAD_REQUEST / UNAUTHORIZED / SQL_BLOCKED / CONFIRM_MISMATCH ...）
  - httpStatusForCode 映射
"""
from __future__ import annotations

from dataclasses import dataclass, field

# 与 Node 版 protocol.mjs 保持同步
ENGINE_VERSION = "0.0.20"
PROTOCOL_VERSION = 1

MAX_BODY_BYTES = 8 * 1024 * 1024  # 8MB —— 宿主响应上限 16MB，留序列化余量
DEFAULT_ROW_LIMIT = 50             # 对齐 dbx EXECUTE_QUERY_LIMIT
MAX_ROW_LIMIT = 5_000
MAX_TIMEOUT_MS = 300_000          # 单请求执行预算上限（宿主 ctx.services.request 硬上限 5min）


STATUS_BY_CODE: dict[str, int] = {
    "BAD_REQUEST": 400,
    "UNAUTHORIZED": 401,
    "NOT_FOUND": 404,
    "METHOD_NOT_ALLOWED": 405,
    "PAYLOAD_TOO_LARGE": 413,
    "SQL_BLOCKED": 403,
    "WRITE_BLOCKED": 403,
    "CONFIRM_MISMATCH": 403,
    "CONNECTION_NOT_FOUND": 404,
    "WRITE_UNSUPPORTED": 501,
    "DRIVER_UNSUPPORTED": 501,
    "DRIVER_ERROR": 502,
    "CONNECTION_ERROR": 502,
    "DBX_MCP_ERROR": 502,
    "API_HTTP_ERROR": 502,
    "API_INVALID_JSON": 502,
    "API_UNAVAILABLE": 502,
    "CONNECTION_FAILED": 502,
    "API_RATE_LIMITED": 503,
    "API_ENGINE_UNAVAILABLE": 501,
    "API_PATH_NOT_FOUND": 400,
    "API_SOURCE_NOT_REFERENCED": 400,
    "AUTH_MISSING": 400,
    "AUTH_FAILED": 401,
    "TIMEOUT": 504,
    "INTERNAL": 500,
}


def http_status_for_code(code: str) -> int:
    return STATUS_BY_CODE.get(code, 500)


@dataclass
class EngineError(Exception):
    """协议层错误。code 字段决定 HTTP 状态码。"""

    code: str
    message: str
    detail: object = None
    engine_error: bool = field(default=True, init=False)

    def __str__(self) -> str:  # pragma: no cover — traceback 展示
        return f"[{self.code}] {self.message}"


def engine_error(code: str, message: str, detail: object = None) -> EngineError:
    return EngineError(code=code, message=message, detail=detail)


def is_engine_error(value: object) -> bool:
    return (
        isinstance(value, EngineError)
        and getattr(value, "engine_error", False) is True
        and isinstance(getattr(value, "code", None), str)
    )


def normalize_thrown(thrown: BaseException | object) -> EngineError:
    """把任意抛出物收敛成 EngineError。"""
    if is_engine_error(thrown):
        assert isinstance(thrown, EngineError)
        return thrown
    message = thrown.message if isinstance(thrown, Exception) else str(thrown)
    raw_code = getattr(thrown, "code", None)
    if raw_code in ("ERR_SQLITE_ERROR", "ERR_OUT_OF_RANGE"):
        return EngineError("DRIVER_ERROR", message, {"driverCode": raw_code})
    return EngineError(
        "INTERNAL",
        message,
        {"driverCode": raw_code} if isinstance(raw_code, str) else None,
    )


def ok(data: object) -> dict:
    return {"ok": True, "data": data}


def fail(thrown: BaseException | object) -> dict:
    error = normalize_thrown(thrown)
    return {
        "ok": False,
        "error": {
            "code": error.code,
            "message": error.message,
            **({"detail": error.detail} if error.detail is not None else {}),
        },
    }
