/**
 * driver-download.mjs — 驱动产物流式下载：边下边算 sha256、边报进度、带空闲超时。
 *
 * 两条硬要求：
 *   1. 完整性可验证：产物来自公网 release，落盘前必须按清单里的 sha256 校验，
 *      校验不过就删掉临时文件、报错，绝不把半截二进制装成驱动。
 *   2. 卡死要可见：跨洋连接经常「连上了但不再吐数据」。没有空闲超时的话，
 *      安装状态会永远停在 downloading，UI 就永远显示「安装中」——
 *      这也是用户看到的「点了安装没反应」的一部分。
 *      所以按「多久没收到数据」计时（默认 60s），而不是给整个下载设死上限
 *      （7MB 产物在慢网下超过任何固定上限都是正常的）。
 */

import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { Readable, Transform } from "node:stream";
// 必须是 stream/promises 的 pipeline：node:stream 的回调版不接受 { signal }，
// 会把选项对象当成 callback，报 ERR_INVALID_ARG_TYPE。
import { pipeline } from "node:stream/promises";

import { engineError } from "./protocol.ts";

export const DEFAULT_IDLE_TIMEOUT_MS = 60_000;
/** 进度回调节流：每 200ms 一次（每写一个 chunk 都持久化状态会疯狂写盘）。 */
const PROGRESS_INTERVAL_MS = 200;

function describeFailure(error, controller) {
  if (controller.signal.aborted && controller.signal.reason instanceof Error) return controller.signal.reason.message;
  const code = error?.cause?.code ?? error?.code;
  return `${error?.message ?? String(error)}${code ? `（${code}）` : ""}`;
}

/**
 * 下载 `url` 到 `destPath`（覆盖写），返回 { bytes, sha256 }。
 * 失败时抛 EngineError，调用方负责删掉 destPath。
 */
type DownloadOptions = {
  url: string;
  destPath: string;
  expectedSha256?: string;
  declaredTotal?: number;
  idleTimeoutMs?: number;
  onProgress?: (info: { downloaded: number; total: number }) => void;
  fetchImpl?: typeof globalThis.fetch;
  signal?: AbortSignal;
};

export async function downloadToFile({
  url,
  destPath,
  expectedSha256,
  declaredTotal = 0,
  idleTimeoutMs = DEFAULT_IDLE_TIMEOUT_MS,
  onProgress,
  fetchImpl = globalThis.fetch,
  signal,
}: DownloadOptions) {
  const controller = new AbortController();
  let timer = null;
  const arm = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(
      () => controller.abort(new Error(`下载中断：${Math.round(idleTimeoutMs / 1000)} 秒内没有收到数据（网络不可达或被中断）`)),
      idleTimeoutMs,
    );
  };
  const disarm = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  if (signal) {
    if (signal.aborted) throw engineError("DRIVER_DOWNLOAD_FAILED", "下载已取消");
    signal.addEventListener("abort", () => controller.abort(new Error("下载已取消")), { once: true });
  }

  arm();
  let response;
  try {
    response = await fetchImpl(url, { redirect: "follow", signal: controller.signal });
  } catch (error) {
    disarm();
    throw engineError("DRIVER_DOWNLOAD_FAILED", `下载失败：${describeFailure(error, controller)}`);
  }
  if (!response.ok) {
    disarm();
    throw engineError("DRIVER_DOWNLOAD_FAILED", `下载失败：HTTP ${response.status} ${response.statusText ?? ""}（${url}）`.trim());
  }
  if (!response.body) {
    disarm();
    throw engineError("DRIVER_DOWNLOAD_FAILED", `下载失败：响应没有 body（${url}）`);
  }

  const contentLength = Number(response.headers?.get?.("content-length") ?? 0) || 0;
  const total = contentLength || declaredTotal;
  const hash = createHash("sha256");
  let downloaded = 0;
  let lastReport = 0;
  onProgress?.({ downloaded: 0, total });

  const meter = new Transform({
    transform(chunk, _encoding, callback) {
      downloaded += chunk.length;
      hash.update(chunk);
      arm(); // 收到数据就续命：超时只对「停滞」生效
      const now = Date.now();
      if (now - lastReport >= PROGRESS_INTERVAL_MS) {
        lastReport = now;
        onProgress?.({ downloaded, total: total || downloaded });
      }
      callback(null, chunk);
    },
  });

  try {
    await pipeline(Readable.fromWeb(response.body), meter, createWriteStream(destPath), { signal: controller.signal });
  } catch (error) {
    throw engineError("DRIVER_DOWNLOAD_FAILED", `下载失败：${describeFailure(error, controller)}`);
  } finally {
    disarm();
  }

  onProgress?.({ downloaded, total: total || downloaded });
  const sha256 = hash.digest("hex");
  if (expectedSha256 && sha256 !== String(expectedSha256).toLowerCase()) {
    throw engineError(
      "DRIVER_DOWNLOAD_FAILED",
      `下载校验失败：sha256 不一致（清单 ${expectedSha256}，实际 ${sha256}）`,
    );
  }
  return { bytes: downloaded, sha256 };
}
