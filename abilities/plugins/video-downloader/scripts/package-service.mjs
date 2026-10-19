#!/usr/bin/env node
/**
 * Builds the managed service and packs it into a deterministic zip.
 *
 * The archive unpacks into `<runtime>/service`, so its root holds `dist/` and the
 * `package.json` that marks the tree as ESM. `release/` is git-ignored; only the digest is
 * declared in `plugin.json` and `runtime-lock.json`. Entry order, timestamps and compression
 * level are fixed so CI and a local run produce identical bytes.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(here, "..");
const manifest = JSON.parse(readFileSync(join(pluginRoot, "plugin.json"), "utf8"));
const serviceRoot = join(pluginRoot, "service");
const releaseRoot = join(pluginRoot, "release");
const staging = join(releaseRoot, ".staging");
const archive = join(releaseRoot, `video-downloader-service-${manifest.version}.zip`);

// `tsc` never deletes output for a source file that was removed, so a stale module would keep
// shipping after its source is gone. Build from a clean tree instead.
rmSync(join(serviceRoot, "dist"), { recursive: true, force: true });
execFileSync("npm", ["run", "build"], { cwd: serviceRoot, stdio: "inherit" });

rmSync(staging, { recursive: true, force: true });
mkdirSync(releaseRoot, { recursive: true });
cpSync(join(serviceRoot, "dist"), join(staging, "dist"), { recursive: true });
cpSync(join(serviceRoot, "package.json"), join(staging, "package.json"));
rmSync(archive, { force: true });

const python = process.env.ASTRAVIA_PYTHON ?? "python3";
execFileSync(
  python,
  [
    "-c",
    [
      "import os, sys, zipfile",
      "root, out = sys.argv[1], sys.argv[2]",
      "entries = []",
      "for base, dirs, files in os.walk(root):",
      "    dirs[:] = sorted(dirs)",
      "    for name in sorted(files):",
      "        path = os.path.join(base, name)",
      "        entries.append((os.path.relpath(path, root).replace(os.sep, '/'), path))",
      "entries.sort()",
      "with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as zf:",
      "    for arcname, path in entries:",
      "        info = zipfile.ZipInfo(arcname, date_time=(1980, 1, 1, 0, 0, 0))",
      "        info.external_attr = 0o644 << 16",
      "        info.compress_type = zipfile.ZIP_DEFLATED",
      "        with open(path, 'rb') as handle:",
      "            zf.writestr(info, handle.read())",
    ].join("\n"),
    staging,
    archive,
  ],
  { stdio: "inherit" },
);

rmSync(staging, { recursive: true, force: true });

const bytes = readFileSync(archive);
const digest = createHash("sha256").update(bytes).digest("hex");
process.stdout.write(`${archive}\n${bytes.length} bytes\nsha256 ${digest}\n`);
