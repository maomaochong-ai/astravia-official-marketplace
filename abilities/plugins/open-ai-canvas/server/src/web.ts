/**
 * 载荷 web-dist 静态托管（ADR-0008）
 *
 * 由 server/src/service.ts 按职责切出（ADR-0012）。
 */
import fs from "node:fs";
import path from "node:path";
import { WEB_DIST } from "./paths.ts";

export const WEB_MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".wasm": "application/wasm",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".pdf": "application/pdf",
};

export function webIndexPath() {
  return WEB_DIST ? path.join(WEB_DIST, "index.html") : null;
}

// 载荷里没有前端产物就等于装了个只有 API 的空壳。放在这里判而不是等用户撞见 404：
// 同一类决定 ADR-0004 已经做过一次——失败要在准备阶段就带 code 落到界面上。
export function hasWebBundle() {
  const index = webIndexPath();
  return Boolean(index) && fs.existsSync(index);
}

// 资源名里带内容哈希，可以长缓存；index.html 是入口，必须每次回源，否则更新后仍是旧壳。
export function webCacheControl(relativePath) {
  return /^\/assets\//.test(relativePath) ? "public, max-age=31536000, immutable" : "no-cache";
}

export function contentTypeOf(filePath) {
  return WEB_MIME[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

export function sendWebFile(req, res, filePath, relativePath) {
  let stat = null;
  try {
    stat = fs.statSync(filePath);
  } catch {
    stat = null;
  }
  if (!stat || !stat.isFile()) {
    sendWebNotFound(res, relativePath);
    return;
  }
  res.writeHead(200, {
    "Content-Type": contentTypeOf(filePath),
    "Content-Length": stat.size,
    "Cache-Control": webCacheControl(relativePath),
    "X-Content-Type-Options": "nosniff",
  });
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  const stream = fs.createReadStream(filePath);
  stream.on("error", () => res.destroy());
  stream.pipe(res);
}

export function sendWebNotFound(res, pathname) {
  if (res.headersSent) {
    res.destroy();
    return;
  }
  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
  res.end(`Not found: ${pathname}`);
}

// 与后端 static_site.go 的 resolve 保持同一套拒绝理由：反斜杠、NUL、越界一律不碰磁盘。
export function resolveWebAsset(pathname) {
  let decoded = "";
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return { file: null, relative: pathname, reason: "bad-path" };
  }
  if (decoded.includes("\u0000") || decoded.includes("\\")) {
    return { file: null, relative: pathname, reason: "bad-path" };
  }
  // 逐段检查 `..`：normalize 会把根之上的 `..` 静默吃掉，于是 `/assets/../../../etc`
  // 看起来只是一个普通路径，再被建导航规则回退成 index.html。想要的是明确拒绝。
  if (decoded.split(/[\\/]+/).some((segment) => segment === "..")) {
    return { file: null, relative: pathname, reason: "bad-path" };
  }
  const normalized = path.posix.normalize(decoded);
  if (normalized.includes("..")) {
    return { file: null, relative: pathname, reason: "bad-path" };
  }
  const root = path.resolve(WEB_DIST);
  const target = path.resolve(root, `.${normalized}`);
  if (target !== root && !target.startsWith(root + path.sep)) {
    return { file: null, relative: pathname, reason: "bad-path" };
  }
  const candidate = fs.existsSync(target) && fs.statSync(target).isDirectory() ? path.join(target, "index.html") : target;
  if (!fs.existsSync(candidate)) {
    return { file: null, relative: normalized, reason: "missing" };
  }
  return { file: candidate, relative: candidate === target ? normalized : `${normalized.replace(/\/$/, "")}/index.html` };
}

// 沿用上游 navigationRequest 的判定：Accept 里有 text/html 或路径没有扩展名都算导航。
// 两条都要保留——只按扩展名判会把不带 Accept 的直链打回 404，只按 Accept 判则会把
// 坏掉的 .js 当 HTML 喂给模块加载器。
export function isNavigationRequest(req, pathname) {
  const accept = String(req.headers.accept ?? "");
  if (accept.includes("text/html")) return true;
  return path.posix.extname(pathname) === "";
}

export function isApiPath(pathname) {
  return pathname === "/api" || pathname.startsWith("/api/");
}

// 返回 true 表示这个请求已经由静态层回答，调用方不要再往下透传。
export function serveWebAsset(req, res, pathname) {
  if (req.method !== "GET" && req.method !== "HEAD") return false;
  if (!hasWebBundle()) return false;

  const resolved = resolveWebAsset(pathname);
  if (resolved.reason === "bad-path") {
    sendWebNotFound(res, pathname);
    return true;
  }
  if (resolved.file) {
    sendWebFile(req, res, resolved.file, resolved.relative);
    return true;
  }
  if (isNavigationRequest(req, pathname)) {
    sendWebFile(req, res, webIndexPath(), "/index.html");
    return true;
  }
  sendWebNotFound(res, pathname);
  return true;
}
