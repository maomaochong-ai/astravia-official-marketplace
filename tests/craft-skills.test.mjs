/**
 * Every craft skill can reach every file it ships, and names nothing it does not ship.
 *
 * A skill package is the model's only map of the editor. Two failure modes were found in
 * this family and are pinned here:
 *
 *   - a reference the SKILL.md invites the model to read that is not in the package
 *     (a dead end the model discovers only after asking for it);
 *   - a reference file in the package that nothing points at — the model can never be
 *     told to read it, so it is weight and, once the pin moves, stale weight.
 *
 * Each file also has to earn its place: the audit that produced this test deleted upstream's
 * build, release, parity, roadmap and transport documentation from four packages, because
 * those describe maintaining upstream's repository or interfaces the shipped web build does
 * not have (docs/adr/photocraft/craft-0024-the-agent-stays-in-the-frame.md).
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../abilities/plugins/", import.meta.url));
const APPS = [
  "designcraft", "effectcraft", "filmcraft", "lightcraft", "pdfcraft", "vectorcraft", "photocraft",
  "cadcraft", "deckcraft", "figcraft", "gridcraft", "wordcraft", "texturecraft", "materialcraft",
  "craft-anything",
];

/** A pointer is a markdown link or a `references/...` path written as inline code. */
function pointers(text) {
  const out = [...text.matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1]);
  for (const m of text.matchAll(/`([^`\n]*?references\/[\w./-]+\.md)`/g)) out.push(m[1]);
  return out;
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function skillDir(app) {
  const manifest = JSON.parse(readFileSync(join(ROOT, app, "plugin.json"), "utf8"));
  const paths = manifest.agent?.skillPaths ?? [];
  assert.equal(paths.length, 1, `${app}: expected exactly one skill package`);
  const dir = join(ROOT, app, paths[0]);
  assert.ok(existsSync(join(dir, "SKILL.md")), `${app}: ${paths[0]}/SKILL.md is missing`);
  return dir;
}

test("no skill points at a reference it does not ship", () => {
  const problems = [];
  for (const app of APPS) {
    const dir = skillDir(app);
    const files = new Set(walk(dir).filter((f) => f.endsWith(".md")));
    for (const file of files) {
      for (const pointer of pointers(readFileSync(file, "utf8"))) {
        if (/^(https?:|mailto:|#)/.test(pointer)) continue;
        const target = resolve(dirname(file), pointer.split("#")[0]);
        const hit = files.has(target) ? target : files.has(join(target, "index.md")) ? join(target, "index.md") : null;
        if (hit) continue;
        // Only a claim about a packaged path counts; a bare upstream URL is fine.
        if (/references\//.test(pointer) || /^\.\.?\//.test(pointer)) {
          problems.push(`${app}: ${relative(dir, file)} -> ${pointer}`);
        }
      }
    }
  }
  assert.deepEqual(problems, [], `skills point at files they do not ship:\n${problems.join("\n")}`);
});

test("every reference a skill ships can be reached from its SKILL.md", () => {
  const problems = [];
  for (const app of APPS) {
    const dir = skillDir(app);
    const skillFile = join(dir, "SKILL.md");
    const files = new Set(walk(dir).filter((f) => f.endsWith(".md")));
    const reached = new Set([skillFile]);
    const queue = [skillFile];

    while (queue.length) {
      const file = queue.pop();
      for (const pointer of pointers(readFileSync(file, "utf8"))) {
        if (/^(https?:|mailto:|#)/.test(pointer)) continue;
        const target = resolve(dirname(file), pointer.split("#")[0]);
        const hit = files.has(target) ? target : files.has(join(target, "index.md")) ? join(target, "index.md") : null;
        if (hit && !reached.has(hit)) {
          reached.add(hit);
          queue.push(hit);
        }
      }
    }

    for (const file of files) {
      if (!reached.has(file)) problems.push(`${app}: ${relative(dir, file).split("\\").join("/")}`);
    }
  }
  assert.deepEqual(problems, [], `reference files nothing in the skill can lead to:\n${problems.join("\n")}`);
});

test("no skill ships upstream's repository-maintenance docs", () => {
  // The names stay banned because their content is about building, testing, releasing or
  // planning upstream's repository — never about using the editor — and because they were
  // the files this cleanup removed. Re-adding one has to be a deliberate decision.
  const banned = [
    "architecture.md", "contributing.md", "releasing.md", "testing.md", "gaps.md", "roadmap.md",
    "target-app-parity.md", "ui-parity.md", "file-format-parity.md", "hardware-parity.md",
    "localization-parity.md", "codec-parity.md", "type-parity.md", "effects-parity.md",
    "egui-037-migration-plan.md", "integration-20261030.md",
  ];
  const problems = [];
  for (const app of APPS) {
    const dir = skillDir(app);
    for (const file of walk(join(dir, "references"))) {
      const name = file.split(/[\\/]/).pop();
      if (banned.includes(name)) problems.push(`${app}: references/${relative(join(dir, "references"), file)}`);
    }
  }
  assert.deepEqual(problems, [], `upstream maintenance docs came back:\n${problems.join("\n")}`);
});

test("no skill ships documentation for a transport the web build does not have", () => {
  // The shipped site runs in a frame: no control server, no MCP, no CLI (ADR 0024). A doc
  // that explains those interfaces sends the model to an API it cannot call.
  const banned = ["control-protocol.md", "mcp.md", "cli.md", "cli-batch.md", "automation.md", "plugins.md"];
  const problems = [];
  for (const app of APPS) {
    const dir = skillDir(app);
    for (const file of walk(join(dir, "references"))) {
      const name = file.split(/[\\/]/).pop();
      if (banned.includes(name)) problems.push(`${app}: references/${relative(join(dir, "references"), file)}`);
    }
  }
  assert.deepEqual(problems, [], `docs for unreachable transports are back:\n${problems.join("\n")}`);
});

test("every skill stays small enough to be worth loading", () => {
  // A skill is read into a context that has to hold a working session. The deleted trees
  // ran to megabytes in three packages; this ceiling keeps a future copy-paste from
  // undoing it silently.
  const CEILING = 300 * 1024;
  const problems = [];
  for (const app of APPS) {
    const dir = skillDir(app);
    const bytes = walk(dir).reduce((sum, file) => sum + statSync(file).size, 0);
    if (bytes > CEILING) problems.push(`${app}: ${(bytes / 1024).toFixed(0)} KB`);
  }
  assert.deepEqual(problems, [], `skill package over ${CEILING / 1024} KB:\n${problems.join("\n")}`);
});
