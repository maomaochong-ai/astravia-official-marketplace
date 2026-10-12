/**
 * driver-archive.mjs — 驱动产物（.tar.zst）解包：zstd 解压 + 取 tar 里的驱动条目。
 *
 * 背景：dbx agents release 的驱动二进制以 `.tar.zst` 分发，归档里只有两项 ——
 * `agent-registry.json`（清单）和 `drivers/dbx-agent-<key>-<ver>-<plat>`（可执行体）。
 *
 * 为什么不用 `tar` npm 包：
 *   1. 只需要取单个条目，不需要保留权限/符号链接/硬链接等完整语义；
 *   2. 打包（scripts/build-engine.mjs 用 esbuild bundle 成 main.mjs）会把整条
 *      tar → minipass → minizlib → chownr 依赖链塞进引擎产物，而实际只用到几十行读头逻辑；
 *   3. zstd 解压本来就是 node:zlib 原生能力，无需外部依赖。
 *
 * 支持：ustar 头、PAX 扩展头（x/g）、GNU 长名（L/K）、base-256 数值字段。
 * 不支持的（会明确报错，绝不静默降级）：压缩归档（gzip/xz）、加密条目。
 */

import { zstdDecompressSync } from "node:zlib";

import { engineError } from "./protocol.ts";

const BLOCK = 512;
/** 单个归档条目的解压上限（实测驱动 30MB 级；超过这个量级说明拿到了别的产物）。 */
export const MAX_ENTRY_BYTES = 512 * 1024 * 1024;

/** 驱动清单里声明的产物格式。 */
export const FORMAT_TAR_ZSTD = "tar_zstd";
/** 直接就是可执行文件（手动指定 URL 的兜底形态）。 */
export const FORMAT_RAW = "raw";

/** 归档 → tar 字节。Node 22.15 起 zlib 提供 zstd（插件运行时的 node 22.22 已具备）。 */
export function decompressZstd(buffer, { maxOutputBytes = MAX_ENTRY_BYTES } = {}) {
  if (typeof zstdDecompressSync !== "function") {
    throw engineError(
      "DRIVER_ARCHIVE_UNSUPPORTED",
      `当前 Node（${process.version}）不支持 zstd 解压，请升级引擎运行时或改用手动指定路径安装驱动`,
    );
  }
  try {
    return zstdDecompressSync(buffer, { maxOutputLength: maxOutputBytes });
  } catch (error) {
    throw engineError("DRIVER_ARCHIVE_INVALID", `zstd 解压失败：${error.message}`);
  }
}

/** tar 条目：`data` 是归档里的原始字节切片。 */
function readField(buffer, start, end) {
  const slice = buffer.subarray(start, end);
  const nul = slice.indexOf(0);
  return slice.subarray(0, nul === -1 ? slice.length : nul).toString("utf8");
}

/**
 * 数值字段：八进制 ASCII（以 NUL/空格结尾），或 GNU base-256（最高位为 1）。
 * 错误一定要抛 —— 把长度读错会让后续所有偏移全错位，静默取值只会得到一份垃圾。
 */
function readNumber(buffer, start, end) {
  const slice = buffer.subarray(start, end);
  if (slice.length === 0) return 0;
  const first = slice[0];
  if (first === 0x80 || first === 0xff) {
    let value = first & 0x7f;
    for (let i = 1; i < slice.length; i += 1) value = value * 256 + slice[i];
    return first === 0xff ? value - 2 ** (7 + 8 * (slice.length - 1)) : value;
  }
  const text = readField(buffer, start, end).trim();
  if (!text) return 0;
  const parsed = Number.parseInt(text, 8);
  if (Number.isNaN(parsed)) {
    throw engineError("DRIVER_ARCHIVE_INVALID", `tar 头的数值字段无法解析：${JSON.stringify(text)}`);
  }
  return parsed;
}

function isZeroBlock(block) {
  for (let i = 0; i < block.length; i += 1) if (block[i] !== 0) return false;
  return true;
}

/** PAX 扩展头记录：`<len> <key>=<value>\n`。 */
function parsePax(data) {
  const text = data.toString("utf8");
  const records = {};
  let offset = 0;
  while (offset < text.length) {
    const space = text.indexOf(" ", offset);
    if (space === -1) break;
    const length = Number.parseInt(text.slice(offset, space), 10);
    if (!Number.isFinite(length) || length <= 0) break;
    const record = text.slice(space + 1, offset + length);
    const eq = record.indexOf("=");
    if (eq !== -1) records[record.slice(0, eq)] = record.slice(eq + 1).replace(/\n$/, "");
    offset += length;
  }
  return records;
}

const MANIFEST_ENTRY = "agent-registry.json";

/** 归档里随附的清单文件（不是驱动本身）。 */
function isManifestEntry(name) {
  return name === MANIFEST_ENTRY || name.endsWith(`/${MANIFEST_ENTRY}`);
}

/**
 * PAX 的 mode 按规范是八进制字符串（`0000755`）；容忍上游写成十进制的实现。
 */
function paxMode(value) {
  if (value === undefined || value === null || value === "") return null;
  const text = String(value);
  const parsed = /^[0-7]+$/.test(text) ? Number.parseInt(text, 8) : Number.parseInt(text, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function normalizeName(name) {
  return name.replace(/^\.\//, "");
}

function padding(size) {
  return (BLOCK - (size % BLOCK)) % BLOCK;
}

/** 读出全部常规文件条目（目录/链接条目会被跳过）。 */
export function readTarEntries(buffer) {
  const entries = [];
  const globalPax = {};
  let pendingPax = null;
  let pendingLongName = null;
  let offset = 0;

  while (offset + BLOCK <= buffer.length) {
    const header = buffer.subarray(offset, offset + BLOCK);
    if (isZeroBlock(header)) break;
    offset += BLOCK;

    const size = readNumber(header, 124, 136);
    const type = String.fromCharCode(header[156] || 0x30);
    const dataStart = offset;
    const dataEnd = dataStart + size;
    if (dataEnd > buffer.length) {
      throw engineError("DRIVER_ARCHIVE_INVALID", `tar 归档被截断：条目声明 ${size} 字节，归档只剩 ${buffer.length - dataStart}`);
    }

    if (type === "x" || type === "g") {
      const pax = parsePax(buffer.subarray(dataStart, dataEnd));
      if (type === "g") Object.assign(globalPax, pax);
      else pendingPax = pax;
      offset = dataEnd + padding(size);
      continue;
    }
    if (type === "L" || type === "K") {
      const value = readField(buffer, dataStart, dataEnd);
      if (type === "L") pendingLongName = value;
      offset = dataEnd + padding(size);
      continue;
    }
    if (type === "0") {
      const prefix = readField(header, 345, 500);
      const pax = { ...globalPax, ...(pendingPax ?? {}) };
      const rawName = pax.path || pendingLongName || (prefix ? `${prefix}/${readField(header, 0, 100)}` : readField(header, 0, 100));
      entries.push({
        name: normalizeName(rawName),
        mode: paxMode(pax.mode) ?? readNumber(header, 100, 108),
        size,
        data: buffer.subarray(dataStart, dataStart + size),
      });
    }
    pendingPax = null;
    pendingLongName = null;
    offset = dataEnd + padding(size);
  }

  return entries;
}

/**
 * 从归档里挑出驱动可执行体。
 *
 * 选择规则：`drivers/` 下的常规文件（这是 dbx agents 的固定布局）；
 * 布局变了则退化为「最大的常规文件」——但永远不选归档里的清单文件
 * （agent-registry.json），否则会把一份 JSON 当成驱动装出去。
 * 错误信息里列出实际条目名，方便定位布局变化。
 */
export function pickDriverEntry(entries) {
  const regular = entries.filter((entry) => entry.size > 0 && !isManifestEntry(entry.name));
  if (regular.length === 0) {
    const names = entries.map((entry) => entry.name).join(", ") || "（空归档）";
    throw engineError("DRIVER_ARCHIVE_INVALID", `归档里没有可用的驱动文件：${names}`);
  }
  const declared = regular.filter((entry) => entry.name.startsWith("drivers/"));
  const candidates = declared.length > 0 ? declared : regular;
  return candidates.reduce((best, entry) => (entry.size > best.size ? entry : best));
}

/** `.tar.zst` → 驱动可执行体字节。 */
export function extractDriverPayload(archive, { maxOutputBytes = MAX_ENTRY_BYTES } = {}) {
  const tar = decompressZstd(archive, { maxOutputBytes });
  const entry = pickDriverEntry(readTarEntries(tar));
  return { name: entry.name, mode: entry.mode, data: entry.data };
}
