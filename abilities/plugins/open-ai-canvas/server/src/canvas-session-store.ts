/**
 * 会话令牌加密落盘与读取
 *
 * 由 server/src/boot.ts 按职责切出（ADR-0012）。
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./service-config.ts";

// --- session 存储 ---
// ADR-0002 决策 4：登录令牌必须加密落盘。密钥来自宿主自己的服务凭据机制——
// `plugin.json#providers.services[0].credentials` 由宿主生成并持久化在 service-secrets.json，
// 再以 `${ASTRAVIA_SERVICE_SECRET_SESSION_KEY}` 注入（ADR-0003 决策 7 的那套模板替换）。
// 不随包发固定常量：写死在源码里的密钥等于没加密。
// 没有密钥时（手工直跑 shim、验证脚本）退回 0600 明文，并在 /__canvas/state 里标出 storage，
// 免得「看起来加密了」变成默认假设。
export const SESSION_FILE = path.join(DATA_DIR, "session.json");
export const SESSION_KEY = (() => {
  const raw = process.env.ASTRAVIA_SERVICE_SECRET_SESSION_KEY;
  if (!raw) return null;
  try {
    const key = Buffer.from(raw, "base64url");
    // AES-256 只接受 32 字节；长度不对时宁可退回明文也不要半吊子加密。
    return key.length === 32 ? key : null;
  } catch {
    return null;
  }
})();

export function sealSession(token) {
  if (!SESSION_KEY) return JSON.stringify({ v: 1, token });
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", SESSION_KEY, iv);
  const data = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return JSON.stringify({
    v: 2,
    alg: "aes-256-gcm",
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: data.toString("base64"),
  });
}

export function openSession(raw) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  // v1 是加密之前的明文格式：仍要能读，否则老用户升级后要重新登录。
  if (typeof data?.token === "string") return data.token;
  if (data?.v !== 2 || !SESSION_KEY) return null;
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", SESSION_KEY, Buffer.from(data.iv, "base64"));
    decipher.setAuthTag(Buffer.from(data.tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(data.data, "base64")), decipher.final()]).toString("utf8");
  } catch (err) {
    // 换了密钥（宿主重置了 service-secrets）或文件被改坏，都到这里：当作没有会话。
    console.error("[open-ai-canvas] Failed to decrypt session:", err.message);
    return null;
  }
}

export function loadSession() {
  try {
    const token = openSession(fs.readFileSync(SESSION_FILE, "utf8"));
    // 有密钥又读到明文旧文件时顺手升级，避免两种格式长期并存。
    if (token && SESSION_KEY) saveSession(token);
    return token;
  } catch {
    return null;
  }
}

export function saveSession(token) {
  try {
    fs.writeFileSync(SESSION_FILE, sealSession(token), { mode: 0o600 });
  } catch (err) {
    console.error("[open-ai-canvas] Failed to save session:", err.message);
  }
}

export let SESSION_TOKEN = loadSession();

// mcp.ts（工具调用 401 后清空）与 origin.ts（登录响应捕获）都要改它，而 import 绑定只读。
export function setSessionToken(token: string | null): void {
  SESSION_TOKEN = token;
}


// --- Go 后端环境变量与启动 ---
// `/api` 上的跨源白名单只有这几项：页面来源是 PUBLIC_ORIGIN，插件侧探针走宿主端口。
// `localhost` 与 `127.0.0.1` 是两个不同的 origin，两个都得给（ADR-0010）。
