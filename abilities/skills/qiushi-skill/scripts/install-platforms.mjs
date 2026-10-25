#!/usr/bin/env node
/**
 * Copy this package into the directory another host reads, and take it out again.
 *
 * The upstream `bin/` installer resolves an npm package name and a GitHub coordinate; neither
 * exists in this package. What survives is the behaviour worth keeping: a per-target ledger,
 * a refusal to overwrite paths it did not write, and an uninstall that removes only its own
 * entries. No network, no dependencies.
 *
 *   node scripts/install-platforms.mjs --list
 *   node scripts/install-platforms.mjs --target codex
 *   node scripts/install-platforms.mjs --target all --dry-run
 *   node scripts/install-platforms.mjs --target claude-code --scope project
 *   node scripts/install-platforms.mjs --uninstall --target codex
 */

import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CATALOG_PATH = path.join(PACKAGE_ROOT, "scripts", "platforms.json");
const MANIFEST_NAME = ".qiushi-skill-install.json";

function parseArgs(argv) {
  const options = {
    list: false,
    uninstall: false,
    dryRun: false,
    json: false,
    force: false,
    scope: "user",
    targets: [],
    dest: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--list" || arg === "-l") options.list = true;
    else if (arg === "--uninstall" || arg === "-u") options.uninstall = true;
    else if (arg === "--dry-run" || arg === "-n") options.dryRun = true;
    else if (arg === "--json") options.json = true;
    else if (arg === "--force" || arg === "-f") options.force = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--scope") options.scope = String(argv[(index += 1)] ?? "").toLowerCase();
    else if (arg === "--target") {
      while (argv[index + 1] && !argv[index + 1].startsWith("-")) {
        options.targets.push(argv[(index += 1)].toLowerCase());
      }
    } else if (arg === "--dest") options.dest = argv[(index += 1)] ?? null;
    else if (arg.startsWith("--scope=")) options.scope = arg.slice(8).toLowerCase();
    else if (arg.startsWith("--dest=")) options.dest = arg.slice(7);
    else if (arg.startsWith("--target=")) options.targets.push(...arg.slice(9).toLowerCase().split(",").filter(Boolean));
    else throw new Error(`Unknown argument: ${arg}`);
  }

  options.targets = [...new Set(options.targets.flatMap((value) => String(value).split(",")).filter(Boolean))];
  return options;
}

const HELP = `qiushi-skill — copy the package where another host can read it

  --list, -l                 detect hosts, print target paths, copy nothing
  --target, -t <ids>         one or more ids, or "all"
  --scope <user|project>     which of the two defined roots to use (default: user)
  --dest <path>              override the resolved root (single target only)
  --uninstall, -u            remove the entries this script wrote
  --dry-run, -n              print the plan, touch nothing
  --json                     machine-readable output
  --force, -f                allow writing into a non-empty unmanaged target
  --help, -h                 this text

Targets are defined in scripts/platforms.json. See PLATFORMS.md for the per-host table.`;

function fail(message) {
  process.stderr.write(`error: ${message}\n`);
  process.exitCode = 1;
}

/**
 * `~`, `<project>/` and `$NAME` / `${NAME}/…` are the only forms the catalog may use.
 * An unset variable resolves to null: for a detect marker that means "this host is not
 * here", and for a root it means the caller must fall back.
 */
function expandPath(value, { home, cwd, env = process.env }) {
  if (value === "~") return home;
  if (value.startsWith("~/")) return path.join(home, value.slice(2));
  if (value.startsWith("<project>/")) return path.join(cwd, value.slice(10));
  if (value === "<project>") return cwd;

  const fromEnv = /^\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?(?:\/(.*))?$/.exec(value);
  if (fromEnv) {
    const base = env[fromEnv[1]];
    if (!base) return null;
    const rest = fromEnv[2] ?? "";
    return rest ? path.join(path.resolve(base), rest) : path.resolve(base);
  }

  return path.resolve(cwd, value);
}

/**
 * A host may relocate its own directory (Codex does, through CODEX_HOME). `envRoot`
 * maps that variable to the suffix this package lives under, and wins over `user`
 * when the variable is set — the same choice the host itself makes.
 */
function rootFor(target, scope, { home, cwd, env = process.env }) {
  if (scope === "user" && target.root?.envRoot) {
    for (const [name, suffix] of Object.entries(target.root.envRoot)) {
      const base = env[name];
      if (base) return path.join(path.resolve(expandPath(base, { home, cwd, env }) ?? base), suffix);
    }
  }

  const spec = target.root?.[scope];
  return spec ? expandPath(spec, { home, cwd, env }) : null;
}

function commandRootFor(target, scope, { home, cwd, env = process.env }) {
  const spec = target.commandRoot?.[scope];
  return spec ? expandPath(spec, { home, cwd, env }) : null;
}

/** Every base an envRoot variable may point at, so the safety check can allow it. */
function envRootBases(target, scope, env = process.env) {
  if (scope !== "user") return [];
  return Object.keys(target.root?.envRoot ?? {})
    .map((name) => env[name])
    .filter(Boolean)
    .map((base) => path.resolve(base));
}

async function isDirectory(target) {
  try {
    return (await stat(target)).isDirectory();
  } catch {
    return false;
  }
}

async function detect(target, { home, cwd, env = process.env }) {
  const markers = (target.detect ?? [])
    .map((marker) => expandPath(marker, { home, cwd, env }))
    .filter(Boolean);
  if (markers.length === 0) return false;

  for (const marker of markers) {
    if (existsSync(marker)) return true;
  }
  return false;
}

function assertSafeRoot(root, { home, cwd, dest, extra = [] }) {
  const resolved = path.resolve(root);

  if (resolved === path.parse(resolved).root) {
    throw new Error(`refusing to use a filesystem root as a target: ${resolved}`);
  }

  // `extra` carries envRoot bases: a host that was relocated on purpose (CODEX_HOME)
  // is somewhere the user asked for, so it is inside the boundary by consent.
  const allowed = [home, cwd, ...extra].map((base) => path.resolve(base));
  const inside = allowed.some((base) => resolved === base || resolved.startsWith(`${base}${path.sep}`));

  if (!inside) {
    throw new Error(`refusing to write outside the home directory, the current project or a declared $VAR root: ${resolved}`);
  }

  if (!dest && path.basename(resolved) !== "qiushi-skill") {
    throw new Error(`refusing to use an unexpected target path (expected a qiushi-skill folder): ${resolved}`);
  }

  return resolved;
}

async function readManifest(root) {
  const manifestPath = path.join(root, MANIFEST_NAME);

  if (!existsSync(manifestPath)) {
    return [];
  }

  const parsed = JSON.parse(await readFile(manifestPath, "utf8"));
  return Array.isArray(parsed.entries) ? parsed.entries : [];
}

async function writeManifest(root, entries) {
  const payload = {
    package: "qiushi-skill",
    schemaVersion: 1,
    entries: entries.sort((left, right) => left.path.localeCompare(right.path)),
  };

  await writeFile(path.join(root, MANIFEST_NAME), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

/** One copy job: put `from` at `<root>/<to>`. */
function planFor(target, catalog, scope, { home, cwd, dest, env = process.env }) {
  const jobs = [];
  const root = dest ? path.resolve(cwd, dest) : rootFor(target, scope, { home, cwd, env });

  if (!root) throw new Error(`target '${target.id}' has no ${scope} root`);

  const commandRoot = commandRootFor(target, scope, { home, cwd, env });

  for (const assetName of target.assets ?? []) {
    const asset = catalog.assets?.[assetName];
    if (!asset) throw new Error(`target '${target.id}' references unknown asset '${assetName}'`);

    const into = assetName === "commands" && commandRoot ? commandRoot : root;
    const to = assetName === "commands" && commandRoot ? "" : asset.to;
    jobs.push({ asset: assetName, spec: asset, root: into, to });
  }

  return { target, root, commandRoot, jobs };
}

async function copyPlan(plan, catalog, { dryRun, force }) {
  const written = [];
  const logs = [];

  const groups = new Map();
  for (const job of plan.jobs) {
    const key = job.root;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(job);
  }

  for (const [root, jobs] of groups) {
    if (!dryRun) await mkdir(root, { recursive: true });

    const existing = await readManifest(root);
    const known = new Set(existing.map((entry) => entry.path));
    const entries = [...existing];

    for (const job of jobs) {
      const { spec } = job;
      const source = path.join(PACKAGE_ROOT, spec.from);

      if (!existsSync(source)) {
        if (spec.required) throw new Error(`missing required asset: ${spec.from}`);
        logs.push(`skip  ${spec.from} (absent)`);
        continue;
      }

      if (spec.kind === "file") {
        const destination = path.join(job.root, job.to || path.basename(spec.from));
        const rel = path.relative(job.root, destination);

        if (force || !existsSync(destination) || known.has(rel)) {
          if (!dryRun) {
            await mkdir(path.dirname(destination), { recursive: true });
            await cp(source, destination, { force: true });
          }
          written.push(rel);
          if (!known.has(rel)) entries.push({ path: rel, type: "file", asset: job.asset });
          logs.push(`file  ${rel}`);
        } else {
          logs.push(`keep  ${rel} (exists, not ours — use --force to overwrite)`);
        }
        continue;
      }

      const wanted = await readdir(source, { withFileTypes: true });
      const filtered = spec.kind === "files"
        ? wanted.filter((entry) => entry.isFile() && entry.name.endsWith(spec.extension ?? ".md"))
        : wanted;

      for (const entry of filtered) {
        const destination = path.join(job.root, job.to, entry.name);
        const rel = path.relative(job.root, destination);

        if (!force && existsSync(destination) && !known.has(rel)) {
          logs.push(`keep  ${rel} (exists, not ours — use --force to overwrite)`);
          continue;
        }

        if (!dryRun) {
          await mkdir(path.dirname(destination), { recursive: true });
          await rm(destination, { recursive: true, force: true });
          await cp(path.join(source, entry.name), destination, { recursive: true, force: true });
          if (entry.name === "session-start" || entry.name === "run-hook.cmd") {
            await chmodExecutable(destination);
          }
        }

        written.push(rel);
        if (!known.has(rel)) {
          entries.push({ path: rel, type: entry.isDirectory() ? "directory" : "file", asset: job.asset });
        }
        logs.push(`${entry.isDirectory() ? "dir " : "file"}  ${rel}`);
      }
    }

    if (!dryRun) await writeManifest(root, entries);
  }

  return { written, logs };
}

async function chmodExecutable(target) {
  try {
    const { chmod } = await import("node:fs/promises");
    await chmod(target, 0o755);
  } catch {
    /* Windows or a read-only mount: the hook cmd shim still works. */
  }
}

async function writeManifestFile(plan, destination, payload, asset, { dryRun }) {
  const rel = path.relative(plan.root, destination);
  if (dryRun) return rel;

  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  const entries = await readManifest(plan.root);
  if (!entries.some((entry) => entry.path === rel)) {
    entries.push({ path: rel, type: "file", asset });
    await writeManifest(plan.root, entries);
  }

  return rel;
}

async function writePluginManifest(plan, options) {
  const spec = plan.target.pluginManifest;
  if (!spec) return null;

  return writeManifestFile(
    plan,
    path.join(plan.root, spec.path),
    { name: spec.name, description: spec.description },
    "pluginManifest",
    options,
  );
}

/**
 * Claude Code does not load a directory just because it sits in `~/.claude/plugins`:
 * it needs a marketplace that names the folder as a plugin source. Writing
 * `.claude-plugin/marketplace.json` inside the copy is what turns `cp -r` into
 * something `/plugin marketplace add <root>` can actually install.
 */
async function writeMarketplaceManifest(plan, options) {
  const spec = plan.target.marketplaceManifest;
  if (!spec) return null;

  return writeManifestFile(
    plan,
    path.join(plan.root, spec.path),
    {
      name: spec.name,
      owner: spec.owner,
      metadata: { description: spec.plugin?.description },
      plugins: [spec.plugin],
    },
    "marketplaceManifest",
    options,
  );
}

async function uninstallPlan(plan, { dryRun }) {
  const roots = [...new Set([plan.root, plan.commandRoot].filter(Boolean))];
  const removed = [];

  for (const root of roots) {
    const entries = await readManifest(root);
    const parents = new Set();

    for (const entry of entries) {
      if (!entry.path || entry.path.includes("..")) continue;
      const destination = path.join(root, entry.path);
      // Every ancestor, deepest last, so an emptied references/cases does not leave a
      // references/ behind after removing the files inside it.
      const parts = entry.path.split("/").slice(0, -1);
      for (let depth = 1; depth <= parts.length; depth += 1) parents.add(parts.slice(0, depth).join("/"));

      if (dryRun) {
        removed.push(path.relative(root, destination));
        continue;
      }
      await rm(destination, { recursive: true, force: true });
      removed.push(path.relative(root, destination));
    }

    if (dryRun) {
      removed.push(path.relative(root, path.join(root, MANIFEST_NAME)));
      continue;
    }

    // Only folders this script created are candidates; rmdir fails harmlessly on anything else.
    for (const parent of [...parents].sort((left, right) => right.length - left.length)) {
      try {
        const { rmdir } = await import("node:fs/promises");
        await rmdir(path.join(root, parent));
      } catch {
        /* not empty, or never created by us */
      }
    }

    await rm(path.join(root, MANIFEST_NAME), { force: true });

    // The package root itself is ours too. Only the primary root is a candidate: a
    // shared commandRoot belongs to the host, so an empty one stays where it is.
    if (root === plan.root) {
      try {
        const { rmdir } = await import("node:fs/promises");
        await rmdir(root);
      } catch {
        /* not empty, or never created by us */
      }
    }
  }

  return removed;
}

function describeTarget(target, plan, detected, scope) {
  const assets = (target.assets ?? []).join(", ");
  return {
    id: target.id,
    label: target.label,
    detected,
    kind: target.kind,
    scope,
    root: plan?.root ?? null,
    commandRoot: plan?.commandRoot ?? null,
    assets,
    hooksNote: target.hooksNote ?? null,
    note: target.note ?? null,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    process.stdout.write(`${HELP}\n`);
    return;
  }

  const catalog = JSON.parse(await readFile(CATALOG_PATH, "utf8"));
  const home = os.homedir();
  const env = process.env;
  const cwd = process.cwd();
  const targets = catalog.targets ?? [];

  if (options.list || options.targets.length === 0) {
    const rows = [];

    for (const target of targets) {
      const detected = await detect(target, { home, cwd, env });
      let plan = null;
      try {
        plan = planFor(target, catalog, options.scope, { home, cwd, dest: null, env });
      } catch {
        plan = null;
      }
      rows.push(describeTarget(target, plan, detected, options.scope));
    }

    if (options.json) {
      process.stdout.write(`${JSON.stringify({ scope: options.scope, targets: rows }, null, 2)}\n`);
      return;
    }

    process.stdout.write(`qiushi-skill — targets (scope: ${options.scope})\n\n`);
    for (const row of rows) {
      const mark = row.detected ? "detected" : "        ";
      const where = row.root ? row.root.replace(home, "~") : "(no root)";
      process.stdout.write(`  [${mark}] ${row.id.padEnd(12)} ${where}\n`);
      process.stdout.write(`               assets: ${row.assets}\n`);
      if (row.commandRoot) process.stdout.write(`               commands: ${row.commandRoot.replace(home, "~")}\n`);
      if (row.note) process.stdout.write(`               note: ${row.note}\n`);
    }
    process.stdout.write("\nCopy with --target <id>; see PLATFORMS.md for the table and caveats.\n");
    return;
  }

  if (!["user", "project"].includes(options.scope)) {
    fail(`--scope must be "user" or "project", got "${options.scope}"`);
    return;
  }

  const wanted = options.targets.includes("all") ? targets.map((target) => target.id) : options.targets;
  const unknown = wanted.filter((id) => !targets.some((target) => target.id === id));

  if (unknown.length) {
    fail(`unknown target(s): ${unknown.join(", ")}. Known: ${targets.map((target) => target.id).join(", ")}`);
    return;
  }

  if (options.dest && wanted.length !== 1) {
    fail("--dest requires exactly one --target");
    return;
  }

  const results = [];

  for (const id of wanted) {
    const target = targets.find((candidate) => candidate.id === id);
    const plan = planFor(target, catalog, options.scope, { home, cwd, dest: options.dest, env });
    plan.root = assertSafeRoot(plan.root, {
      home,
      cwd,
      dest: Boolean(options.dest),
      extra: envRootBases(target, options.scope, env),
    });

    if (!options.uninstall) {
      const pluginRel = await writePluginManifest(plan, { dryRun: options.dryRun });
      const marketplaceRel = await writeMarketplaceManifest(plan, { dryRun: options.dryRun });
      const { written, logs } = await copyPlan(plan, catalog, { dryRun: options.dryRun, force: options.force });
      if (pluginRel) logs.unshift(`file  ${pluginRel}`);
      if (marketplaceRel) logs.unshift(`file  ${marketplaceRel}`);

      const nextSteps = (target.nextSteps ?? []).map((step) => step.replaceAll("{root}", plan.root));
      results.push({ id, action: "install", root: plan.root, written, logs, nextSteps, dryRun: options.dryRun });
      continue;
    }

    const removed = await uninstallPlan(plan, { dryRun: options.dryRun });
    results.push({ id, action: "uninstall", root: plan.root, removed, dryRun: options.dryRun });
  }

  if (options.json) {
    process.stdout.write(`${JSON.stringify({ scope: options.scope, dryRun: options.dryRun, results }, null, 2)}\n`);
    return;
  }

  for (const result of results) {
    const verb = result.action === "install" ? (result.dryRun ? "would install" : "installed") : (result.dryRun ? "would remove" : "removed");
    process.stdout.write(`\n${verb} ${result.id} → ${result.root.replace(home, "~")}\n`);

    for (const line of result.logs ?? []) process.stdout.write(`  ${line}\n`);
    for (const entry of result.removed ?? []) process.stdout.write(`  - ${entry}\n`);

    if (result.action === "install" && result.written.length === 0) {
      process.stdout.write("  (nothing written)\n");
    }
    for (const step of result.nextSteps ?? []) {
      process.stdout.write(`  next  ${step}\n`);
    }
  }

  if (options.dryRun) process.stdout.write("\ndry run: nothing was written.\n");
}

main().catch((error) => {
  fail(error.message);
});
