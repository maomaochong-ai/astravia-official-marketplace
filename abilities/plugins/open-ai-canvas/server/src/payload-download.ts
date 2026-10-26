/**
 * 载荷分片下载、停滞看门狗、合并
 *
 * 由 server/src/boot.ts 按职责切出（ADR-0012）。
 */
import fs from "node:fs";
import path from "node:path";
import { STATE, note, setStage } from "./preparation-state.ts";
import { CHUNK_ATTEMPTS, DOWNLOAD_CHUNKS, httpRequest, partPath, payloadSize, statSize } from "./http-transport.ts";

export const CHUNK_STALL_MS = 30_000;
export const TRANSFER_DEADLINE_MS = 20 * 60_000;

export async function downloadChunk(url, file, start, end) {
  const expected = end - start + 1;
  let have = statSize(file);
  if (have === expected) return;
  if (have > expected) {
    fs.rmSync(file, { force: true });
    have = 0;
  }

  let lastError;
  let stalled = false;
  for (let attempt = 1; attempt <= CHUNK_ATTEMPTS; attempt += 1) {
    let response;
    let sink;
    let stallTimer;
    const from = start + have;
    try {
      response = await httpRequest(url, {
        headers: { Range: `bytes=${from}-${end}`, Accept: "application/octet-stream" },
        timeout: 45000,
      });
      if (response.statusCode !== 206) {
        response.resume();
        throw new Error(`HTTP ${response.statusCode}（不支持分段或链接已失效）`);
      }
      sink = fs.createWriteStream(file, { flags: have > 0 ? "a" : "w" });
      await new Promise<void>((resolve, reject) => {
        // 关键：arm() 里的 reject 是这个 Promise 自己的出口。之前的看门狗只去
        // destroy(response)，只要错误没沿「socket → PassThrough → pipe」的链条传下来，
        // 这个 await 就永远不返回，Promise.all 也永远不会失败。
        const arm = () => {
          if (stallTimer) clearTimeout(stallTimer);
          stallTimer = setTimeout(() => {
            stalled = true;
            reject(new Error(`分片停滞 ${CHUNK_STALL_MS / 1000}s（已落盘 ${statSize(file)}/${expected}）`));
          }, CHUNK_STALL_MS);
        };
        arm();
        sink.on("finish", resolve);
        sink.on("error", reject);
        response.on("data", arm);
        response.on("error", reject);
        response.on("aborted", () => reject(new Error("连接中断")));
        response.on("end", () => {
          if (sink) sink.end();
        });
        response.pipe(sink);
      });
      const written = statSize(file);
      if (written !== expected) throw new Error(`字节不足 ${written}/${expected}`);
      return;
    } catch (err) {
      lastError = err;
      // 已落盘的部分留作下次续传的基线。停滞时先把 sink 关掉再读大小，
      // 否则拿到的是尚未 flush 的旧值，下次仍从同一个位置重拉。
      if (sink && !sink.closed) sink.destroy();
      have = statSize(file);
      if (have > expected) {
        fs.rmSync(file, { force: true });
        have = 0;
      }
      // 失败不能只在调试开关下可见：用户看到百分比不动时，日志里必须已经写明哪一片、为什么。
      note(`分片 ${start}-${end} 失败：${err.message}（已落盘 ${have}/${expected}）`);
      STATE.retries += 1;
      if (stalled) throw new Error(`分片下载反复停滞，放弃分片模式：${err.message}`);
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    } finally {
      if (stallTimer) clearTimeout(stallTimer);
      if (response) response.destroy();
    }

  }
  throw lastError;
}

export async function mergeParts(archive, parts) {
  const sink = fs.createWriteStream(archive);
  const finished = new Promise<void>((resolve, reject) => {
    sink.on("finish", resolve);
    sink.on("error", reject);
  });
  try {
    for (const part of parts) {
      await new Promise<void>((resolve, reject) => {
        const source = fs.createReadStream(part);
        source.on("error", reject);
        source.on("end", resolve);
        source.pipe(sink, { end: false });
      });
    }
  } finally {
    sink.end();
  }
  await finished;
}

export function downloadChunked(url, archive, size) {
  const chunk = Math.ceil(size / DOWNLOAD_CHUNKS);
  const ranges = [];
  for (let index = 0; index < DOWNLOAD_CHUNKS; index += 1) {
    const start = index * chunk;
    const end = Math.min(size - 1, start + chunk - 1);
    if (start <= end) ranges.push({ index, start, end });
  }

  STATE.totalBytes = size;
  setStage("downloading", "下载中", `正在下载 ${STATE.fileName}（${(size / 1048576).toFixed(0)} MB，${ranges.length} 片）`);
  // 逐片可见：卡在 88% 时一眼能看出是哪一片、到哪了，而不是只看到一个不动的总数。
  STATE.chunks = ranges.map((range) => ({ index: range.index, received: statSize(partPath(archive, range.index)), expected: range.end - range.start + 1 }));
  const tick = setInterval(() => {
    let total = 0;
    for (const item of STATE.chunks) {
      item.received = statSize(partPath(archive, item.index));
      total += item.received;
    }
    STATE.receivedBytes = total;
  }, 300);
  // 总截止时间：单个分片有自己的 30s 停滞计时器，这里再给整次传输一个上限，
  // 避免「每片都在慢悠悠地重试」把启动拖成无限期。
  let deadlineTimer;
  const deadline = new Promise((_resolve, reject) => {
    deadlineTimer = setTimeout(() => {
      const stuck = STATE.chunks.filter((item) => item.received < item.expected).map((item) => `#${item.index} ${item.received}/${item.expected}`);
      reject(new Error(`下载超过 ${Math.round(TRANSFER_DEADLINE_MS / 60000)} 分钟未完成，卡在：${stuck.join("、") || "未知分片"}`));
    }, TRANSFER_DEADLINE_MS);
  });
  const settled = Promise.race(
    [
      Promise.all(ranges.map((range) => downloadChunk(url, partPath(archive, range.index), range.start, range.end))),
      deadline,
    ],
  ).finally(() => {
    clearInterval(tick);
    clearTimeout(deadlineTimer);
  });
  return settled.then(async () => {
    STATE.receivedBytes = size;
    await mergeParts(
      archive,
      ranges.map((range) => partPath(archive, range.index)),
    );
    for (const range of ranges) fs.rmSync(partPath(archive, range.index), { force: true });
  });
}

export async function downloadPayload(url, archive) {
  STATE.attempts += 1;
  setStage("connecting", "连接下载源", `正在查询 ${STATE.fileName || path.basename(archive)} 的大小（第 ${STATE.attempts} 次）`);
  const size = await payloadSize(url);
  // 上一次在「校验/解包」阶段断掉时归档已经在盘上且长度正确：不必再花一个 200 MB 的下载。
  // 若内容其实已损坏，校验会失败并删档，下一次重试就会重新下载。
  if (size > 0 && statSize(archive) === size) {
    note(`归档已在本地（${size} 字节），跳过下载`);
    STATE.receivedBytes = size;
    return;
  }
  if (process.env.CANVAS_DOWNLOAD_DEBUG) note(`载荷字节数 ${size}，分 ${DOWNLOAD_CHUNKS} 片`);
  if (size > 0) {
    try {
      await downloadChunked(url, archive, size);
      if (fs.statSync(archive).size === size) return;
      throw new Error("分片下载长度不符");
    } catch (err) {
      // 不清空已有字节：合并包与 .partN 都还能作为单连接续传的基线。
      note(`分片下载失败（${err.message}），改用单连接重试`);
    }
  }

  note("改用单连接下载");
  // 单连接拿不到总长度时也要能续下：已有字节用 Range 接着取，并同样装停滞看门狗。
  const existing = statSize(archive);
  const res = await httpRequest(
    url,
    existing > 0 ? { headers: { Range: `bytes=${existing}-` } } : {},
  );
  if (res.statusCode !== 200 && res.statusCode !== 206) {
    res.resume();
    throw new Error(`运行时载荷下载失败：HTTP ${res.statusCode}（${url}）`);
  }
  const offset = res.statusCode === 206 ? existing : 0;
  const out = fs.createWriteStream(archive, { flags: offset > 0 ? "r+" : "w", start: offset });
  let lastActivity = Date.now();
  const watchdog = setInterval(() => {
    if (Date.now() - lastActivity > 60000) res.destroy(new Error("下载停滞"));
  }, 5000);
  res.on("data", () => {
    lastActivity = Date.now();
    if (size > 0) STATE.receivedBytes = Math.min(size, offset + res.bytesRead);
  });
  try {
    res.pipe(out);
    await new Promise<void>((resolve, reject) => {
      out.on("finish", resolve);
      out.on("error", reject);
      res.on("error", reject);
      res.on("aborted", () => reject(new Error("连接中断")));
    });
  } finally {
    clearInterval(watchdog);
    res.destroy();
  }
}

// --- 下载来源解析 ---
// Releases 的固定下载链接会 302 到 objects.githubusercontent.com，而在部分网络里连
// github.com 的 TCP 都建不起来。api.github.com 与它 302 到的
// release-assets.githubusercontent.com 通常可达，所以把它留作最后一搏的兜底来源（ADR-0009）。
