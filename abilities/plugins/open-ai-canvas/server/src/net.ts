/**
 * 代理探测、TLS/隧道 socket、HTTP 客户端与分片文件尺寸
 *
 * 由 server/src/service.ts 按职责切出（ADR-0012）。
 */
import http from "node:http";
import https from "node:https";
import net from "node:net";
import tls from "node:tls";
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { PassThrough } from "node:stream";

// 响应流被挂了三个元信息（状态码、头、已读字节），destroy/push 也被增强过。
// 这就是 JS 里「给流对象加属性」的写法，这里把它写成类型，调用方不用逐处断言。
export type Sink = PassThrough & {
  statusCode: number;
  headers: Record<string, string | undefined>;
  bytesRead: number;
};
import { BINARY_NAME } from "./config.ts";
import { note } from "./state.ts";

export function hasPayload(dir) {
  try {
    return fs.statSync(path.join(dir, BINARY_NAME)).isFile();
  } catch {
    return false;
  }
}

// ZIP 解包与摘要见 ./archive.ts（ADR-0012：单 bundle、按职责分文件）。

// 宿主不向插件进程注入任何代理变量。实测直连 github.com:443 会在 30 秒连接超时后失败，
// 而本机系统代理是通的：所以这里自己探测系统代理并走 CONNECT 隧道，探测不到或隧道不可用
// 时回退直连，行为与旧版一致。CANVAS_PAYLOAD_BASE_URL 指向本地 http 源（离线自测）时直连。
export const DOWNLOAD_CHUNKS = 8;
export const CHUNK_ATTEMPTS = 3;
export const PLUGIN_USER_AGENT = "open-ai-canvas-plugin";
export const REDIRECT_CODES = [301, 302, 303, 307, 308];

export function parseProxySpec(value) {
  if (!value) return null;
  try {
    const url = new URL(value.includes("://") ? value : `http://${value}`);
    const port = Number(url.port) || 8080;
    return url.hostname && port ? { host: url.hostname, port } : null;
  } catch {
    return null;
  }
}

// macOS 的代理只存在于 scutil，Windows 在注册表，Linux 一般只有环境变量。
export function detectSystemProxy() {
  const fromEnv =
    parseProxySpec(process.env.HTTPS_PROXY) ||
    parseProxySpec(process.env.https_proxy) ||
    parseProxySpec(process.env.HTTP_PROXY) ||
    parseProxySpec(process.env.http_proxy) ||
    parseProxySpec(process.env.ALL_PROXY) ||
    parseProxySpec(process.env.all_proxy);
  if (fromEnv) return { ...fromEnv, source: "env" };

  if (process.platform === "darwin") {
    try {
      const out = execFileSync("scutil", ["--proxy"], { encoding: "utf8", timeout: 3000 });
      const host = /HTTPSProxy\s*:\s*(\S+)/.exec(out)?.[1];
      const port = Number(/HTTPSPort\s*:\s*(\d+)/.exec(out)?.[1] || 0);
      if (/HTTPSEnable\s*:\s*1/.test(out) && host && port) return { host, port, source: "scutil" };
    } catch {
      /* 没有 scutil 或超时：当作无代理 */
    }
  }

  if (process.platform === "win32") {
    try {
      const key = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings";
      const out = execFileSync("reg", ["query", key], { encoding: "utf8", timeout: 3000 });
      if (/ProxyEnable\s+REG_DWORD\s+0x1/.test(out)) {
        const server = /ProxyServer\s+REG_SZ\s+(\S+)/.exec(out)?.[1] || "";
        const parsed = parseProxySpec(/https=([^;\s]+)/.exec(server)?.[1] || server);
        if (parsed) return { ...parsed, source: "registry" };
      }
    } catch {
      /* 读不到注册表就直连 */
    }
  }

  return null;
}

export let PROXY_RESOLVED = false;
export let ACTIVE_PROXY = null;

export function systemProxy() {
  if (!PROXY_RESOLVED) {
    PROXY_RESOLVED = true;
    ACTIVE_PROXY = detectSystemProxy();
    if (ACTIVE_PROXY) note(`检测到系统代理 ${ACTIVE_PROXY.host}:${ACTIVE_PROXY.port}（来源 ${ACTIVE_PROXY.source}）`);
    else note("未检测到系统代理，下载直连");
  }
  return ACTIVE_PROXY;
}

export function dropProxy(reason) {
  if (!ACTIVE_PROXY) return;
  note(`系统代理不可用（${reason}），改为直连`);
  ACTIVE_PROXY = null;
}

export function connectDirect(hostname: string, port: number, isTls: boolean): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const socket = isTls
      ? tls.connect({ host: hostname, port, servername: hostname, ALPNProtocols: ["http/1.1"] })
      : net.connect({ host: hostname, port });
    // 12 秒足够完成 DNS + TCP + TLS；不可达的域名不应该让首启页面干等 20 秒。
    socket.setTimeout(12000, () => socket.destroy(new Error("连接超时")));
    socket.once(isTls ? "secureConnect" : "connect", () => resolve(socket));
    socket.once("error", reject);
  });
}

export function connectTunnel(proxy: any, hostname: string, port: number): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: proxy.host,
      port: proxy.port,
      method: "CONNECT",
      path: `${hostname}:${port}`,
      timeout: 12000,
    });
    req.on("connect", (res, socket, head) => {
      if (res.statusCode !== 200) {
        socket.destroy();
        dropProxy(`CONNECT ${res.statusCode}`);
        reject(new Error(`代理 CONNECT ${res.statusCode}`));
        return;
      }
      if (head && head.length) socket.unshift(head);
      const secure = tls.connect({ socket, servername: hostname, ALPNProtocols: ["http/1.1"] });
      secure.setTimeout(20000, () => secure.destroy(new Error("TLS 握手超时")));
      secure.once("secureConnect", () => resolve(secure));
      secure.once("error", reject);
    });
    req.on("timeout", () => {
      req.destroy();
      dropProxy("连接超时");
      reject(new Error("代理连接超时"));
    });
    req.on("error", (err) => {
      dropProxy(err.message);
      reject(err);
    });
    req.end();
  });
}

export function openSocket(hostname: string, port: number, isTls: boolean): Promise<net.Socket> {
  const proxy = isTls ? systemProxy() : null;
  return proxy ? connectTunnel(proxy, hostname, port) : connectDirect(hostname, port, isTls);
}

// 读到 \\r\\n\\r\\n 为止（含），返回 { statusCode, headers, rest }。
export function readHead(
  socket: net.Socket,
): Promise<{ statusCode: number; headers: Record<string, string>; rest: Buffer }> {
  return new Promise((resolve, reject) => {
    let buffer = Buffer.alloc(0);
    const finish = () => {
      const end = buffer.indexOf("\r\n\r\n");
      if (end === -1) {
        if (buffer.length > 65536) reject(new Error("响应头过长"));
        return false;
      }
      const lines = buffer.subarray(0, end).toString("latin1").split("\r\n");
      const status = Number(/^HTTP\/\d(?:\.\d)?\s+(\d{3})/.exec(lines[0])?.[1] || 0);
      const headers = {};
      for (const line of lines.slice(1)) {
        const at = line.indexOf(":");
        if (at > 0) headers[line.slice(0, at).trim().toLowerCase()] = line.slice(at + 1).trim();
      }
      cleanup();
      resolve({ statusCode: status, headers, rest: buffer.subarray(end + 4) });
      return true;
    };
    const onData = (chunk) => {
      buffer = buffer.length ? Buffer.concat([buffer, chunk]) : chunk;
      finish();
    };
    const onError = (err) => {
      cleanup();
      reject(err);
    };
    const cleanup = () => {
      socket.off("data", onData);
      socket.off("error", onError);
    };
    socket.on("data", onData);
    socket.on("error", onError);
  });
}

// 把响应体泵进一个 PassThrough，并让它的 destroy() 连带断开底层 socket。
export function pumpBody(
  socket: net.Socket,
  head: { statusCode: number; headers: Record<string, string>; rest: Buffer },
): Sink {
  const body = new PassThrough() as Sink;
  const originalDestroy = body.destroy.bind(body);
  body.statusCode = head.statusCode;
  body.headers = head.headers;
  body.bytesRead = 0;
  body.destroy = (err) => {
    socket.destroy();
    originalDestroy(err);
    return body;
  };
  // 计数不能靠 body.on("data")：那会把 PassThrough 切到 flowing 模式，在读正文的调用方
  // 挂上监听之前就把前几块冲掉（API 返回的 JSON 就是这么被截头导致解析失败的）。
  const originalPush = body.push.bind(body);
  body.push = (chunk, encoding) => {
    if (chunk) body.bytesRead += chunk.length;
    return originalPush(chunk, encoding);
  };

  let finished = false;
  const done = () => {
    if (finished) return;
    finished = true;
    body.end();
    socket.destroy();
  };
  socket.on("close", () => {
    if (finished) return;
    finished = true;
    // 只在「声明了长度却没读满」时算中断；无长度响应以读到 EOF 为准，不是异常。
    if (Number.isFinite(declared) && body.bytesRead < declared) body.emit("aborted");
    body.end();
  });
  socket.on("error", () => {
    if (finished) return;
    finished = true;
    body.destroy();
  });

  const declared = Number(head.headers["content-length"]);
  const chunked = /chunked/i.test(head.headers["transfer-encoding"] || "");

  if (chunked) {
    let buffer = head.rest;
    let remaining = null;
    socket.on("data", (chunk) => {
      buffer = buffer.length ? Buffer.concat([buffer, chunk]) : chunk;
      for (;;) {
        if (remaining === null) {
          const lineEnd = buffer.indexOf("\r\n");
          if (lineEnd === -1) return;
          const size = parseInt(buffer.subarray(0, lineEnd).toString("latin1").split(";")[0], 16);
          buffer = buffer.subarray(lineEnd + 2);
          if (!Number.isFinite(size)) {
            body.emit("aborted");
            done();
            return;
          }
          if (size === 0) {
            done();
            return;
          }
          remaining = size;
        }
        if (buffer.length < remaining + 2) return;
        body.write(buffer.subarray(0, remaining));
        buffer = buffer.subarray(remaining + 2);
        remaining = null;
      }
    });
    return body;
  }

  if (Number.isFinite(declared) && declared >= 0) {
    let sent = 0;
    const push = (chunk) => {
      if (finished) return;
      const room = declared - sent;
      if (room <= 0) return;
      const slice = chunk.length > room ? chunk.subarray(0, room) : chunk;
      sent += slice.length;
      if (!body.write(slice)) socket.pause();
      if (sent >= declared) done();
    };
    body.on("drain", () => socket.resume());
    if (head.rest.length) push(head.rest);
    socket.on("data", push);
    return body;
  }

  // 没有长度也没有分块：读到哪里算哪里。
  if (head.rest.length) body.write(head.rest);
  body.on("drain", () => socket.resume());
  socket.on("data", (chunk) => {
    if (finished) return;
    if (!body.write(chunk)) socket.pause();
  });
  return body;
}

// 一次请求：负责建连、写请求行、解析响应头，返回带 statusCode/headers 的可读流。
export async function requestStream(
  url: string,
  { headers = {}, timeout = 45000 }: { headers?: Record<string, string>; timeout?: number } = {},
): Promise<Sink> {
  const target = new URL(url);
  const isTls = target.protocol !== "http:";
  const port = Number(target.port) || (isTls ? 443 : 80);
  const socket = await openSocket(target.hostname, port, isTls);
  const merged = {
    Host: target.host,
    "User-Agent": PLUGIN_USER_AGENT,
    Accept: "*/*",
    "Accept-Encoding": "identity",
    Connection: "close",
    ...headers,
  };
  const lines = [`GET ${target.pathname}${target.search} HTTP/1.1`];
  for (const [key, value] of Object.entries(merged)) lines.push(`${key}: ${value}`);
  socket.write(`${lines.join("\r\n")}\r\n\r\n`);

  let timer;
  const guard = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`请求超时（${timeout} ms）`));
    }, timeout);
  });
  try {
    const head = await Promise.race([readHead(socket), guard]);
    return pumpBody(socket, head);
  } finally {
    clearTimeout(timer);
  }
}

// 旧签名保留：调用方只关心状态码、头和可读流。
export async function httpRequest(url, { headers = {}, redirects = 5, timeout = 60000 } = {}) {
  let current = url;
  let response = await requestStream(current, { headers, timeout });
  for (let hop = 0; hop < redirects; hop += 1) {
    const location = response.headers.location;
    if (!REDIRECT_CODES.includes(response.statusCode) || !location) break;
    response.destroy();
    current = new URL(location, current).toString();
    response = await requestStream(current, { headers, timeout });
  }
  return response;
}

// 取载荷总字节：HEAD 会被 GitHub 的下载跳转丢掉，用 1 字节 Range 读 Content-Range 更可靠。
// 只试两次、每次 10 秒：下载源不可达时要尽快失败并给出可读提示，不能让人对着 0% 干等。
export async function payloadSize(url, { attempts = 2, timeout = 10000 } = {}) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const res = await httpRequest(url, {
        headers: { Range: "bytes=0-0", Accept: "application/octet-stream" },
        timeout,
      });
      const total = /\/(\d+)$/.exec(res.headers["content-range"] || "");
      const length = Number(res.headers["content-length"]) || 0;
      const status = res.statusCode;
      res.destroy();
      if (total) return Number(total[1]);
      if (status === 200 && length > 0) return length;
    } catch {
      /* 继续重试 */
    }
    await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
  }
  return 0;
}

export function partPath(archive, index) {
  return `${archive}.part${index}`;
}

export function statSize(file) {
  try {
    return fs.statSync(file).size;
  } catch {
    return 0;
  }
}

export function partsBytes(archive, count) {
  let total = 0;
  for (let index = 0; index < count; index += 1) total += statSize(partPath(archive, index));
  return total;
}

// 每个分片写进自己的 .partN 文件：进程被杀、宿主重启、连接断掉都能从已有字节接着取。
// 旧实现把八个分片写进同一个 filehandle，并且失败时删整个归档，续传收益会被路径本身抵消。
//
// 2026-10-26：线上出现过 87.8%（显示 88%）永久不动。evidence 是 data/runtime 里
// part4 停在 401336 字节而其余七个分片都满，说明有一个 downloadChunk 的 Promise
// 永不 settle：等的是 sink 的 finish，但底层的 drain/error 一个都没来。看门狗当时只
// 去 destroy(response)，靠错误沿流传播到 Promise —— 传播断一次就永远醒不来。
// 现在每次读进度都重置一个定时器，它直接 reject 这个 Promise，不依赖流的事件链；
// 并且 transfer 层还有总截止时间，保证不会出现「一个分片卡住，全盘无提示」。
