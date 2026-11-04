#!/usr/bin/env node
/**
 * Build the web site each craft plugin ships inside its own package.
 *
 *   node scripts/build-craft-web.mjs --slug photocraft
 *   node scripts/build-craft-web.mjs --all
 *   node scripts/build-craft-web.mjs --slug photocraft --source-root ~/craft/code-clone
 *
 * Every plugin carries `payload/manifest.json` — the upstream repository, the exact
 * commit, which crate inside it is the web build, and which of upstream's own build
 * recipes produces that crate's site:
 *
 *   trunk       `trunk build --release` in the web crate            (eleven apps)
 *   trunk-boot  two trunk crates, the app shipped as gzip'd parts   (photocraft)
 *   xtask       `cargo xtask web` → wasm-bindgen CLI                (effectcraft, filmcraft, lightcraft)
 *
 * This script checks the pin out of the checkout, runs that recipe, and copies the
 * result to `abilities/plugins/<slug>/<site>/`.
 *
 * The result is upstream's own build output, assembled the way upstream's
 * `packaging/web/package.sh` assembles it — just not delivered as their release zip.
 * (Photocraft's gzip framing is produced here instead of by shelling out to `gzip -9 -n`,
 * so those bytes are a valid gzip of the same wasm, not the identical stream.)
 * The site is NOT committed: `web/` is gitignored and CI builds it before packaging.
 */
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { cpSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PLUGINS = join(ROOT, "abilities/plugins");

/**
 * Environment every child build sees. `~/.cargo/bin` is prepended once rustup has run, so the
 * recipe commands resolve even though no shell profile was re-sourced.
 */
let BASE_ENV = process.env;

function hasCommand(command) {
  return spawnSync("sh", ["-c", `command -v ${command} >/dev/null 2>&1`], { stdio: "ignore" }).status === 0;
}

function step(title) {
  process.stdout.write(`\n== ${title}\n`);
}

/**
 * The publishing workflow installs nothing for Rust: it was written for a JavaScript-only build and
 * is deliberately left alone. So this script provisions what upstream's recipe needs, once per run,
 * and only when the tool is actually missing (a developer machine or a warm runner skips all of it).
 *
 * `wasm-bindgen` is needed by the three `cargo xtask web` apps; the eleven trunk apps get the
 * equivalent from trunk's own bundle, so that install is skipped for them.
 */
function ensureToolchain({ needsWasmBindgen }) {
  const missing = [];
  if (!hasCommand("cargo")) missing.push("cargo");
  if (!hasCommand("trunk")) missing.push("trunk");
  if (!hasCommand("wasm-opt")) missing.push("wasm-opt");
  if (needsWasmBindgen && !hasCommand("wasm-bindgen")) missing.push("wasm-bindgen");
  if (missing.length === 0) return;

  step(`toolchain: installing ${missing.join(", ")}`);

  if (!hasCommand("cargo")) {
    if (process.platform === "win32") throw new Error("install Rust from https://rustup.rs, then rerun");
    run("sh", [
      "-c",
      "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal --default-toolchain stable --target wasm32-unknown-unknown --no-modify-path",
    ]);
  } else {
    run("rustup", ["target", "add", "wasm32-unknown-unknown"]);
  }
  BASE_ENV = { ...process.env, PATH: `${join(homedir(), ".cargo", "bin")}${process.platform === "win32" ? ";" : ":"}${process.env.PATH}` };

  if (!hasCommand("trunk")) run("cargo", ["install", "trunk", "--locked"]);
  // Every upstream `index.html` carries `data-wasm-opt="z"`, so trunk wants wasm-opt even when the
  // build is not minified. Trunk can fetch its own copy; a package-managed one removes that step.
  if (!hasCommand("wasm-opt")) {
    if (process.platform === "darwin") run("brew", ["install", "binaryen"]);
    else if (hasCommand("apt-get")) run("sh", ["-c", "sudo apt-get update -qq && sudo apt-get install -y binaryen"]);
    else throw new Error("install binaryen (wasm-opt) from https://github.com/WebAssembly/binaryen/releases, then rerun");
  }
  // `cargo xtask web` calls the bindgen CLI directly, and the crate refuses a version mismatch.
  if (needsWasmBindgen && !hasCommand("wasm-bindgen")) run("cargo", ["install", "wasm-bindgen-cli", "--version", "0.2.129", "--locked"]);
}

function parseArgs(argv) {
  const options = { slugs: [], sourceRoot: process.env.CRAFT_SOURCE_ROOT || "", all: false, jobs: 1, ifMissing: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--all") options.all = true;
    else if (arg === "--slug") options.slugs.push(argv[++i]);
    else if (arg === "--source-root") options.sourceRoot = argv[++i];
    else if (arg === "--jobs") options.jobs = Number(argv[++i]) || 1;
    else if (arg === "--if-missing") options.ifMissing = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!options.all && options.slugs.length === 0) throw new Error("pass --slug <slug> or --all");
  return options;
}

/** Every plugin that carries a v3 provenance manifest. */
function pluginsWithSites() {
  return readdirSync(PLUGINS)
    .filter((slug) => existsSync(join(PLUGINS, slug, "payload/manifest.json")))
    .filter((slug) => {
      const manifest = JSON.parse(readFileSync(join(PLUGINS, slug, "payload/manifest.json"), "utf8"));
      return manifest.schemaVersion === 3;
    });
}

function run(command, args, options) {
  const printable = [command, ...args].join(" ");
  process.stdout.write(`  $ ${printable}\n`);
  execFileSync(command, args, { stdio: "inherit", env: BASE_ENV, ...options });
}

function capture(command, args, options) {
  return execFileSync(command, args, { encoding: "utf8", ...options }).trim();
}

/**
 * The checkout this build reads from. A missing one is cloned; an existing one is
 * never pulled — the pin decides what gets built, not whatever main is today.
 */
function ensureCheckout(name, upstream, commit, sourceRoot) {
  const repoDir = join(sourceRoot, name);
  if (!existsSync(join(repoDir, ".git"))) {
    mkdirSync(sourceRoot, { recursive: true });
    run("git", ["clone", "--filter=blob:none", "--no-checkout", upstream, repoDir]);
  }
  const head = (() => {
    try {
      return capture("git", ["-C", repoDir, "rev-parse", "HEAD"]);
    } catch {
      return "";
    }
  })();
  if (head !== commit) {
    run("git", ["-C", repoDir, "fetch", "--depth", "1", "origin", commit]);
    run("git", ["-C", repoDir, "checkout", "--force", commit]);
  }
  const actual = capture("git", ["-C", repoDir, "rev-parse", "HEAD"]);
  if (actual !== commit) {
    throw new Error(`${name}: checkout is at ${actual}, the pin says ${commit}`);
  }
  return repoDir;
}

function duBytes(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) total += duBytes(path);
    else if (entry.isFile()) total += statSync(path).size;
  }
  return total;
}

function hashFile(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/**
 * Upstream's package script refuses a root-absolute URL, because the site is served
 * from a package directory rather than a domain root. Same rule here, before the
 * copy, so a broken build never reaches the packager.
 */
function assertRelativeIndex(indexPath) {
  const html = readFileSync(indexPath, "utf8");
  const absolute = /(?:src|href)="\/(?!\/)/.exec(html);
  if (absolute) throw new Error(`index.html has a root-absolute URL: ${absolute[0]}`);
}

/**
 * Where trunk / xtask write their artifacts. One directory for every app keeps the dependency
 * graph warm: fifteen Rust crates that share egui and wgpu rebuild only their own object files.
 */
function cargoTarget(options) {
  return process.env.CARGO_TARGET_DIR || join(options.sourceRoot, ".cargo-target-web");
}

/** Upstream's own `trunk build --release` for one crate, then its `dist/web`. */
function buildTrunk(repoDir, crate, options) {
  if (!existsSync(join(repoDir, crate, "Trunk.toml"))) {
    throw new Error(`${crate} has no Trunk.toml — is this the web crate?`);
  }
  const outDir = join(repoDir, "dist/web");
  rmSync(outDir, { recursive: true, force: true });
  run("trunk", ["build", "--release"], {
    cwd: join(repoDir, crate),
    env: { ...process.env, CARGO_TARGET_DIR: cargoTarget(options) },
  });
  if (!existsSync(join(outDir, "index.html"))) throw new Error(`trunk produced no index.html in ${outDir}`);
  return outDir;
}

/**
 * Upstream's `cargo xtask web`: cargo → wasm-bindgen CLI (pinned by the crate) → optional
 * wasm-opt, with the page and its worker files copied in as they are. Same recipe the repo's
 * `packaging/web/package.sh` runs, so the bytes are the ones upstream would ship.
 */
function buildXtask(repoDir, manifest, options) {
  const env = { ...process.env, CARGO_TARGET_DIR: cargoTarget(options) };
  if (manifest.build.fonts) {
    // Upstream's packaging sources `packaging/fonts.sh`, which checks out craft-fonts at a pinned
    // commit and exports CRAFT_FONTS_DIR; `cargo xtask web` then copies the CJK face into the site.
    // Without it the build still succeeds and the UI falls back to missing-glyph boxes.
    const { repo, commit } = manifest.build.fonts;
    env.CRAFT_FONTS_DIR = ensureCheckout("craft-fonts", repo, commit, options.sourceRoot);
    env.CRAFT_FONTS_REQUIRED = "1";
  }
  run("cargo", ["xtask", "web"], { cwd: repoDir, env });
  const outDir = join(cargoTarget(options), manifest.build.out);
  if (!existsSync(join(outDir, "index.html"))) {
    throw new Error(`cargo xtask web produced no index.html in ${outDir}`);
  }
  return outDir;
}

/** Split one gzip stream into `part-aa`, `part-ab`, … — photocraft's own 20 MiB framing. */
function writeParts(gz, appDir, stem) {
  const PART_BYTES = 20 * 1024 * 1024;
  const names = [];
  for (let offset = 0, index = 0; offset < gz.length; offset += PART_BYTES, index += 1) {
    const name = `${stem}.part-${String.fromCharCode(97 + Math.floor(index / 26))}${String.fromCharCode(97 + (index % 26))}`;
    writeFileSync(join(appDir, name), gz.subarray(offset, offset + PART_BYTES));
    names.push(name);
  }
  writeFileSync(join(appDir, "parts.txt"), ["photocraft-parts 1", ...names, ""].join("\n"));
  return names;
}

/**
 * Photocraft does not ship `dist/web` directly: its page is a small boot module that fetches the
 * app in gzip'd parts (the app's wasm is over the per-file cap some hosts enforce). Rebuild that
 * layout exactly as `packaging/web/package.sh` does — boot page at the root, app glue and parts
 * under `app/`.
 */
function buildTrunkBoot(repoDir, manifest, options, stage) {
  const appDir = buildTrunk(repoDir, manifest.webApp, options);
  const bootDir = buildTrunk(repoDir, manifest.build.boot, options);
  cpSync(bootDir, stage, { recursive: true });
  mkdirSync(join(stage, "app"), { recursive: true });

  const wasm = readdirSync(appDir).filter((name) => name.endsWith("_bg.wasm"));
  if (wasm.length !== 1) throw new Error(`expected one *_bg.wasm in ${appDir}, found ${wasm.length}`);
  const stem = wasm[0].slice(0, -"_bg.wasm".length);
  cpSync(join(appDir, `${stem}.js`), join(stage, "app", `${manifest.slug}-web.js`));
  const parts = writeParts(gzipSync(readFileSync(join(appDir, wasm[0])), { level: 9 }), join(stage, "app"), stem);
  process.stdout.write(`[${manifest.slug}] app wasm split into ${parts.length} part(s)\n`);
  return join(stage, "index.html");
}

function buildOne(slug, options) {
  const pluginDir = join(PLUGINS, slug);
  const manifestPath = join(pluginDir, "payload/manifest.json");
  const manifest = { slug, ...JSON.parse(readFileSync(manifestPath, "utf8")) };
  const site = manifest.site || "web";
  const recipe = manifest.build?.recipe ?? "trunk";
  process.stdout.write(`\n[${slug}] upstream ${manifest.upstream} @ ${manifest.commit.slice(0, 12)} (${recipe})\n`);

  const repoDir = ensureCheckout(manifest.slug, manifest.upstream, manifest.commit, options.sourceRoot);
  const stage = join(repoDir, `dist/${site}-package`);
  rmSync(stage, { recursive: true, force: true });
  mkdirSync(stage, { recursive: true });

  let index;
  if (recipe === "trunk") {
    const outDir = buildTrunk(repoDir, manifest.webApp, options);
    cpSync(outDir, stage, { recursive: true });
    index = join(stage, "index.html");
  } else if (recipe === "trunk-boot") {
    index = buildTrunkBoot(repoDir, manifest, options, stage);
  } else if (recipe === "xtask") {
    const outDir = buildXtask(repoDir, manifest, options);
    cpSync(outDir, stage, { recursive: true });
    index = join(stage, "index.html");
  } else {
    throw new Error(`${slug}: unknown build recipe ${recipe}`);
  }

  assertRelativeIndex(index);

  if (manifest.build?.skipPrecompressed) {
    // The site ships precompressed twins (`x.wasm.gz`, `x.wasm.br`) for hosts that negotiate
    // Content-Encoding. The plugin protocol serves raw bytes and the page fetches the module
    // directly, so those copies are dead weight — and they do not recompress inside the package.
    let dropped = 0;
    for (const dir of [stage]) {
      for (const name of readdirSync(dir, { withFileTypes: true })) {
        if (!name.isFile() || !/\.(?:gz|br)$/.test(name.name)) continue;
        rmSync(join(dir, name.name));
        dropped += 1;
      }
    }
    process.stdout.write(`[${slug}] dropped ${dropped} precompressed file(s) the plugin protocol cannot use\n`);
  }

  const target = join(pluginDir, site);
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  cpSync(stage, target, { recursive: true });

  const bytes = duBytes(target);
  process.stdout.write(
    `[${slug}] ${site}/ ${(bytes / 1024 / 1024).toFixed(1)} MiB, index.html sha256 ${hashFile(join(target, "index.html")).slice(0, 12)}\n`,
  );
  return { slug, bytes };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  // A runner has no checkout of the upstream repositories; `RUNNER_TEMP` is the one directory
  // guaranteed to exist, be writable and be discarded after the job.
  const fallbackRoot = process.env.RUNNER_TEMP
    ? join(process.env.RUNNER_TEMP, "craft-src")
    : join(ROOT, "..", "craft", "code-clone");
  const sourceRoot = resolve(options.sourceRoot || fallbackRoot);
  let slugs = options.all ? pluginsWithSites() : options.slugs;
  const unknown = slugs.filter((slug) => !existsSync(join(PLUGINS, slug, "payload/manifest.json")));
  if (unknown.length > 0) throw new Error(`no provenance manifest for: ${unknown.join(", ")}`);

  // `--if-missing` is what the package build passes: a site that is already on disk is the same
  // site this pin would produce, and rebuilding it would add half an hour per app for nothing.
  if (options.ifMissing) {
    const present = slugs.filter((slug) => {
      const manifest = JSON.parse(readFileSync(join(PLUGINS, slug, "payload/manifest.json"), "utf8"));
      return existsSync(join(PLUGINS, slug, manifest.site || "web", "index.html"));
    });
    if (present.length > 0) process.stdout.write(`already built, skipping: ${present.join(", ")}\n`);
    slugs = slugs.filter((slug) => !present.includes(slug));
    if (slugs.length === 0) return;
  }

  const needsWasmBindgen = slugs.some((slug) => {
    const manifest = JSON.parse(readFileSync(join(PLUGINS, slug, "payload/manifest.json"), "utf8"));
    return (manifest.build?.recipe ?? "trunk") === "xtask";
  });
  ensureToolchain({ needsWasmBindgen });

  process.stdout.write(
    `building ${slugs.length} site(s) from ${sourceRoot}\n` +
      `cargo target: ${process.env.CARGO_TARGET_DIR || join(sourceRoot, ".cargo-target-web")}\n`,
  );
  const done = [];
  for (const slug of slugs) done.push(buildOne(slug, { ...options, sourceRoot }));
  const total = done.reduce((sum, entry) => sum + entry.bytes, 0);
  process.stdout.write(`\n${done.length} site(s), ${(total / 1024 / 1024).toFixed(1)} MiB total\n`);
}

main();
