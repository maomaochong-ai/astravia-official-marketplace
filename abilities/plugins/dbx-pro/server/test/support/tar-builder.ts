/**
 * tar-builder.mjs — 测试用的最小 tar 归档生成器。
 *
 * 存在的理由：驱动安装测试需要真实的 `.tar.zst` 输入，而把几 MB 的官方归档
 * 提交进仓库既不合适、也会随上游版本失效。这里按 POSIX ustar 写出合法的 tar，
 * 再交给 node:zlib 的 zstdCompressSync 压成 `.tar.zst`，与上游产物同构。
 *
 * 支持：ustar 头、前缀字段、PAX 扩展头（typeflag `x`）、GNU 长文件名（`L`）。
 */

const BLOCK = 512;

function octal(value, length) {
  return value.toString(8).padStart(length - 1, "0") + "\0";
}

function headerBlock({ name, size, mode = 0o644, type = "0", prefix = "" }) {
  const block = Buffer.alloc(BLOCK);
  block.write(name.slice(0, 100), 0, 100, "utf8");
  block.write(octal(mode & 0o7777, 8), 100, 8);
  block.write(octal(0, 8), 108, 8); // uid
  block.write(octal(0, 8), 116, 8); // gid
  block.write(octal(size, 12), 124, 12);
  block.write(octal(0, 12), 136, 12); // mtime：与上游产物一致，固定在 1970
  block.write("        ", 148, 8); // 校验和占位（先按空格算）
  block.write(type, 156, 1);
  block.write("ustar\0", 257, 6);
  block.write("00", 263, 2);
  if (prefix) block.write(prefix.slice(0, 155), 345, 155, "utf8");

  let sum = 0;
  for (const byte of block) sum += byte;
  block.write(`${sum.toString(8).padStart(6, "0")}\0 `, 148, 8);
  return block;
}

function pad(data) {
  const remainder = data.length % BLOCK;
  return remainder === 0 ? Buffer.alloc(0) : Buffer.alloc(BLOCK - remainder);
}

/** PAX 扩展记录：`<总长> key=value\n`，总长包含长度字段自身与空格。 */
export function paxRecord(key, value) {
  const body = ` ${key}=${value}\n`;
  let total = Buffer.byteLength(body) + 1;
  for (;;) {
    const next = Buffer.byteLength(body) + String(total).length;
    if (next === total) break;
    total = next;
  }
  return `${total}${body}`;
}

/** 按顺序写出条目，末尾两个全零块收尾。 */
export function makeTar(entries) {
  const parts = [];
  for (const entry of entries) {
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data ?? "", "utf8");
    parts.push(
      headerBlock({
        name: entry.name,
        size: data.length,
        mode: entry.mode,
        type: entry.type ?? "0",
        prefix: entry.prefix ?? "",
      }),
    );
    parts.push(data);
    parts.push(pad(data));
  }
  parts.push(Buffer.alloc(BLOCK * 2));
  return Buffer.concat(parts);
}

/** 上游产物同构：一个 agent-registry.json + 一个不带扩展名的 driver payload。 */
export function makeDriverArchive({ version = "0.1.30", platformTag = "macos-x64", payload, payloadName } = {}) {
  const bytes = Buffer.isBuffer(payload) ? payload : Buffer.from(payload ?? "duckdb-driver-payload", "utf8");
  const name = payloadName ?? `drivers/dbx-agent-duckdb-${version}-${platformTag}`;
  return makeTar([
    { name: "agent-registry.json", data: "{}\n" },
    { name, data: bytes, mode: 0o755 },
  ]);
}
