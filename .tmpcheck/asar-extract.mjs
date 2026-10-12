import fs from "node:fs";
const p = "/Applications/Astravia.app/Contents/Resources/app.asar";
const out = process.argv[2];
const want = process.argv[3];
const fd = fs.openSync(p, "r");
const head = Buffer.alloc(16);
fs.readSync(fd, head, 0, 16, 0);
const headerSize = head.readUInt32LE(4);
const hv = Buffer.alloc(Math.min(headerSize, 8 * 1024 * 1024));
fs.readSync(fd, hv, 0, hv.length, 8);
const s = hv.toString("latin1");
const header = JSON.parse(s.slice(s.indexOf('{"files"'), s.lastIndexOf("}") + 1));
const dataStart = 8 + headerSize;
const hits = [];
const walk = (node, path) => {
  for (const [name, v] of Object.entries(node.files || {})) {
    const f = path ? path + "/" + name : name;
    if (v.files) walk(v, f);
    else if (f === want) hits.push([f, Number(v.offset), v.size]);
  }
};
walk(header, "");
if (!hits.length) {
  console.error("not found:", want);
  process.exit(1);
}
const [, off, sz] = hits[0];
const b = Buffer.alloc(sz);
fs.readSync(fd, b, 0, sz, dataStart + off);
fs.writeFileSync(out, b);
fs.closeSync(fd);
console.log(`extracted ${want} -> ${out} (${sz} B)`);
