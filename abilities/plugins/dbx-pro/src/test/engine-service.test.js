/**
 * 引擎服务端到端测试（headless）。
 *
 * 用子进程真起一个引擎进程（默认端口 0），从 stdout 的 `listening` 事件取回真实端口，
 * 再用 fetch 打真实 HTTP。被测入口默认是源码 `service/src/http-server.mjs`；
 * 想验证构建产物时用 DBX_ENGINE_ENTRY=service/main.mjs 覆盖。
 *
 * 覆盖：/health（免鉴权）、401、SELECT、多语句、写闸门（WRITE_BLOCKED /
 * DDL_BLOCKED / 确认文本不匹配）、/catalog、/describe、未知驱动、大整数归一化、
 * 零行结果集表头、文件不存在、--auth-disabled、SIGTERM 退出码。
 */

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const PLUGIN_ROOT = resolve(HERE, "..", "..");
const ENGINE_ENTRY =
  process.env.DBX_ENGINE_ENTRY ?? join(PLUGIN_ROOT, "service", "src", "http-server.mjs");
const TOKEN = "e2e-token-1234567890";

let workDir;
let dbFile;

function startEngine({ args = [], token = TOKEN } = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, [ENGINE_ENTRY, "--port", "0", ...args], {
      env: { ...process.env, ASTRAVIA_SERVICE_SECRET_ENGINE_KEY: token },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      rejectPromise(new Error(`引擎未在 15s 内就绪。stderr=${stderr}`));
    }, 15_000);
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      for (const line of stdout.split("\n")) {
        if (!line.trim().startsWith("{")) continue;
        let event;
        try {
          event = JSON.parse(line);
        } catch {
          continue;
        }
        if (event.event === "listening") {
          clearTimeout(timer);
          const baseUrl = `http://127.0.0.1:${event.port}`;
          resolvePromise({
            baseUrl,
            child,
            stop: () =>
              new Promise((done) => {
                // 幂等：末个用例已主动 stop() 过时子进程已退出，
                // 再挂 once("exit") 会永不作数（事件早已发过）→ 套件级 cancelledByParent。
                if (child.exitCode !== null || child.signalCode !== null) {
                  done(child.exitCode ?? 0);
                  return;
                }
                child.once("exit", (code) => done(code));
                child.kill("SIGTERM");
              }),
          });
        }
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      rejectPromise(error);
    });
  });
}

async function call(baseUrl, path, { method = "POST", body, token = TOKEN } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, ...(await response.json()) };
}

const connection = () => ({ dbType: "sqlite", name: "e2e", file: dbFile });
const query = (baseUrl, sql, extra = {}) =>
  call(baseUrl, "/query", { body: { connection: connection(), sql, ...extra } });

/** 起一次引擎并等它自己退出（用于验证 fail-closed 启动行为）。 */
function runEngineOnce({ args = [], token } = {}) {
  const env = { ...process.env };
  if (token === undefined || token === null) delete env.ASTRAVIA_SERVICE_SECRET_ENGINE_KEY;
  else env.ASTRAVIA_SERVICE_SECRET_ENGINE_KEY = token;
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, [ENGINE_ENTRY, "--port", "0", ...args], {
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      rejectPromise(new Error(`引擎未按预期退出。stdout=${stdout} stderr=${stderr}`));
    }, 15_000);
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      rejectPromise(error);
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      const events = stdout
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.startsWith("{"))
        .flatMap((line) => {
          try {
            return [JSON.parse(line)];
          } catch {
            return [];
          }
        });
      resolvePromise({ code, events, stderr });
    });
  });
}

describe("dbx-pro engine (headless E2E)", () => {
  let engine;

  before(async () => {
    workDir = mkdtempSync(join(tmpdir(), "dbx-engine-e2e-"));
    dbFile = join(workDir, "e2e.sqlite");
    writeFileSync(dbFile, "");
    engine = await startEngine();
  });

  after(async () => {
    await engine?.stop();
    rmSync(workDir, { recursive: true, force: true });
  });

  it("/health 免鉴权并如实列出驱动能力", async () => {
    const health = await call(engine.baseUrl, "/health", { method: "GET", token: null });
    assert.equal(health.status, 200);
    assert.equal(health.ok, true);
    assert.equal(health.data.auth, "enabled");
    const sqlite = health.data.drivers.find((driver) => driver.id === "sqlite");
    assert.equal(sqlite.ready, true);
    assert.equal(health.data.drivers.some((driver) => driver.id === "postgres" && driver.ready === false), true);
  });

  it("缺少令牌返回 401", async () => {
    const response = await query(engine.baseUrl, "SELECT 1", {});
    const unauthorized = await call(engine.baseUrl, "/query", {
      body: { connection: connection(), sql: "SELECT 1" },
      token: null,
    });
    assert.equal(unauthorized.status, 401);
    assert.equal(unauthorized.error.code, "UNAUTHORIZED");
    assert.equal(response.status, 200, "带令牌的同一请求应当成功");
  });

  it("单条 SELECT 返回列与行", async () => {
    const result = await query(engine.baseUrl, "SELECT 1 AS one");
    assert.equal(result.status, 200);
    assert.equal(result.data.statement_count, 1);
    assert.deepEqual(result.data.columns, ["one"]);
    assert.equal(result.data.rows[0].one, 1);
  });

  it("多语句按顺序执行，顶层镜像最后一条结果", async () => {
    const sql = "CREATE TABLE t (a INT, b TEXT); INSERT INTO t VALUES (1,'x'); SELECT a, b FROM t";
    const result = await query(engine.baseUrl, sql, { allowWrites: true, confirmedWriteSql: sql });
    assert.equal(result.status, 200);
    assert.equal(result.data.statement_count, 3);
    assert.deepEqual(result.data.statements.map((entry) => entry.kind), ["write", "write", "read"]);
    assert.deepEqual(result.data.columns, ["a", "b"]);
    assert.deepEqual(result.data.rows, [{ a: 1, b: "x" }]);
  });

  it("写语句默认被闸门拦下，且不产生副作用", async () => {
    const blocked = await query(engine.baseUrl, "INSERT INTO t VALUES (2,'y')");
    assert.equal(blocked.status, 403);
    assert.equal(blocked.error.code, "WRITE_BLOCKED");
    const verify = await query(engine.baseUrl, "SELECT count(*) AS n FROM t");
    assert.equal(verify.data.rows[0].n, 1);
  });

  it("DDL 需要写权限 + 与 SQL 完全一致的确认文本", async () => {
    const noWrites = await query(engine.baseUrl, "DROP TABLE t");
    assert.equal(noWrites.status, 403);
    assert.equal(noWrites.error.code, "DDL_BLOCKED");
    const noConfirm = await query(engine.baseUrl, "DROP TABLE t", { allowWrites: true });
    assert.equal(noConfirm.status, 403);
    assert.equal(noConfirm.error.code, "CONFIRM_MISMATCH");
    const mismatch = await query(engine.baseUrl, "DROP TABLE t", {
      allowWrites: true,
      confirmedWriteSql: "DROP TABLE t ",
    });
    assert.equal(mismatch.error.code, "CONFIRM_MISMATCH");
  });

  it("零行结果集仍返回表头", async () => {
    const result = await query(engine.baseUrl, "SELECT a, b FROM t WHERE 1 = 0");
    assert.equal(result.status, 200);
    assert.deepEqual(result.data.columns, ["a", "b"]);
    assert.deepEqual(result.data.rows, []);
  });

  it("/catalog 列出命名空间与对象", async () => {
    const result = await call(engine.baseUrl, "/catalog", { body: { connection: connection() } });
    assert.equal(result.status, 200);
    assert.equal(result.data.namespaces.some((namespace) => namespace.name === "main"), true);
    const table = result.data.objects.find((object) => object.name === "t");
    assert.equal(table.kind, "table");
    assert.equal(table.system, false);
  });

  it("/describe 返回列结构与建表 SQL", async () => {
    const result = await call(engine.baseUrl, "/describe", {
      body: { connection: connection(), target: { schema: "main", table: "t" } },
    });
    assert.equal(result.status, 200);
    assert.deepEqual(result.data.columns.map((column) => column.name), ["a", "b"]);
    assert.match(result.data.sql, /CREATE TABLE t/i);
  });

  it("字符串里的注释符是数据，不被判定层剥离（B1）", async () => {
    const literal = await query(engine.baseUrl, "SELECT 'a/*b*/c' AS v, 'd--e' AS w");
    assert.equal(literal.status, 200);
    assert.equal(literal.data.rows[0].v, "a/*b*/c");
    assert.equal(literal.data.rows[0].w, "d--e");

    const insert = await query(engine.baseUrl, "INSERT INTO t VALUES (3,'p/*q*/r')", { allowWrites: true });
    assert.equal(insert.status, 200);
    const readBack = await query(engine.baseUrl, "SELECT b FROM t WHERE a = 3");
    assert.equal(readBack.data.rows[0].b, "p/*q*/r", "写入内容不得被静默改坏");

    const semicolon = await query(engine.baseUrl, "SELECT 'a;b' AS v");
    assert.equal(semicolon.status, 200, "字符串里的分号不切开、也不应误判为写");
    assert.equal(semicolon.data.statement_count, 1);
    assert.equal(semicolon.data.rows[0].v, "a;b");
  });

  it("非数据库文件被拒绝，且引擎不会卡死（B2）", async () => {
    const bogus = join(workDir, "not-a-db.txt");
    writeFileSync(bogus, "this is definitely not a sqlite database\n");
    const badConnection = { dbType: "sqlite", name: "bogus", file: bogus };
    const rejectedTest = await call(engine.baseUrl, "/test", { body: { connection: badConnection } });
    assert.equal(rejectedTest.status, 502);
    assert.equal(rejectedTest.error.code, "CONNECTION_ERROR");
    const rejectedQuery = await call(engine.baseUrl, "/query", {
      body: { connection: badConnection, sql: "SELECT 1" },
    });
    assert.equal(rejectedQuery.status, 502);
    assert.equal(rejectedQuery.error.code, "CONNECTION_ERROR");
    const probe = await query(engine.baseUrl, "SELECT 1 AS one");
    assert.equal(probe.status, 200, "拒绝坏文件后引擎仍应可用（不得被同步 open 挂死）");
  });

  it("缺少引擎密钥时拒绝启动，不静默关闭鉴权（B3）", async () => {
    const missing = await runEngineOnce({ token: undefined });
    assert.equal(missing.code, 1);
    assert.equal(missing.events.some((event) => event.code === "NO_SECRET"), true);
    const blank = await runEngineOnce({ token: "" });
    assert.equal(blank.code, 1);
    assert.equal(blank.events.some((event) => event.code === "NO_SECRET"), true);
  });

  it("超大整数降级为十进制字符串，不抛 ERR_OUT_OF_RANGE", async () => {
    const result = await query(engine.baseUrl, "SELECT 9007199254740993 AS big");
    assert.equal(result.status, 200);
    assert.equal(result.data.rows[0].big, "9007199254740993");
  });

  it("未实现的驱动返回 501 而不是空结果", async () => {
    const result = await call(engine.baseUrl, "/query", {
      body: { connection: { dbType: "oracle", host: "h" }, sql: "SELECT 1" },
    });
    assert.equal(result.status, 501);
    assert.equal(result.error.code, "DRIVER_UNSUPPORTED");
  });

  it("库文件不存在时拒绝连接，不静默建库", async () => {
    const result = await call(engine.baseUrl, "/test", {
      body: { connection: { dbType: "sqlite", file: join(workDir, "missing.sqlite") } },
    });
    assert.equal(result.status, 502);
    assert.equal(result.error.code, "CONNECTION_ERROR");
  });

  it("--auth-disabled 时如实上报且放行", async () => {
    const plain = await startEngine({ args: ["--auth-disabled"], token: undefined });
    try {
      const health = await call(plain.baseUrl, "/health", { method: "GET", token: null });
      assert.equal(health.data.auth, "disabled");
      const result = await call(plain.baseUrl, "/query", {
        body: { connection: connection(), sql: "SELECT 1 AS one" },
        token: null,
      });
      assert.equal(result.status, 200);
    } finally {
      await plain.stop();
    }
  });

  it("SIGTERM 优雅退出，退出码 0", async () => {
    const code = await engine.stop();
    assert.equal(code, 0);
  });
});
