// 发布工作流的边界检查。
//
// 为什么需要它：载荷构建的配方（上游前端在 web/、Go 模块叫 yingce/backend、Windows 二进制要带
// .exe）都属于插件。一旦有人把这些知识搬回 YAML 的 run: 里，就会出现两份事实源：
// 2026-10-25 那次真实事故是 `working-directory: upstream`（少了 /web），报错是
// "Bun could not find a package.json file to install from" —— 与 web 毫无字面关联，
// 而 workflow 只在 dispatch 之后才跑，一次错误就是一整轮 CI。
//
// 这个脚本只读文本，不执行任何东西，也不联网：它断言 workflow 里出现的是插件的四个模式，
// 而不是 bun install / go build 这样的原始命令。
//
// 用法：node scripts/check-build-workflow.mjs [--file <path>]
//   --file <path> 指到别的工作流（默认找仓库根的 build-canvas-payloads.yml）

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// pluginRoot = <repo>/abilities/plugins/open-ai-canvas
const repoRoot = path.resolve(pluginRoot, "..", "..", "..");
const WORKFLOW_PATH = path.join(repoRoot, ".github", "workflows", "build-canvas-payloads.yml");
const SCRIPT = "scripts/build-service-zip.mjs";

// 每个 job 必须通过插件的哪个模式来构建东西。缺一项就意味着这条链路又绕开插件了。
const REQUIRED = [
  { mode: "--web", hint: "web 前端只构建一次，五个平台共用" },
  { mode: "--backend", hint: "Go 后端必须每个平台原生编译（CGO）" },
  { mode: "--payload", hint: "主载荷包含 web-dist 与官方插件包" },
  { mode: "--agent-runtime", hint: "Agent 载荷包含 pi 运行时与 node" },
];

// 出现在 run: 里就说明配方又被搬回 YAML 了。
const FORBIDDEN = [
  { pattern: /^\s*bun\s+install\b/m, why: "bun install 应该由 --web 在 <canvas-dir>/web 里执行" },
  { pattern: /^\s*bun\s+run\s+build\b/m, why: "bun run build 应该由 --web 执行" },
  { pattern: /^\s*go\s+build\b/m, why: "go build 应该由 --backend 执行（否则 ldflags 与输出名各写一份）" },
];

// working-directory 只允许落到插件自己的目录；指向上游仓库的相对路径意味着在 YAML 里猜目录。
const WORKDIR_ALLOWED = /^plugin\/abilities\/plugins\/open-ai-canvas$|^upstream(\/|$)/;

function fail(message) {
  console.error(`[check-build-workflow] ${message}`);
  process.exitCode = 1;
}

function main(argv) {
  const fileArgIndex = argv.indexOf("--file");
  const file = fileArgIndex >= 0 ? path.resolve(argv[fileArgIndex + 1]) : WORKFLOW_PATH;

  return readFile(file, "utf8").then((text) => {
    console.log(`[check-build-workflow] ${path.relative(repoRoot, file)}`);

    for (const { mode, hint } of REQUIRED) {
      if (!text.includes(mode)) fail(`工作流没有调用 ${SCRIPT} ${mode}（${hint}）`);
    }

    for (const { pattern, why } of FORBIDDEN) {
      const hit = text.match(pattern);
      if (hit) fail(`工作流里出现了 "${hit[0].trim()}"：${why}`);
    }

    // working-directory: 后面跟着的路径必须是插件目录，或者上游检出根（upstream 或 upstream/...）。
    for (const match of text.matchAll(/working-directory:\s*(\S+)/g)) {
      const dir = match[1].replace(/^["']|["']$/g, "");
      if (!WORKDIR_ALLOWED.test(dir)) fail(`working-directory: ${dir} 不在白名单里`);
    }

    // 调插件脚本的 step 必须显式 `shell: bash`。Windows runner 的默认 shell 是 pwsh，
    // `\` 续行在那里不是续行而是「缺表达式」的语法错误（2026-10-25 第二轮失败）。
    const steps = text.split(/\n(?=      - )/);
    for (const step of steps) {
      // 只看真实调用（`node scripts/…`），注释里提到文件名不算。
      if (!step.includes(`node ${SCRIPT}`)) continue;
      const name = step.match(/- name:\s*(.+)/)?.[1]?.trim() ?? "(未命名 step)";
      if (!/^\s*shell:\s*bash\s*$/m.test(step)) fail(`step "${name}" 调了插件脚本却没有 shell: bash`);
    }

    // 只报告数量，方便人眼扫一眼；真正的结论在上面的 fail()。
    const calls = [...text.matchAll(new RegExp(`node ${SCRIPT.replace(/\./g, "\\.")} (--[a-z-]+)`, "g"))].map(
      (match) => match[1],
    );
    console.log(`[check-build-workflow] 脚本调用：${calls.length ? [...new Set(calls)].join(", ") : "（无）"}`);

    if (process.exitCode) {
      console.error("[check-build-workflow] 失败：工作流会把构建配方写回 YAML");
      return;
    }
    console.log("[check-build-workflow] 通过：构建配方都在插件里");
  });
}

main(process.argv.slice(2)).catch((error) => {
  console.error(error?.stack ?? String(error));
  process.exitCode = 1;
});
