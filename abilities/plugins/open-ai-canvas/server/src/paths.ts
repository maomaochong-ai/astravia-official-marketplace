/**
 * 运行时目录解析结果（监听之后才有值）
 *
 * 由 server/src/service.ts 按职责切出（ADR-0012）。
 */
// 运行时目录在监听之后才解析（首次启动要下载 200 MB），所以这些路径先占位。
// 唯一的写入方是 prepareRuntime()：ESM 的 import 绑定只读，跨模块赋值只能走 setRuntimePaths()。
export let SERVER_DIR: string | null = null;
export let GO_BINARY: string | null = null;
export let WEB_DIST: string | null = null;
export let PI_RUNTIME: string | null = null;
export let NODE_BIN = "";
export let PLUGIN_PACKAGES: string | null = null;

export function setRuntimePaths(next: {
  serverDir?: string;
  goBinary?: string;
  webDist?: string;
  piRuntime?: string;
  nodeBin?: string;
  pluginPackages?: string;
}): void {
  if (next.serverDir !== undefined) SERVER_DIR = next.serverDir;
  if (next.goBinary !== undefined) GO_BINARY = next.goBinary;
  if (next.webDist !== undefined) WEB_DIST = next.webDist;
  if (next.piRuntime !== undefined) PI_RUNTIME = next.piRuntime;
  if (next.nodeBin !== undefined) NODE_BIN = next.nodeBin;
  if (next.pluginPackages !== undefined) PLUGIN_PACKAGES = next.pluginPackages;
}
