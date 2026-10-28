/**
 * 把已解包的载荷目录设为运行路径
 *
 * 拆成独立模块只有一个理由：检查/升级（payload-update）和准备流程（preparation-orchestrator）
 * 都要用它，放在编排模块里会让 service-routes → payload-update → preparation-orchestrator
 * → backend-process → stable-origin-binding → service-routes 连成一个环。
 */
import path from "node:path";
import { BINARY_NAME } from "./service-config.ts";
import { codedError } from "./payload-source-resolution.ts";
import { setRuntimePaths } from "./runtime-paths.ts";
import { hasWebBundle } from "./web-dist-hosting.ts";

/**
 * 后端可执行文件、前端产物、pi 运行时、插件包路径必须同时改指。
 * 漏一个就会出现「新后端 + 旧前端」这种最难查的组合（ADR-0017）。
 */
export function pointRuntimeAt(serverDir) {
  setRuntimePaths({
    serverDir,
    goBinary: path.join(serverDir, BINARY_NAME),
    webDist: path.join(serverDir, "web-dist"),
  });
  // 载荷里的前端产物由 shim 自己发（ADR-0008）。缺失时立刻带 code 失败：
  // 否则后端照常就绪、健康门照常通过，用户只会看到一个 404 JSON。
  if (!hasWebBundle()) {
    throw codedError("web-bundle-missing", `载荷里没有前端产物 ${path.join(serverDir, "web-dist", "index.html")}`);
  }
  setRuntimePaths({
    piRuntime: path.join(serverDir, "pi-runtime"),
    pluginPackages: path.join(serverDir, "plugin-packages"),
  });
}
