import fs from "node:fs";
const p = "/Applications/Astravia.app/Contents/Resources/app.asar";
const fd = fs.openSync(p, "r");
const size = fs.readSync(fd, Buffer.alloc(0), 0, 0, 0) // noop
const head = Buffer.alloc(16);
fs.readSync(fd, head, 0, 16, 0);
console.log("first16:", [...head.subarray(0, 12)].join(","));
const headerSize = head.readUInt32LE(4);
console.log("headerSize candidate:", headerSize);
const hv = Buffer.alloc(Math.min(headerSize, 8 * 1024 * 1024));
fs.readSync(fd, hv, 0, hv.length, 8);
const s = hv.toString("latin1");
const start = s.indexOf('{"files"');
const end = s.lastIndexOf('}') + 1;
let header = null;
try { header = JSON.parse(s.slice(start, end)); } catch (e) { console.log("JSON parse failed:", e.message); }
if (header) {
  const dataStart = 8 + headerSize;
  const hits = [];
  const walk = (node, path) => {
    for (const [name, v] of Object.entries(node.files || {})) {
      const f = path ? path + "/" + name : name;
      if (v.files) walk(v, f);
      else hits.push([f, Number(v.offset), v.size]);
    }
  };
  walk(header, "");
  console.log("entries:", hits.length, "dataStart:", dataStart);
  for (const [f, off, sz] of hits) {
    if (!Number.isFinite(off) || !Number.isFinite(sz) || sz < 200 * 1024) continue;
    const b = Buffer.alloc(sz);
    fs.readSync(fd, b, 0, sz, dataStart + off);
    const t = b.toString("latin1");
    const hasC = t.includes("createHiddenWindow");
    const hasS = t.includes("stopPainting");
    if (hasC || hasS) {
      console.log(`\n### ${f}  ${(sz/1024/1024).toFixed(1)}MB  createHiddenWindow=${hasC} stopPainting=${hasS}`);
      for (const m of t.matchAll(/.{0,180}createHiddenWindow.{0,700}/gs)) { console.log("--- createHiddenWindow ctx ---\n" + m[0]); break; }
      for (const m of t.matchAll(/.{0,260}stopPainting.{0,260}/gs)) { console.log("--- stopPainting ctx ---\n" + m[0]); }
    }
  }
}
fs.closeSync(fd);
