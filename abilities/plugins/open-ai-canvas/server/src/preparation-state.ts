/**
 * 准备阶段的可观测状态：阶段、失败、进度快照
 *
 * 由 server/src/boot.ts 按职责切出（ADR-0012）。
 */
import { MANIFEST, PLATFORM, supportedPlatforms } from "./service-config.ts";
import { ACTIVE_PROXY } from "./http-transport.ts";

export function note(message) {
  console.log(`[open-ai-canvas] ${message}`);
  pushLog(message);
}

// --- 准备阶段的可见状态 ---
// 宿主用 /api/health/ready 判定服务就绪，而首次启动要下载约 200 MB 载荷。
// 监听因此先就位、把下载放到监听之后：健康检查立刻通过，准备进度由 /__canvas/progress
// 暴露给下面这张准备页，而不是让整段下载卡在宿主的健康超时里被反复中止。
export const STATE_LOG_LIMIT = 10;
export const STATE = {
  phase: "starting",
  stage: "启动",
  message: "正在检查运行时",
  fileName: "",
  source: "",
  endpoint: "",
  receivedBytes: 0,
  totalBytes: 0,
  speed: 0,
  attempts: 0,
  retries: 0,
  startedAt: Date.now(),
  sampledAt: 0,
  sampledBytes: 0,
  log: [],
  // 逐片进度（ADR-0011）：卡住时要能定位到具体分片，而不是只看到一个总百分比。
  chunks: [],
  error: null,
  // 机器可读的失败原因（/__canvas/state 的 code）。文案会变，code 不变：
  // 界面据此选提示、构建期据此断言，不要靠中文子串匹配。
  code: null,
};

export function pushLog(text) {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) return;
  if (STATE.log[STATE.log.length - 1]?.text === trimmed) return;
  STATE.log.push({ at: Date.now(), text: trimmed });
  if (STATE.log.length > STATE_LOG_LIMIT) STATE.log.splice(0, STATE.log.length - STATE_LOG_LIMIT);
}

export function setStage(phase, stage, message) {
  STATE.phase = phase;
  STATE.stage = stage;
  if (message) STATE.message = message;
  pushLog(message || stage);
}

// 失败统一走这里：phase + code + 一句可复制的话。code 是契约，文案只是展示。
export function fail(code, message, stage = "启动") {
  STATE.phase = "failed";
  STATE.code = code;
  STATE.stage = stage;
  STATE.message = message;
  STATE.error = message;
  pushLog(message);
}

export function clearFailure() {
  STATE.code = null;
  STATE.error = null;
}

// 每次开始传新的文件就把计数清零，避免主载荷的 216 MB 和 Agent 载荷的 90 MB 混在一起。
export function resetTransfer(fileName, approximateBytes) {
  STATE.fileName = fileName;
  STATE.receivedBytes = 0;
  STATE.totalBytes = approximateBytes || 0;
  STATE.speed = 0;
  STATE.sampledAt = 0;
  STATE.sampledBytes = 0;
  STATE.attempts = 0;
  STATE.chunks = [];
}

export function transferSpeed() {
  const now = Date.now();
  if (!STATE.sampledAt) {
    STATE.sampledAt = now;
    STATE.sampledBytes = STATE.receivedBytes;
    return STATE.speed;
  }
  const seconds = (now - STATE.sampledAt) / 1000;
  if (seconds < 0.5) return STATE.speed;
  const delta = STATE.receivedBytes - STATE.sampledBytes;
  if (delta >= 0) STATE.speed = delta / seconds;
  STATE.sampledAt = now;
  STATE.sampledBytes = STATE.receivedBytes;
  return STATE.speed;
}

export function progressSnapshot() {
  transferSpeed();
  const percent = STATE.totalBytes > 0 ? Math.min(100, (STATE.receivedBytes / STATE.totalBytes) * 100) : 0;
  const remaining = STATE.totalBytes > 0 ? Math.max(0, STATE.totalBytes - STATE.receivedBytes) : 0;
  return {
    phase: STATE.phase,
    code: STATE.code,
    platform: PLATFORM,
    supported: supportedPlatforms(),
    payloadVersion: MANIFEST.payloadVersion || null,
    upstream: MANIFEST.upstream?.tag ?? null,
    stage: STATE.stage,
    message: STATE.message,
    fileName: STATE.fileName,
    source: ACTIVE_PROXY ? `${ACTIVE_PROXY.host}:${ACTIVE_PROXY.port}` : "直连",
    endpoint: STATE.endpoint,
    receivedBytes: STATE.receivedBytes,
    totalBytes: STATE.totalBytes,
    percent: Math.round(percent * 10) / 10,
    speed: Math.round(STATE.speed),
    etaSeconds: STATE.speed > 0 ? Math.round(remaining / STATE.speed) : 0,
    elapsedSeconds: Math.max(0, Math.round((Date.now() - STATE.startedAt) / 1000)),
    attempts: STATE.attempts,
    retries: STATE.retries,
    log: STATE.log.map((entry) => ({ at: entry.at, text: entry.text })),
    chunks: STATE.chunks.map((item) => ({ index: item.index, received: item.received, expected: item.expected })),
    error: STATE.error,
  };
}
