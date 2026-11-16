// 从官方图标（assets/icon.png）派生一枚「可被遮罩」的单色字形，写进 src/brand-icon.ts。
//
// 为什么需要：侧边栏工作区图标是 class 字符串（见宿主 plugin-nav-icon.ts）。图片会被
// 掩成 currentColor；而 assets/icon.png 是「浅色圆角底板 + 黑色鸟」——底板不透明，
// 掩出来就是一整块实心圆角方块。所以这里按亮度把底板抠掉（alpha = 255 - 亮度），
// 只留鸟的透明剪影，再缩到 96px，内联成 data URI。
//
// 只用 zlib + 手写 PNG 解析，不引入依赖：
//   node abilities/plugins/magpie/tools/make-nav-icon.mjs
import { deflateSync, inflateSync } from "node:zlib";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pluginRoot = join(here, "..");
const SOURCE = join(pluginRoot, "assets", "icon.png");
const TARGET = join(pluginRoot, "src", "brand-icon.ts");
const SIZE = 64;

function decodePng(buffer) {
	if (buffer.readUInt32BE(0) !== 0x89504e47) throw new Error("not a png");
	let offset = 8;
	let width = 0;
	let height = 0;
	let colorType = 0;
	let bitDepth = 0;
	const idat = [];
	while (offset < buffer.length) {
		const length = buffer.readUInt32BE(offset);
		const type = buffer.toString("ascii", offset + 4, offset + 8);
		const data = buffer.subarray(offset + 8, offset + 8 + length);
		if (type === "IHDR") {
			width = data.readUInt32BE(0);
			height = data.readUInt32BE(4);
			bitDepth = data[8];
			colorType = data[9];
			if (bitDepth !== 8) throw new Error(`unsupported bit depth ${bitDepth}`);
			if (colorType !== 6 && colorType !== 2) throw new Error(`unsupported color type ${colorType}`);
		} else if (type === "IDAT") {
			idat.push(data);
		} else if (type === "IEND") {
			break;
		}
		offset += 12 + length;
	}
	const channels = colorType === 6 ? 4 : 3;
	const raw = inflateSync(Buffer.concat(idat));
	const stride = width * channels;
	const pixels = Buffer.alloc(width * height * channels);
	let previous = Buffer.alloc(stride);
	for (let y = 0; y < height; y += 1) {
		const filter = raw[y * (stride + 1)];
		const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
		const out = Buffer.from(line);
		for (let x = 0; x < stride; x += 1) {
			const left = x >= channels ? out[x - channels] : 0;
			const up = previous[x];
			const upLeft = x >= channels ? previous[x - channels] : 0;
			if (filter === 1) out[x] = (out[x] + left) & 0xff;
			else if (filter === 2) out[x] = (out[x] + up) & 0xff;
			else if (filter === 3) out[x] = (out[x] + ((left + up) >> 1)) & 0xff;
			else if (filter === 4) {
				const p = left + up - upLeft;
				const pa = Math.abs(p - left);
				const pb = Math.abs(p - up);
				const pc = Math.abs(p - upLeft);
				const predictor = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
				out[x] = (out[x] + predictor) & 0xff;
			} else if (filter !== 0) throw new Error(`bad filter ${filter}`);
		}
		out.copy(pixels, y * stride);
		previous = out;
	}
	return { width, height, channels, pixels };
}

function encodePng(width, height, rgba) {
	const stride = width * 4;
	const raw = Buffer.alloc((stride + 1) * height);
	for (let y = 0; y < height; y += 1) {
		raw[y * (stride + 1)] = 0;
		rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
	}
	const chunk = (type, data) => {
		const head = Buffer.alloc(4);
		head.writeUInt32BE(data.length, 0);
		const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
		const crc = Buffer.alloc(4);
		crc.writeUInt32BE(crc32(body) >>> 0, 0);
		return Buffer.concat([head, body, crc]);
	};
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(width, 0);
	ihdr.writeUInt32BE(height, 4);
	ihdr[8] = 8;
	ihdr[9] = 6;
	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk("IHDR", ihdr),
		chunk("IDAT", deflateSync(raw, { level: 9 })),
		chunk("IEND", Buffer.alloc(0)),
	]);
}

let table = null;
function crc32(buffer) {
	if (!table) {
		table = new Uint32Array(256);
		for (let n = 0; n < 256; n += 1) {
			let c = n;
			for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
			table[n] = c >>> 0;
		}
	}
	let crc = 0xffffffff;
	for (const byte of buffer) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
	return crc ^ 0xffffffff;
}

const source = decodePng(readFileSync(SOURCE));
// 先按亮度做一次「抠底板」：底板 (#f6f6f6 → 0.965) 归零，鸟身 (≈0.05) 归 255，中间线性。
const lum = new Float64Array(source.width * source.height);
for (let i = 0; i < lum.length; i += 1) {
	const at = i * source.channels;
	const alpha = source.channels === 4 ? source.pixels[at + 3] / 255 : 1;
	const value = (0.2126 * source.pixels[at] + 0.7152 * source.pixels[at + 1] + 0.0722 * source.pixels[at + 2]) / 255;
	// 透明处按「白色」处理（等于没有形状）。
	lum[i] = alpha === 0 ? 1 : value;
}

// 先在全分辨率上算 alpha（1 = 鸟，0 = 白底/透明），再裁到鸟的外接框：
// 原图四周留白很多，直接缩放会让 16px 的导航项里只剩一只很小的鸟。
const alphaFull = new Float64Array(source.width * source.height);
for (let i = 0; i < alphaFull.length; i += 1) {
	alphaFull[i] = Math.min(1, Math.max(0, (0.9 - lum[i]) / 0.8));
}

let minX = source.width;
let minY = source.height;
let maxX = -1;
let maxY = -1;
for (let y = 0; y < source.height; y += 1) {
	for (let x = 0; x < source.width; x += 1) {
		if (alphaFull[y * source.width + x] <= 0.06) continue;
		if (x < minX) minX = x;
		if (y < minY) minY = y;
		if (x > maxX) maxX = x;
		if (y > maxY) maxY = y;
	}
}
if (maxX < 0) throw new Error("icon has no glyph");

// 外接框留 4% 内边距：贴边会让小尺寸下显得胖，完全不留又会和相邻导航项撞。
const boxW = maxX - minX + 1;
const boxH = maxY - minY + 1;
const padding = Math.round(Math.max(boxW, boxH) * 0.04);
const cropX = minX - padding;
const cropY = minY - padding;
const cropW = boxW + padding * 2;
const cropH = boxH + padding * 2;

const sample = (fx, fy) => {
	const x = Math.min(source.width - 1, Math.max(0, Math.floor(fx)));
	const y = Math.min(source.height - 1, Math.max(0, Math.floor(fy)));
	return x < 0 || y < 0 || x >= source.width || y >= source.height ? 0 : alphaFull[y * source.width + x];
};

const target = Buffer.alloc(SIZE * SIZE * 4);
for (let y = 0; y < SIZE; y += 1) {
	for (let x = 0; x < SIZE; x += 1) {
		// 双线性采样：裁剪后的框不一定能整除成 SIZE，最近邻会在鸟的翅膀上锯齿。
		const sx = cropX + ((x + 0.5) / SIZE) * cropW - 0.5;
		const sy = cropY + ((y + 0.5) / SIZE) * cropH - 0.5;
		const x0 = Math.floor(sx);
		const y0 = Math.floor(sy);
		const tx = sx - x0;
		const ty = sy - y0;
		const value =
			sample(x0, y0) * (1 - tx) * (1 - ty) +
			sample(x0 + 1, y0) * tx * (1 - ty) +
			sample(x0, y0 + 1) * (1 - tx) * ty +
			sample(x0 + 1, y0 + 1) * tx * ty;
		const at = (y * SIZE + x) * 4;
		target[at] = 0;
		target[at + 1] = 0;
		target[at + 2] = 0;
		target[at + 3] = Math.round(255 * Math.min(1, Math.max(0, value)));
	}
}

const png = encodePng(SIZE, SIZE, target);
const base64 = png.toString("base64");
if (!/^[A-Za-z0-9+/=]+$/.test(base64)) throw new Error("bad base64");

const file = `/**
 * 侧边栏工作区图标的单色字形（96×96 PNG，透明底 + 黑色鸟，data URI）。
 *
 * 由 \`node tools/make-nav-icon.mjs\` 从官方 \`assets/icon.png\` 派生：按亮度把浅色底板
 * 抠成透明，只留鸟的剪影。之所以不直接把 \`assets/icon.png\` 交给侧边栏：宿主会用
 * \`currentColor\` 遮罩图片图标（见宿主 \`plugin-nav-icon.ts\`），而那张图有一块不透明的
 * 浅色圆角底板，掩出来就是一块实心方块。抠掉底板后，遮罩只落在鸟身上，深浅主题都跟着
 * 前景色走，与内置导航项一致。
 *
 * 重新生成：\`node tools/make-nav-icon.mjs\`（改完 assets/icon.png 后跑一次）。
 */
export const MAGPIE_NAV_ICON =
	"data:image/png;base64,${base64}";
`;

writeFileSync(TARGET, file);
console.log(`wrote ${TARGET} (${png.length} bytes png → ${base64.length} base64)`);
