/**
 * open-ai-canvas 服务启动包装器（host-node entry）。
 *
 * 这个文件只做装配：把各模块的启动步骤按顺序串起来，业务逻辑都在 server/src/ 的
 * 其它模块里（ADR-0012）。宿主只下载并执行打包后的 server/boot.mjs，
 * 源码是非打包形态，由 scripts/build-service.mjs 用 esbuild 合并成单文件。
 *
 * 启动顺序的约束：
 * 1. 先钉住浏览器 origin —— backendEnv() 要拿 PUBLIC_ORIGIN 算「公开基址」
 *    （上传资源拼的绝对地址）与 CORS 白名单，晚于 startBackend 就晚了；
 * 2. 监听随后就位，否则 prepareRuntime() 的进度页没有出口；
 * 3. 运行时准备放最后，并且不 await —— 宿主在 readiness 通过前不该被下载拖住。
 */
import { bindStableOrigin, startProxy } from "./stable-origin-binding.ts";
import { prepareRuntime } from "./preparation-orchestrator.ts";

// --- 启动序列 ---
await bindStableOrigin();
startProxy();
void prepareRuntime();
