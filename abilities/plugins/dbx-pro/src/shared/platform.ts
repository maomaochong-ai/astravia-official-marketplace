/**
 * 平台标签类型（插件侧共享）。
 *
 * 平台选择的实际逻辑：
 * - provisioning（src/runtime.ts）：以宿主 `services.getPlatform()` 返回的平台为准，
 *   宿主按运行 service 的 node 进程（process.platform-process.arch）校验并安装对应二进制。
 * - engine client（server/src/engine/engine-client.mjs）：同样以运行进程的
 *   process.arch 选择二进制，并以磁盘上实际存在的文件做兜底。
 *
 * 注意：在 Apple Silicon 机器上宿主内置 node 可能是 x64（Rosetta），此时安装与
 * 运行都使用 darwin-x64 二进制，保持与宿主 marker 校验一致。
 */

export type PlatformTag = "darwin-arm64" | "darwin-x64" | "win32-x64";
