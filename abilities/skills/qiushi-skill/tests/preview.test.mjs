/**
 * The illustrated intro page must be self-contained: opened from anywhere,
 * offline, with no upstream identifiers left in it.
 *   node --test tests/*.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PAGE = "assets/preview/index.html";

test("介绍页存在且不引用任何网络资源", () => {
  const html = readFileSync(path.join(ROOT, PAGE), "utf8");
  assert.ok(html.length > 5000, "介绍页内容过短，可能没有整合完成");
  const remote = [...html.matchAll(/(?:src|href)="(https?:\/\/[^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(remote, [], "介绍页不应再引用外部资源（离线打开会空白）");
  assert.equal((html.match(/@import\s+url/g) ?? []).length, 0, "不应再引入外部字体");
});

test("两张字标图内联为有效 PNG", () => {
  const html = readFileSync(path.join(ROOT, PAGE), "utf8");
  const inline = [...html.matchAll(/src="data:image\/png;base64,([^"]+)"/g)].map((m) => m[1]);
  assert.equal(inline.length, 2, "介绍页应内联两张字标图，且不再依赖同目录文件");
  for (const payload of inline) {
    const bytes = Buffer.from(payload, "base64");
    assert.ok(bytes.length > 4096, `内联图过小：${bytes.length} 字节`);
    assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", "内联数据不是 PNG");
  }
});

test("介绍页没有残留上游标识", () => {
  const html = readFileSync(path.join(ROOT, PAGE), "utf8");
  for (const marker of ["HughYau", "github.com", "star-history", "trendshift", "gtag(", "npx qiushi-skill"]) {
    assert.ok(!html.includes(marker), `介绍页仍含上游标识：${marker}`);
  }
});

test("同目录资源引用都能落地", () => {
  const html = readFileSync(path.join(ROOT, PAGE), "utf8");
  const dir = path.dirname(path.join(ROOT, PAGE));
  const locals = [...html.matchAll(/(?:src|href)="(\.\/[^"]+)"/g)].map((m) => m[1]);
  for (const local of locals) {
    assert.ok(existsSync(path.join(dir, local)), `同目录资源不存在：${local}`);
  }
});

test("原始图片仍随包分发", () => {
  for (const name of ["qiushi.png", "shishiqiushi.png"]) {
    const file = path.join(ROOT, "assets/preview", name);
    assert.ok(existsSync(file), `缺少原始图片：assets/preview/${name}`);
  }
});
