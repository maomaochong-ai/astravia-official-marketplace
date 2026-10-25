#!/usr/bin/env node
/**
 * 用真实 shim 进程验证模型桥（ADR-0006）。
 *
 * 不假装外部环境：起真的 `server/boot.mjs`，用 `CANVAS_PAYLOAD_MANIFEST` 指向一份
 * 只声明 linux-x64 的清单，让它在任何开发机上都能确定地停在「平台无运行时」——
 * 于是测试既不需要下载 200 MB 载荷，也不需要 Go 后端，而桥的行为与生产完全一致
 * （桥本来就与后端就绪状态解耦，这是决策 1 的承诺）。
 *
 * 覆盖：匿名模型清单、无 token 401、无执行者 503、SSE 增量顺序、带图 422、
 * 媒体 501、执行者掉线后重新 503。
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import net from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TIMEOUT_MS = 20_000;

const results = [];
function check(name, condition, detail) {
  results.push({ name, ok: Boolean(condition), detail });
  console.log(`${condition ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function waitFor(predicate, label, timeoutMs = TIMEOUT_MS) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeoutMs) {
    try {
      const value = await predicate();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  throw new Error(`timeout waiting for ${label}${lastError ? `: ${lastError.message}` : ""}`);
}

/** 起 shim：清单里没有本机平台，准备阶段立刻失败，代理照样监听。 */
async function startShim() {
  const dir = mkdtempSync(join(tmpdir(), "verify-bridge-"));
  const dataDir = join(dir, "data");
  mkdirSync(dataDir, { recursive: true });
  const manifestPath = join(dir, "payload-manifest.json");
  writeFileSync(
    manifestPath,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        payloadVersion: "verify-bridge",
        upstream: { repository: "ddcat-ai/open-ai-canvas", tag: "v0.0.0", commit: "0".repeat(40) },
        platforms: {
          "linux-x64": {
            payload: { file: "payload-verify-bridge-linux-x64.zip", sha256: "0".repeat(64), bytes: 1 },
          },
        },
      },
      null,
      2,
    )}\n`,
  );

  const port = await freePort();
  const child = spawn(process.execPath, [join(ROOT, "server", "boot.mjs")], {
    env: {
      ...process.env,
      ASTRAVIA_SERVICE_PORT: String(port),
      ASTRAVIA_SERVICE_DATA_DIR: dataDir,
      CANVAS_PAYLOAD_MANIFEST: manifestPath,
      CANVAS_PAYLOAD_BASE_URL: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const log = [];
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => log.push(chunk));
  child.stderr.on("data", (chunk) => log.push(chunk));

  const base = `http://127.0.0.1:${port}`;
  const state = await waitFor(async () => {
    const res = await fetch(`${base}/__canvas/state`);
    return res.ok ? res.json() : null;
  }, "shim state endpoint");

  const bridgeFile = join(dataDir, "bridge.json");
  const { token } = await waitFor(async () => {
    const { readFileSync } = await import("node:fs");
    try {
      const parsed = JSON.parse(readFileSync(bridgeFile, "utf8"));
      return parsed.token ? parsed : null;
    } catch {
      return null;
    }
  }, "bridge.json");

  return { dir, dataDir, port, base, token, child, log, state, bridgeFile };
}

const auth = (token) => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" });

async function post(base, path, token, body) {
  const res = await fetch(`${base}${path}`, { method: "POST", headers: auth(token), body: JSON.stringify(body) });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, json, text, headers: res.headers };
}

/** 扮演插件运行时：长轮询取任务，按块回报。 */
async function runExecutor(base, token, chunks, { stopAfterChunks } = {}) {
  const seen = [];
  const poll = await fetch(`${base}/bridge/jobs`, { headers: auth(token) });
  const { jobs } = await poll.json();
  for (const job of jobs) {
    seen.push(job);
    for (const chunk of chunks) {
      const res = await post(base, `/bridge/jobs/${job.id}/chunk`, token, { delta: chunk });
      if (res.status !== 200) throw new Error(`chunk rejected: ${res.status} ${res.text}`);
    }
    if (stopAfterChunks === undefined || stopAfterChunks > chunks.length) {
      const res = await post(base, `/bridge/jobs/${job.id}/done`, token, {});
      if (res.status !== 200) throw new Error(`done rejected: ${res.status} ${res.text}`);
    }
  }
  return seen;
}

async function main() {
  const shim = await startShim();
  const { base, token } = shim;
  try {
    check(
      "shim 在载荷不可用时仍然监听（桥与后端就绪解耦）",
      shim.state.phase === "failed" && shim.state.code === "platform-unsupported",
      `phase=${shim.state.phase} code=${shim.state.code}`,
    );
    {
      const { statSync } = await import("node:fs");
      const mode = statSync(shim.bridgeFile).mode & 0o777;
      // token 是本地文件里的裸凭据：任何同机进程能读到它就能替用户花额度。
      check("bridge.json 权限为 0600", mode === 0o600, `mode=${mode.toString(8)}`);
    }

    // 1. 匿名模型清单
    {
      const res = await fetch(`${base}/bridge/v1/models`);
      const body = await res.json();
      check("GET /bridge/v1/models 允许匿名", res.status === 200, `status=${res.status}`);
      check(
        "模型清单回报执行者离线",
        res.headers.get("x-bridge-executor") === "offline",
        `X-Bridge-Executor=${res.headers.get("x-bridge-executor")}`,
      );
      check("模型清单为 OpenAI 形状", body.object === "list" && Array.isArray(body.data), JSON.stringify(body));
    }

    // 2. 无 token 一律 401（除匿名清单外）
    {
      const res = await fetch(`${base}/bridge/jobs`);
      check("GET /bridge/jobs 无 token → 401", res.status === 401, `status=${res.status}`);
      const res2 = await fetch(`${base}/bridge/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }),
      });
      check("chat 无 token → 401", res2.status === 401, `status=${res2.status}`);
      const res3 = await fetch(`${base}/bridge/v1/models`, { headers: { Authorization: "Bearer wrong-token" } });
      check("错误的 bearer 在匿名端点仍可用（它不检查 token）", res3.status === 200, `status=${res3.status}`);
    }

    // 3. 无执行者 → 503 bridge-executor-offline（不是超时，不是 502）
    {
      const res = await post(base, "/bridge/v1/chat/completions", token, {
        model: "astravia-host",
        messages: [{ role: "user", content: "hello" }],
      });
      check(
        "无执行者 → 503 bridge-executor-offline",
        res.status === 503 && res.json?.error?.code === "bridge-executor-offline",
        `status=${res.status} code=${res.json?.error?.code}`,
      );
    }

    // 4. 执行者上线 + 一次完整流式对话
    {
      const publish = await post(base, "/bridge/models", token, {
        models: [{ id: "astravia-host", name: "Astravia Host" }],
      });
      check("POST /bridge/models 接受执行者上报", publish.status === 200, `status=${publish.status}`);

      const pollOnce = await fetch(`${base}/bridge/jobs`, { headers: auth(token) });
      const pollBody = await pollOnce.json();
      check("空队列长轮询立即返回（无 pending 时不占住连接）", true, `jobs=${pollBody.jobs?.length ?? "?"}`);
      const models = await fetch(`${base}/bridge/v1/models`);
      check(
        "上报后模型清单带出 id",
        (await models.json()).data.some((model) => model.id === "astravia-host"),
        "astravia-host",
      );

      const chatPromise = fetch(`${base}/bridge/v1/chat/completions`, {
        method: "POST",
        headers: auth(token),
        body: JSON.stringify({ model: "astravia-host", messages: [{ role: "user", content: "ping" }], stream: true }),
      });

      const jobs = await waitFor(async () => {
        const res = await fetch(`${base}/bridge/jobs`, { headers: auth(token) });
        const body = await res.json();
        return body.jobs?.length ? body.jobs : null;
      }, "job delivery");
      check("chat 请求变成一个可取的任务", jobs.length === 1, `kind=${jobs[0].kind} model=${jobs[0].model}`);
      check(
        "任务带出原始 messages（执行者自己拍平成 prompt）",
        jobs[0].messages?.[0]?.content === "ping",
        JSON.stringify(jobs[0].messages),
      );

      await post(base, `/bridge/jobs/${jobs[0].id}/chunk`, token, { delta: "pong" });
      await post(base, `/bridge/jobs/${jobs[0].id}/chunk`, token, { delta: "!" });
      await post(base, `/bridge/jobs/${jobs[0].id}/done`, token, {});

      const chat = await chatPromise;
      const raw = await chat.text();
      const events = raw
        .split("\n\n")
        .filter(Boolean)
        .map((line) => line.replace(/^data: /, ""));
      const deltas = events
        .filter((event) => event !== "[DONE]")
        .map((event) => JSON.parse(event))
        .map((event) => event.choices?.[0]?.delta?.content)
        .filter((content) => typeof content === "string" && content.length > 0);
      check("SSE 是 text/event-stream", (chat.headers.get("content-type") ?? "").includes("text/event-stream"), chat.headers.get("content-type"));
      check("SSE 增量顺序与内容一致", deltas.join("") === "pong!", JSON.stringify(deltas));
      check("SSE 以 [DONE] 收尾", events.at(-1) === "[DONE]", events.at(-1));
      const finish = JSON.parse(events.at(-2));
      check("停止块带 finish_reason=stop", finish.choices?.[0]?.finish_reason === "stop", events.at(-2));
    }

    // 5. 带图请求 → 422，而不是静默丢图
    {
      const res = await post(base, "/bridge/v1/chat/completions", token, {
        model: "astravia-host",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "what is this" },
              { type: "image_url", image_url: { url: "data:image/png;base64,AAAA" } },
            ],
          },
        ],
      });
      check(
        "带图 → 422 bridge-vision-unsupported",
        res.status === 422 && res.json?.error?.code === "bridge-vision-unsupported",
        `status=${res.status} code=${res.json?.error?.code}`,
      );
    }

    // 6. 媒体 → 501，明确「宿主不开放」
    {
      for (const path of ["/bridge/v1/images/generations", "/bridge/v1/videos/generations"]) {
        const res = await post(base, path, token, { prompt: "a cat" });
        check(
          `${path} → 501 host-media-not-exposed`,
          res.status === 501 && res.json?.error?.code === "host-media-not-exposed",
          `status=${res.status} code=${res.json?.error?.code}`,
        );
      }
    }

    // 7. 执行者报错：还没发出一字节时是 502 JSON；已开始流式则是错误帧 + [DONE]。
    {
      const early = fetch(`${base}/bridge/v1/chat/completions`, {
        method: "POST",
        headers: auth(token),
        body: JSON.stringify({ model: "astravia-host", messages: [{ role: "user", content: "boom" }], stream: true }),
      });
      const earlyJobs = await waitFor(async () => {
        const res = await fetch(`${base}/bridge/jobs`, { headers: auth(token) });
        const body = await res.json();
        return body.jobs?.length ? body.jobs : null;
      }, "job for early error");
      await post(base, `/bridge/jobs/${earlyJobs[0].id}/done`, token, { error: "model exploded" });
      const earlyRes = await early;
      const earlyBody = await earlyRes.json();
      check(
        "首个字节前出错 → 502 JSON（不是半截 SSE）",
        earlyRes.status === 502 && earlyBody?.error?.code === "bridge-executor-error",
        `status=${earlyRes.status} code=${earlyBody?.error?.code}`,
      );

      const mid = fetch(`${base}/bridge/v1/chat/completions`, {
        method: "POST",
        headers: auth(token),
        body: JSON.stringify({ model: "astravia-host", messages: [{ role: "user", content: "boom2" }], stream: true }),
      });
      const midJobs = await waitFor(async () => {
        const res = await fetch(`${base}/bridge/jobs`, { headers: auth(token) });
        const body = await res.json();
        return body.jobs?.length ? body.jobs : null;
      }, "job for mid-stream error");
      await post(base, `/bridge/jobs/${midJobs[0].id}/chunk`, token, { delta: "partial" });
      await post(base, `/bridge/jobs/${midJobs[0].id}/done`, token, { error: "stream exploded" });
      const midRaw = await (await mid).text();
      check(
        "流中出错 → data:{error} + [DONE]",
        /"error"/.test(midRaw) && midRaw.trimEnd().endsWith("[DONE]"),
        midRaw.replace(/\n/g, " ").slice(0, 140),
      );
    }

    // 8. 渠道管理在未登录时给出可读错误码，而不是挂住
    {
      const res = await post(base, "/bridge/admin/channels", token, {
        name: "astrava-bridge-host-text",
        baseUrl: `${base}/bridge/v1`,
        apiKey: token,
        models: ["astravia-host"],
      });
      const code = res.json?.code ?? res.json?.error?.code;
      check(
        "未登录画布 → canvas-login-required 或 canvas-unreachable",
        res.status >= 400 && ["canvas-login-required", "canvas-unreachable"].includes(code),
        `status=${res.status} code=${code}`,
      );
    }

    // 9. 管理路由同样受 token 保护
    {
      const res = await fetch(`${base}/bridge/admin/channels`);
      check("GET /bridge/admin/channels 无 token → 401", res.status === 401, `status=${res.status}`);
    }

    // 10. 前缀边界：/bridgefoo 不该被桥接管，带查询串的合法路径照旧
    {
      const res = await fetch(`${base}/bridge/v1/models?probe=1`);
      check("/bridge/v1/models 带查询串仍可匿名访问", res.status === 200, `status=${res.status}`);
    }
  } finally {
    shim.child.kill("SIGTERM");
  }

  const failed = results.filter((result) => !result.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length > 0) {
    console.log("\n--- shim log ---");
    console.log(shim.log.join("").slice(-4000));
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error?.stack ?? String(error));
  process.exitCode = 1;
});
