/**
 * ZIP 载荷解包与摘要计算。
 *
 * 为什么不用 adm-zip / yauzl：载荷是本仓库脚本以 store/deflate 生成的普通 ZIP，
 * 只需要「读中央目录 → 逐条流式解压」这一条路径。整包读进 Buffer 会把主进程顶到
 * 200 MB 以上，而这里每个条目都是流式落到目标文件，峰值只跟单个条目有关。
 *
 * 安全约束：条目路径必须落在目标目录内（拒绝 `..` 与绝对路径），
 * 解压后大小必须与中央目录声明一致——载荷来自网络，这两条是必须的。
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import crypto from "node:crypto";

/** 流式计算文件 sha256，用于载荷与制品校验。 */
export function hashFile(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    fs.createReadStream(file)
      .on("data", (chunk) => hash.update(chunk))
      .on("error", reject)
      .on("end", () => resolve(hash.digest("hex")));
  });
}

/** 在归档尾部 64 KiB 内反向搜索中央目录结束记录（0x06054b50）。 */
export function findEndOfCentralDirectory(buffer: Buffer): number {
  const floor = Math.max(0, buffer.length - 66 * 1024);
  for (let offset = buffer.length - 22; offset >= floor; offset--) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  return -1;
}

function readExactly(fd: number, position: number, length: number): Buffer {
  const buffer = Buffer.allocUnsafe(length);
  let filled = 0;
  while (filled < length) {
    const bytes = fs.readSync(fd, buffer, filled, length - filled, position + filled);
    if (bytes <= 0) throw new Error(`载荷文件意外结束（offset ${position + filled}）`);
    filled += bytes;
  }
  return buffer;
}

function copyRangeInto(archive: string, start: number, length: number, target: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const source = fs.createReadStream(archive, { start, end: start + length - 1 });
    const sink = fs.createWriteStream(target);
    sink.on("finish", () => resolve());
    sink.on("error", reject);
    source.on("error", reject);
    source.pipe(sink);
  });
}

function inflateRangeInto(archive: string, start: number, length: number, target: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const source = fs.createReadStream(archive, { start, end: start + length - 1 });
    const inflate = zlib.createInflateRaw();
    const sink = fs.createWriteStream(target);
    sink.on("finish", () => resolve());
    sink.on("error", reject);
    inflate.on("error", reject);
    source.on("error", reject);
    source.pipe(inflate).pipe(sink);
  });
}

/** 解包 `archive` 到 `destDir`；只支持 store(0) 与 deflate(8)，拒绝 ZIP64。 */
export async function extractZip(archive: string, destDir: string): Promise<void> {
  const fd = fs.openSync(archive, "r");
  let directory: Buffer;
  let total: number;
  try {
    const size = fs.fstatSync(fd).size;
    const tailLength = Math.min(size, 66 * 1024);
    const tail = readExactly(fd, size - tailLength, tailLength);
    const eocd = findEndOfCentralDirectory(tail);
    if (eocd < 0) throw new Error("载荷不是有效的 ZIP：找不到中央目录");
    total = tail.readUInt16LE(eocd + 10);
    const directorySize = tail.readUInt32LE(eocd + 12);
    const directoryOffset = tail.readUInt32LE(eocd + 16);
    if (total === 0xffff || directoryOffset === 0xffffffff) throw new Error("暂不支持 ZIP64 格式的载荷");
    directory = readExactly(fd, directoryOffset, directorySize);
  } finally {
    fs.closeSync(fd);
  }

  const root = path.resolve(destDir);
  // 创作 Agent 载荷有 2.5 万条目。逐条 open/close 归档读本地头会多出十几万次系统调用，
  // 在机械盘或文件监控开机时会明显变慢，所以全部条目复用一个只读 fd。
  const archiveFd = fs.openSync(archive, "r");
  let cursor = 0;
  try {
    for (let index = 0; index < total; index++) {
      if (directory.readUInt32LE(cursor) !== 0x02014b50) throw new Error("载荷 ZIP 中央目录损坏");
      const method = directory.readUInt16LE(cursor + 10);
      const compressedSize = directory.readUInt32LE(cursor + 20);
      const uncompressedSize = directory.readUInt32LE(cursor + 24);
      const nameLength = directory.readUInt16LE(cursor + 28);
      const extraLength = directory.readUInt16LE(cursor + 30);
      const commentLength = directory.readUInt16LE(cursor + 32);
      const localOffset = directory.readUInt32LE(cursor + 42);
      const name = directory.toString("utf8", cursor + 46, cursor + 46 + nameLength);
      cursor += 46 + nameLength + extraLength + commentLength;

      if (name.endsWith("/")) continue;
      const target = path.resolve(root, name);
      if (target !== root && !target.startsWith(root + path.sep)) {
        throw new Error(`载荷条目越出目标目录：${name}`);
      }

      const localNameLength = readExactly(archiveFd, localOffset + 26, 2).readUInt16LE(0);
      const localExtraLength = readExactly(archiveFd, localOffset + 28, 2).readUInt16LE(0);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;

      fs.mkdirSync(path.dirname(target), { recursive: true });
      // 空文件（node 的 include/ 里有几个）压缩后长度为 0，createReadStream 的 end 会小于 start，
      // 直接落一个空文件即可。
      if (compressedSize === 0) {
        fs.writeFileSync(target, Buffer.alloc(0));
      } else if (method === 0) {
        await copyRangeInto(archive, dataStart, compressedSize, target);
      } else if (method === 8) {
        await inflateRangeInto(archive, dataStart, compressedSize, target);
      } else {
        throw new Error(`不支持的 ZIP 压缩方式：${method}`);
      }
      if (uncompressedSize && fs.statSync(target).size !== uncompressedSize) {
        throw new Error(`载荷条目大小不符：${name}`);
      }
    }
  } finally {
    fs.closeSync(archiveFd);
  }
}
