// Generated from src/service/*.ts by scripts/build-service.mjs - do not edit.

// src/service/main.ts
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

// src/service/docker.ts
import { execFile } from "node:child_process";
import { promisify } from "node:util";
var run = promisify(execFile);
async function docker(args, timeoutMs = 3e4) {
  try {
    const { stdout, stderr } = await run("docker", args, {
      timeout: timeoutMs,
      windowsHide: true,
      maxBuffer: 8 * 1024 * 1024
    });
    return { code: 0, stdout, stderr };
  } catch (error) {
    const failure = error;
    return {
      code: typeof failure.code === "number" ? failure.code : 1,
      stdout: failure.stdout ?? "",
      stderr: failure.stderr ?? failure.message ?? ""
    };
  }
}
async function dockerReady() {
  const result = await docker(["info", "--format", "{{.ServerVersion}}"], 2e4);
  if (result.code !== 0) {
    const first = (result.stderr || result.stdout).trim().split("\n")[0] ?? "";
    return { ready: false, detail: first || "docker daemon is not reachable" };
  }
  return { ready: true, detail: result.stdout.trim() };
}
async function imagePresent(image) {
  const result = await docker(["image", "inspect", image, "--format", "{{.Id}}"], 2e4);
  if (result.code === 0) return true;
  return /no such image|not found/i.test(result.stderr) ? false : null;
}
async function pullImage(image, onLog) {
  const result = await docker(["pull", image], 15 * 6e4);
  if (result.code !== 0 && onLog) onLog(result.stderr.trim().slice(-2e3));
  return result;
}
function runArgs(spec) {
  const args = ["run", "-d", "--name", spec.name];
  for (const mount of spec.mounts) {
    args.push("-v", `${mount.host}:/workspace/${mount.name}${mount.readOnly ? ":ro" : ""}`);
  }
  if (spec.network) args.push("--network", spec.network);
  args.push("--entrypoint", "sleep", spec.image, "infinity");
  return args;
}
var dockerApi = {
  run: (args, timeoutMs) => docker(args, timeoutMs),
  exec: (name, script, timeoutMs) => docker(["exec", "-i", name, "sh", "-c", script], timeoutMs),
  remove: (name) => docker(["rm", "-f", name], 6e4),
  inspect: (name) => docker(["inspect", "-f", "{{.State.Running}}", name], 15e3)
};

// src/service/findings.ts
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
var SEVERITIES = ["critical", "high", "medium", "low", "info"];
function dataDir() {
  const base = process.env.ASTRAVIA_SERVICE_DATA_DIR || join(homedir(), ".astravia", "plugin-data", "strix");
  return join(base, "findings");
}
function fileFor(sessionId2) {
  const safe = sessionId2.replace(/[^A-Za-z0-9_-]/g, "") || "default";
  return join(dataDir(), `${safe}.json`);
}
async function read(sessionId2) {
  try {
    const parsed = JSON.parse(await readFile(fileFor(sessionId2), "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
async function write(sessionId2, findings) {
  await mkdir(dataDir(), { recursive: true });
  await writeFile(fileFor(sessionId2), `${JSON.stringify(findings, null, 2)}
`, "utf8");
}
function tally(findings) {
  const counts = Object.fromEntries(SEVERITIES.map((name) => [name, 0]));
  for (const finding of findings) counts[finding.severity] = (counts[finding.severity] ?? 0) + 1;
  return counts;
}
function bySeverity(findings) {
  return [...findings].sort((left, right) => SEVERITIES.indexOf(left.severity) - SEVERITIES.indexOf(right.severity));
}
function normalizeSeverity(value) {
  const text = String(value ?? "").trim().toLowerCase();
  return SEVERITIES.includes(text) ? text : "info";
}
async function add(sessionId2, params) {
  const title = String(params.title ?? "").trim();
  if (!title) throw new Error("title is required");
  const raw = String(params.severity ?? "").trim().toLowerCase();
  if (!SEVERITIES.includes(raw)) {
    throw new Error(`severity must be one of ${SEVERITIES.join(", ")}`);
  }
  const finding = {
    id: String(params.id ?? Math.random().toString(16).slice(2, 10)),
    title,
    severity: raw,
    target: String(params.target ?? ""),
    description: String(params.description ?? ""),
    impact: String(params.impact ?? ""),
    technical_analysis: String(params.technicalAnalysis ?? ""),
    poc_description: String(params.poc ?? ""),
    remediation_steps: String(params.remediation ?? ""),
    evidence: String(params.evidence ?? ""),
    ...typeof params.cvss === "number" ? { cvss: params.cvss } : {},
    cwe: String(params.cwe ?? ""),
    cve: String(params.cve ?? ""),
    confidence: String(params.confidence ?? ""),
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  const findings = await read(sessionId2);
  findings.push(finding);
  await write(sessionId2, findings);
  return { finding, count: findings.length, bySeverity: tally(findings), findings: bySeverity(findings) };
}
async function list(sessionId2, params = {}) {
  const filter = params.severity ? normalizeSeverity(params.severity) : void 0;
  const findings = (await read(sessionId2)).filter((item) => filter ? item.severity === filter : true);
  const ordered = bySeverity(findings);
  return { count: ordered.length, bySeverity: tally(ordered), findings: ordered };
}
var SECTIONS = [
  ["Description", "description"],
  ["Impact", "impact"],
  ["Technical analysis", "technical_analysis"],
  ["Proof of concept", "poc_description"],
  ["Evidence", "evidence"],
  ["Remediation", "remediation_steps"]
];
function renderReport(findings, targets) {
  const ordered = bySeverity(findings);
  const counts = tally(ordered);
  const lines = ["# Penetration test report", ""];
  if (targets.length) lines.push("## Targets", "", ...targets.map((target) => `- ${target}`), "");
  lines.push(`## Findings (${ordered.length})`, "");
  const summary = SEVERITIES.filter((name) => counts[name] > 0).map((name) => `${name}: ${counts[name]}`).join(", ");
  if (summary) lines.push(summary, "");
  if (!ordered.length) lines.push("No findings were filed.");
  ordered.forEach((finding, index) => {
    lines.push(`### ${index + 1}. ${finding.title}`, "", `- Severity: **${finding.severity}**`);
    if (finding.target) lines.push(`- Target: \`${finding.target}\``);
    if (finding.cvss !== void 0) lines.push(`- CVSS: ${finding.cvss}`);
    for (const [label, key] of [
      ["CWE", "cwe"],
      ["CVE", "cve"],
      ["Confidence", "confidence"]
    ]) {
      const value = String(finding[key] ?? "");
      if (value) lines.push(`- ${label}: ${value}`);
    }
    lines.push("");
    for (const [label, key] of SECTIONS) {
      const value = String(finding[key] ?? "").trim();
      if (value) lines.push(`**${label}**`, "", value, "");
    }
  });
  return `${lines.join("\n").replace(/\n+$/, "")}
`;
}
async function report(sessionId2, params = {}) {
  const findings = await read(sessionId2);
  const targets = Array.isArray(params.targets) ? params.targets.map(String) : [];
  const markdown = renderReport(findings, targets);
  await mkdir(dataDir(), { recursive: true });
  const path = join(dataDir(), "report.md");
  await writeFile(path, markdown, "utf8");
  return { markdown, path, count: findings.length, bySeverity: tally(findings) };
}

// src/service/skills.ts
import { execFile as execFile2 } from "node:child_process";
import { readFile as readFile2, readdir } from "node:fs/promises";
import { basename, extname, join as join2 } from "node:path";
import { promisify as promisify2 } from "node:util";
var run2 = promisify2(execFile2);
var INTERNAL_CATEGORIES = /* @__PURE__ */ new Set(["scan_modes", "coordination", "analysis"]);
async function locateSkills(python = process.env.STRIX_PYTHON || "python") {
  const override = process.env.STRIX_SKILLS_DIR;
  if (override) return { root: override, source: "env" };
  for (const candidate of [python, "python3", "py"]) {
    const args = candidate === "py" ? ["-3", "-c"] : ["-c"];
    try {
      const { stdout } = await run2(
        candidate,
        [...args, "import os, strix; print(os.path.join(os.path.dirname(strix.__file__), 'skills'))"],
        { timeout: 2e4, windowsHide: true }
      );
      const root = stdout.trim();
      if (root) return { root, source: "python" };
    } catch {
    }
  }
  return void 0;
}
function parseFrontmatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!match) return { meta: {}, body: text.trim() };
  const meta = {};
  for (const line of (match[1] ?? "").split(/\r?\n/)) {
    const pair = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!pair) continue;
    const [, key, raw] = pair;
    if (!key) continue;
    meta[key] = (raw ?? "").replace(/^["']|["']$/g, "").trim();
  }
  return { meta, body: text.slice(match[0].length).trim() };
}
async function loadIndex(location) {
  const entries = [];
  let top = [];
  try {
    top = await readdir(location.root, { withFileTypes: true }).then(
      (items) => items.map((item) => `${item.isDirectory() ? "d:" : "f:"}${item.name}`)
    );
  } catch {
    return { entries, categories: [] };
  }
  const categories = /* @__PURE__ */ new Set();
  for (const item of top) {
    const isDir = item.startsWith("d:");
    const name = item.slice(2);
    if (name.startsWith("__") || name === "README.md") continue;
    if (!isDir) {
      if (extname(name) !== ".md") continue;
      const path = join2(location.root, name);
      entries.push(await describe(path, "root", basename(name, ".md")));
      categories.add("root");
      continue;
    }
    categories.add(name);
    const files = await readdir(join2(location.root, name)).catch(() => []);
    for (const file of files) {
      if (extname(file) !== ".md") continue;
      const path = join2(location.root, name, file);
      entries.push(await describe(path, name, basename(file, ".md")));
    }
  }
  return { entries, categories: [...categories].sort() };
}
async function describe(path, category, fallbackName) {
  let description = "";
  let name = fallbackName;
  try {
    const text = await readFile2(path, "utf8");
    const { meta } = parseFrontmatter(text);
    name = meta.name || fallbackName;
    description = (meta.description ?? "").replace(/\s+/g, " ").trim();
  } catch {
  }
  return { name, category, description, internal: INTERNAL_CATEGORIES.has(category), path };
}
async function loadBodies(location, names) {
  const { entries } = await loadIndex(location);
  const markdown = {};
  const missing = [];
  for (const requested of names) {
    const [maybeCategory, maybeName] = requested.includes("/") ? requested.split("/", 2) : [void 0, requested];
    const hit = entries.find(
      (entry) => (maybeCategory ? entry.category === maybeCategory : true) && (entry.name === maybeName || basename(entry.path, ".md") === maybeName)
    );
    if (!hit) {
      missing.push(requested);
      continue;
    }
    try {
      const text = await readFile2(hit.path, "utf8");
      markdown[hit.name] = parseFrontmatter(text).body;
    } catch {
      missing.push(requested);
    }
  }
  return { markdown, missing };
}

// src/service/sandbox.ts
import { join as join3 } from "node:path";
var NAME_PREFIX = "astravia-strix-";
var DEFAULT_IMAGE = "ghcr.io/usestrix/strix-sandbox:1.4.0";
function containerName(sessionId2) {
  return `${NAME_PREFIX}${dockerSafe(sessionId2).slice(0, 40) || "session"}`;
}
function dockerSafe(value) {
  return value.replace(/[^A-Za-z0-9_.-]/g, "").replace(/\.{2,}/g, ".").replace(/^[._-]+/, "");
}
function mountsFrom(inputs) {
  return inputs.filter((item) => Boolean(item.path?.trim())).map((item) => ({
    host: item.path.trim(),
    name: (item.subdir?.trim() || item.path.trim().split(/[\\/]/).filter(Boolean).pop() || "workspace").replace(
      /[^A-Za-z0-9_.-]/g,
      "-"
    ),
    readOnly: Boolean(item.readOnly)
  }));
}
function sandboxImage(env = process.env) {
  return env.STRIX_IMAGE?.trim() || DEFAULT_IMAGE;
}
var Sandbox = class {
  constructor(emit, dataDir2) {
    this.emit = emit;
    this.dataDir = dataDir2;
  }
  emit;
  dataDir;
  container = null;
  image = null;
  targets = [];
  startedAt = 0;
  sessionId = null;
  status() {
    return {
      running: Boolean(this.container),
      sessionId: this.sessionId,
      container: this.container,
      targets: this.targets,
      image: this.image,
      uptimeSec: this.container ? Math.round((Date.now() - this.startedAt) / 1e3) : 0,
      startedAt: this.container ? new Date(this.startedAt).toISOString() : null
    };
  }
  async start(params) {
    if (this.container) return this.status();
    const sessionId2 = String(params.sessionId ?? "").trim() || `s${Date.now().toString(36)}`;
    const container = containerName(sessionId2);
    const image = sandboxImage();
    const targets = Array.isArray(params.targets) ? params.targets.map(String).filter(Boolean) : [];
    const mounts = mountsFrom(Array.isArray(params.localSources) ? params.localSources : []);
    await dockerApi.remove(container);
    this.emit({ event: "sandbox_status", phase: "preparing image" });
    if (await imagePresent(image) === false) {
      this.emit({ event: "sandbox_status", phase: "pulling image" });
      const pulled = await pullImage(image);
      if (pulled.code !== 0) throw new Error(`pulling ${image} failed: ${pulled.stderr.trim().slice(-500)}`);
    }
    this.emit({ event: "sandbox_status", phase: "starting container" });
    const spec = { name: container, image, mounts };
    const started = await dockerApi.run(runArgs(spec), 3e5);
    if (started.code !== 0) throw new Error(`docker run failed: ${started.stderr.trim().slice(-500)}`);
    this.container = container;
    this.image = image;
    this.targets = targets;
    this.sessionId = sessionId2;
    this.startedAt = Date.now();
    const listing = await dockerApi.exec(container, `printf 'workspace:%s\\n' "$(ls -A /workspace | tr '\\n' ' ')"`, 3e4);
    this.emit({ event: "sandbox_ready", sessionId: sessionId2, status: this.status() });
    return { ...this.status(), ...listing.code === 0 ? {} : {} };
  }
  async exec(params) {
    if (!this.container) throw new Error("no sandbox session; call strix_sandbox_start first");
    const command = String(params.command ?? "").trim();
    if (!command) throw new Error("command is required");
    const workdir = String(params.workdir ?? "").trim();
    const timeoutSec = Math.min(Number(params.timeoutSec) || 300, 600);
    const script = workdir ? `cd ${quote(workdir)} && ${command}` : command;
    this.emit({ event: "tool_start", tool: "exec_command", command, workdir: workdir || null });
    const started = Date.now();
    const result = await dockerApi.exec(this.container, script, timeoutSec * 1e3);
    const durationMs = Date.now() - started;
    const ok = result.code === 0;
    this.emit({
      event: "tool_end",
      tool: "exec_command",
      command,
      ok,
      exitCode: result.code,
      durationMs,
      output: tail(result.stdout || result.stderr)
    });
    return {
      command,
      workdir: workdir || null,
      exitCode: result.code,
      ok,
      durationMs,
      stdout: clip(result.stdout),
      stderr: clip(result.stderr)
    };
  }
  async stop() {
    if (!this.container) return { stopped: false };
    const sessionId2 = this.sessionId ?? void 0;
    await dockerApi.remove(this.container);
    this.container = null;
    this.startedAt = 0;
    this.emit({ event: "sandbox_stopped", sessionId: sessionId2 });
    return { stopped: true, sessionId: sessionId2 };
  }
  /** Extra directories are mounted read-only by default; this is only for the log line. */
  get mountRoot() {
    return join3(this.dataDir, "mounts");
  }
};
function quote(value) {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}
var MAX_TEXT = 4e4;
function clip(text) {
  if (text.length <= MAX_TEXT) return text;
  return `${text.slice(0, MAX_TEXT)}
[... ${text.length - MAX_TEXT} chars truncated; write output to a file and read it in pieces ...]`;
}
function tail(text, lines = 8, chars = 600) {
  const kept = text.trim().split(/\r?\n/).filter((line) => line.trim());
  return kept.slice(-lines).join("\n").slice(-chars);
}

// src/service/main.ts
var PORT = Number(process.env.ASTRAVIA_SERVICE_PORT || 0);
var HOST = process.env.STRIX_BRIDGE_HOST || "127.0.0.1";
var DATA_DIR = process.env.ASTRAVIA_SERVICE_DATA_DIR || "";
var log = [];
var subscribers = /* @__PURE__ */ new Set();
function record(payload) {
  log.push(payload);
  if (log.length > 400) log.shift();
  for (const send of subscribers) send(payload);
}
var sandbox = new Sandbox(record, DATA_DIR);
var version = "0.0.0";
try {
  version = (await import("node:fs")).readFileSync(new URL("../.runtime.json", import.meta.url), "utf8") ? JSON.parse((await import("node:fs/promises")).then ? "{}" : "{}") : "0.0.0";
} catch {
  version = "0.0.0";
}
async function environment() {
  const [docker2, image] = await Promise.all([dockerReady(), imagePresent(sandboxImage())]);
  const skills = await locateSkills();
  return {
    docker: { ready: docker2.ready, detail: docker2.detail, image: sandboxImage(), imagePresent: image },
    engine: {
      // "installed" here means the skill library is reachable, which is all the
      // plugin needs now: the container carries the tools.
      installed: Boolean(skills),
      detail: skills ? skills.root : "strix-agent is not installed in any Python on PATH"
    },
    skills: skills ? { root: skills.root, source: skills.source } : null,
    ready: docker2.ready && Boolean(skills)
  };
}
var TOOLS = [
  {
    name: "strix_environment",
    description: "Check whether this machine can run Strix tooling: the Docker sandbox and the Strix skill library. Call this before your first sandbox command.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    handler: () => environment()
  },
  {
    name: "strix_sandbox_start",
    description: "Start a Strix sandbox container for this assessment. It carries the full pentest toolchain: nmap, nuclei, ffuf, sqlmap, subfinder, naabu, Caido, agent-browser + chromium, trivy, gitleaks, trufflehog, jwt_tool. Local directories are mounted at /workspace/<name>. Start one session per assessment and keep using it.",
    inputSchema: {
      type: "object",
      properties: {
        targets: {
          type: "array",
          items: { type: "string" },
          description: "URLs, domains, IPs or repository URLs you are authorised to test."
        },
        localSources: {
          type: "array",
          description: "Host directories to expose inside the sandbox workspace.",
          items: {
            type: "object",
            properties: {
              path: { type: "string" },
              subdir: { type: "string" },
              readOnly: { type: "boolean" }
            },
            required: ["path"],
            additionalProperties: false
          }
        },
        sessionId: { type: "string" }
      },
      additionalProperties: false
    },
    handler: (args) => sandbox.start(args)
  },
  {
    name: "strix_exec",
    description: "Run a shell command inside the Strix sandbox and return stdout, stderr and the exit code. Use it to drive the bundled toolchain, write scripts under /workspace and read their output. Commands are capped at 10 minutes: for anything longer, launch it in the background and poll with another call.",
    inputSchema: {
      type: "object",
      properties: {
        command: { type: "string", description: "Shell command, run with `sh -c`." },
        workdir: { type: "string", description: "Working directory inside the sandbox, e.g. /workspace/repo." },
        timeoutSec: { type: "number" }
      },
      required: ["command"],
      additionalProperties: false
    },
    handler: (args) => sandbox.exec(args)
  },
  {
    name: "strix_sandbox_status",
    description: "Current sandbox session: running, its targets, image and uptime.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    handler: async () => sandbox.status()
  },
  {
    name: "strix_sandbox_stop",
    description: "Stop and remove the sandbox container. Call it when the assessment is finished.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    handler: () => sandbox.stop()
  },
  {
    name: "strix_list_skills",
    description: "List Strix's security knowledge packs, from the installed engine. Each entry has a name, a category and a one-line description.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    handler: async () => {
      const skills = await locateSkills();
      if (!skills) throw new Error("strix-agent is not installed; the skill library lives inside it");
      const { entries, categories } = await loadIndex(skills);
      return {
        root: skills.root,
        categories,
        total: entries.length,
        skills: entries.map(({ name, category, description, internal }) => ({
          name,
          category,
          description,
          internal
        }))
      };
    }
  },
  {
    name: "strix_load_skills",
    description: "Load the full Markdown of one or more skills, by name or category/name. Load the skills that match the target before testing: they carry the technique, the payloads and the false-positive rules for that class of issue.",
    inputSchema: {
      type: "object",
      properties: { names: { type: "array", items: { type: "string" }, minItems: 1 } },
      required: ["names"],
      additionalProperties: false
    },
    handler: async (args) => {
      const skills = await locateSkills();
      if (!skills) throw new Error("strix-agent is not installed; the skill library lives inside it");
      return loadBodies(skills, args.names ?? []);
    }
  },
  {
    name: "strix_file_finding",
    description: "Record a confirmed vulnerability. File one only with evidence you actually produced - a request/response, a payload and its effect, or a code path. Include cvss and cwe when you know them, and put the reproduction in `poc`.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        severity: { type: "string", enum: [...SEVERITIES] },
        target: { type: "string" },
        description: { type: "string" },
        impact: { type: "string" },
        technicalAnalysis: { type: "string" },
        poc: { type: "string" },
        evidence: { type: "string" },
        remediation: { type: "string" },
        cvss: { type: "number" },
        cwe: { type: "string" },
        cve: { type: "string" },
        confidence: { type: "string", enum: ["high", "medium", "low"] }
      },
      required: ["title", "severity"],
      additionalProperties: false
    },
    handler: (args) => add(sessionId(), args)
  },
  {
    name: "strix_list_findings",
    description: "Findings filed so far, ordered by severity, with a per-severity tally.",
    inputSchema: {
      type: "object",
      properties: { severity: { type: "string", enum: [...SEVERITIES] } },
      additionalProperties: false
    },
    handler: (args) => list(sessionId(), args)
  },
  {
    name: "strix_report",
    description: "Render the Markdown penetration-test report from the findings filed so far.",
    inputSchema: {
      type: "object",
      properties: { targets: { type: "array", items: { type: "string" } } },
      additionalProperties: false
    },
    handler: (args) => report(sessionId(), args)
  }
];
function sessionId() {
  return sandbox.status().sessionId ?? "default";
}
async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return {};
  }
}
function json(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}
async function handleMcp(req, res) {
  const body = await readBody(req);
  const id = body.id ?? null;
  const reply = (result) => json(res, 200, { jsonrpc: "2.0", id, result });
  const fail = (code, message) => json(res, 200, { jsonrpc: "2.0", id, error: { code, message } });
  switch (body.method) {
    case "initialize":
      return reply({
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "strix", version }
      });
    case "notifications/initialized":
      res.writeHead(202).end();
      return;
    case "tools/list":
      return reply({
        tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }))
      });
    case "tools/call": {
      const params = body.params ?? {};
      const tool = TOOLS.find((item) => item.name === params.name);
      if (!tool) return fail(-32601, `unknown tool: ${params.name}`);
      try {
        const result = await tool.handler(params.arguments ?? {});
        return reply({ content: [{ type: "text", text: JSON.stringify(result, null, 2) }] });
      } catch (error) {
        return reply({
          isError: true,
          content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }]
        });
      }
    }
    default:
      return fail(-32601, `unsupported method: ${String(body.method)}`);
  }
}
var server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${HOST}:${PORT || 80}`);
  try {
    if (url.pathname === "/api/health/ready") {
      return json(res, 200, { ready: true, version });
    }
    if (url.pathname === "/mcp" && req.method === "POST") return await handleMcp(req, res);
    if (url.pathname === "/api/state") {
      const [env, list2] = await Promise.all([
        environment().catch((error) => ({ error: String(error) })),
        list(sessionId()).catch(() => ({ count: 0, bySeverity: {}, findings: [] }))
      ]);
      return json(res, 200, {
        environment: env,
        sandbox: sandbox.status(),
        findings: list2.findings ?? [],
        logTail: log.slice(-40)
      });
    }
    if (url.pathname === "/api/report") {
      return json(res, 200, await report(sessionId(), {}));
    }
    if (url.pathname === "/api/sandbox/stop" && req.method === "POST") {
      return json(res, 200, await sandbox.stop());
    }
    if (url.pathname === "/api/log") {
      return json(res, 200, { log });
    }
    if (url.pathname === "/api/events") {
      res.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive"
      });
      const send = (payload) => res.write(`data: ${JSON.stringify(payload)}

`);
      for (const line of log) send(line);
      subscribers.add(send);
      const heartbeat = setInterval(() => res.write(": ping\n\n"), 15e3);
      req.on("close", () => {
        clearInterval(heartbeat);
        subscribers.delete(send);
      });
      return;
    }
    return json(res, 404, { error: `no route for ${url.pathname}` });
  } catch (error) {
    return json(res, 500, { error: error instanceof Error ? error.message : String(error) });
  }
});
server.listen(PORT, HOST, () => {
  record({ event: "service_listening", host: HOST, port: PORT, id: randomUUID() });
});
var shutdown = () => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref();
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
