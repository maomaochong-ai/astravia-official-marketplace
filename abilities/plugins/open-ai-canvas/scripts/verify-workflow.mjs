#!/usr/bin/env node
/**
 * 验证 ADR-0007 的声明式工作流编译器。
 *
 * 为什么用抽取而不是 import：`server/boot.mjs` 是打包进插件的**单一自包含文件**
 * （plugin.json 的制品就是它一个文件，`archive: "file"`），所以它不能 import 兄弟模块。
 * 那就不为了测试去改生产结构——直接从源码里取出这几个纯函数，在 vm 里跑。
 * 测的是即将发布的那份字节，不是一份复制品。
 *
 * 覆盖：一次成图、未知类型立即失败、成环、按 __key 幂等、连线去重、布局分层、
 * `run` 默认不触发生成。
 */
import { readFileSync, readdirSync } from "node:fs";
import ts from "typescript";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
// 从 **源** 读，不从 server/boot.mjs 读：后者是 esbuild 的产物，标识符可能被重写。
// 这里测的是 compileWorkflow 的纯逻辑，与打包方式无关（ADR-0012 决策 3）。
// 按目录读全部源码：切分后（ADR-0012）符号散落在多个模块，写死文件列表会在
// 下一次拆分时静默失效。读取顺序固定，保证断言里的 indexOf 行为稳定。
const SRC_DIR = join(ROOT, "server/src");
const source = readdirSync(SRC_DIR)
  .filter((name) => name.endsWith(".ts"))
  .sort()
  .map((name) => readFileSync(join(SRC_DIR, name), "utf8"))
  .join("\n");

const results = [];
function check(name, condition, detail) {
  results.push({ name, ok: Boolean(condition), detail });
  console.log(`${condition ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

/** 取出一个 `const NAME = …;` 或 `function NAME(…) {…}` 的完整源码块（按括号配平）。 */
function sliceBlock(name, { isFunction = false } = {}) {
  // 锚点要容忍打包器：源里写 `const X =`，esbuild 可能输出 `var X =`（ADR-0012 决策 3）。
  const start = isFunction
    ? source.indexOf(`function ${name}(`)
    : source.search(new RegExp(`(?:const|let|var) ${name}(?:\\s*:[^=\\n]*)?\\s*=`));
  if (start < 0) throw new Error(`cannot find ${name} declaration in server source`);

  // 定位值的第一个字符：函数体或对象/数组字面量按括号配平，标量取到分号。
  const scanFrom = isFunction ? source.indexOf("{", source.indexOf(")", start)) : source.indexOf("=", start) + 1;
  const valueIndex = source.slice(scanFrom).search(/[^\s]/) + scanFrom;
  const openChar = source[valueIndex];
  if (openChar !== "{" && openChar !== "[") {
    const end = source.indexOf(";", valueIndex);
    return source.slice(start, end + 1);
  }

  const closeChar = openChar === "{" ? "}" : "]";
  let depth = 0;
  let index = valueIndex;
  let inString = null;
  for (; index < source.length; index += 1) {
    const char = source[index];
    if (inString) {
      if (char === "\\") index += 1;
      else if (char === inString) inString = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      inString = char;
      continue;
    }
    if (char === openChar) depth += 1;
    else if (char === closeChar) {
      depth -= 1;
      if (depth === 0) {
        // 函数体以 `}` 结束，后面没有分号——往后找 `;` 会把下一段代码一起吞进来。
        if (isFunction) return source.slice(start, index + 1);
        const end = source.indexOf(";", index);
        return source.slice(start, end > 0 ? end + 1 : index + 1);
      }
    }
  }
  throw new Error(`unbalanced block for ${name}`);
}

// 切片来自 .ts，而 vm 只吃 JS。手写正则剥类型（`const X: T =`、函数返回类型、参数类型）
// 注定漏一种写法，所以直接用仓库里已有的 typescript 做语法擦除：转换是结构化的，
// 新增标注不会让这个脚本静默坏掉。
const toJs = (code) =>
  ts
    .transpileModule(code, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    })
    .outputText.replace(/^export\s+/gm, "")
    .trim();


const pieces = [
  sliceBlock("LAYOUT_STEP_X"),
  sliceBlock("LAYOUT_STEP_Y"),
  sliceBlock("codedError", { isFunction: true }),
  sliceBlock("BUILTIN_NODE_TYPES"),
  sliceBlock("compileWorkflow", { isFunction: true }),
].map(toJs);

const context = vm.createContext({ crypto: globalThis.crypto, console });
vm.runInContext(`${pieces.join("\n")}\nthis.compileWorkflow = compileWorkflow; this.TYPES = BUILTIN_NODE_TYPES;`, context);
const compile = context.compileWorkflow;
const TYPES = [...context.TYPES];

function attempt(workflow, existing) {
  try {
    return { ok: true, value: compile(workflow, existing) };
  } catch (error) {
    return { ok: false, code: error.code, message: error.message };
  }
}

const [firstType] = TYPES;
const secondType = TYPES[1] ?? TYPES[0];

// 1. 线性三步：一次请求成图
{
  const workflow = {
    nodes: [
      { key: "prompt", type: firstType, title: "Prompt" },
      { key: "image", type: secondType, title: "Image" },
      { key: "video", type: firstType, title: "Video" },
    ],
    edges: [
      { from: "prompt", to: "image" },
      { from: "image", to: "video" },
    ],
  };
  const { ok, value } = attempt(workflow, { nodes: [], connections: [] });
  const created = value?.operations.filter((op) => op.type === "create_node") ?? [];
  const linked = value?.operations.filter((op) => op.type === "create_connection") ?? [];
  check("三步线性 workflow 一次编译完成", ok && created.length === 3 && linked.length === 2, `nodes=${created.length} edges=${linked.length}`);
  check(
    "分层布局沿依赖深度推进（x 递增，同层共用列）",
    value?.depth.prompt === 0 && value?.depth.image === 1 && value?.depth.video === 2,
    JSON.stringify(value?.depth),
  );
  const xs = created.map((op) => op.node.position.x);
  check("位置单调按 depth 展开", xs[0] < xs[1] && xs[1] < xs[2], JSON.stringify(xs));
  check(
    "每个节点都盖 __key（幂等锚点）",
    created.every((op) => typeof op.node.metadata.__key === "string" && op.node.metadata.__key.length > 0),
    created.map((op) => op.node.metadata.__key).join(","),
  );
  check(
    "返回 key→id 映射，调用方不用猜 id",
    Object.keys(value?.mapping ?? {}).length === 3 && value.mapping.prompt === created[0].id,
    JSON.stringify(value?.mapping ?? {}).slice(0, 80),
  );
}

// 2. 未知类型：不发请求就报错
{
  const { ok, code } = attempt({ nodes: [{ key: "x", type: "definitely-not-a-node" }], edges: [] }, null);
  check("未知节点类型 → unknown_node_type", !ok && code === "unknown_node_type", `code=${code}`);
}

// 3. 成环
{
  const workflow = {
    nodes: [
      { key: "a", type: firstType },
      { key: "b", type: firstType },
    ],
    edges: [
      { from: "a", to: "b" },
      { from: "b", to: "a" },
    ],
  };
  const { ok, code } = attempt(workflow, { nodes: [], connections: [] });
  check("依赖成环 → workflow-cycle", !ok && code === "workflow-cycle", `code=${code}`);
}

// 4. 悬空连线 / 空 workflow
{
  const dangling = attempt({ nodes: [{ key: "a", type: firstType }], edges: [{ from: "a", to: "ghost" }] }, null);
  check("连线指向不存在的节点 → workflow-invalid-edge", !dangling.ok && dangling.code === "workflow-invalid-edge", `code=${dangling.code}`);
  const empty = attempt({ nodes: [] }, null);
  check("空 workflow → workflow-empty", !empty.ok && empty.code === "workflow-empty", `code=${empty.code}`);
  const dup = attempt({ nodes: [{ key: "a", type: firstType }, { key: "a", type: firstType }] }, null);
  check("重复 key → workflow-invalid-node", !dup.ok && dup.code === "workflow-invalid-node", `code=${dup.code}`);
}

// 5. 幂等：同一个 workflow 再来一次只产生 patch_node，且连线不重复
{
  const workflow = {
    nodes: [
      { key: "prompt", type: firstType, title: "Prompt v2" },
      { key: "image", type: secondType },
    ],
    edges: [{ from: "prompt", to: "image" }],
  };
  const firstPass = attempt(workflow, { nodes: [], connections: [] }).value;
  const existing = {
    nodes: firstPass.operations
      .filter((op) => op.type === "create_node")
      .map((op) => ({ id: op.node.id, title: op.node.title, metadata: op.node.metadata })),
    connections: firstPass.operations
      .filter((op) => op.type === "create_connection")
      .map((op) => ({ fromNodeId: op.connection.fromNodeId, toNodeId: op.connection.toNodeId })),
  };
  const secondPass = attempt(workflow, existing).value;
  const kinds = secondPass.operations.map((op) => op.type);
  check(
    "重复 apply 只产生 patch_node（不重复建节点）",
    kinds.filter((kind) => kind === "create_node").length === 0 && kinds.filter((kind) => kind === "patch_node").length === 2,
    kinds.join(","),
  );
  check("已存在的连线不重复创建", kinds.filter((kind) => kind === "create_connection").length === 0, kinds.join(","));
  check(
    "patch_node 复用原 id，调用方可见的 id 稳定",
    secondPass.mapping.prompt === firstPass.mapping.prompt,
    `${firstPass.mapping.prompt} vs ${secondPass.mapping.prompt}`,
  );
  check(
    "patch 带上新的 title（改标题不是再造一份）",
    secondPass.operations.find((op) => op.type === "patch_node" && op.id === secondPass.mapping.prompt)?.patch.title === "Prompt v2",
    "Prompt v2",
  );
}

// 6. 显式 position 优先于自动布局
{
  const { value } = attempt(
    { nodes: [{ key: "a", type: firstType, position: { x: 42, y: 7 } }], edges: [] },
    { nodes: [], connections: [] },
  );
  const created = value.operations.find((op) => op.type === "create_node");
  check("用户给出的 position 不被自动布局覆盖", created.node.position.x === 42 && created.node.position.y === 7, JSON.stringify(created.node.position));
}

// 7. run 缺省不触发生成（静态断言：它决定是否花钱，不能靠默认值猜）
{
  const declaration = source.slice(source.indexOf('name: "apply_workflow"'), source.indexOf('name: "export_workflow"'));
  check(
    "apply_workflow 声明里写明 run 默认 false 且要逐节点标记",
    /default false/.test(declaration) && /run: true|run:true/.test(declaration),
    "description 提到 default false / {run:true}",
  );
  const handler = source.slice(source.indexOf("apply_workflow"), source.length);
  const runIndex = handler.indexOf("node?.run === true");
  check("执行侧只认 node.run === true，不认其它写法", runIndex > 0, runIndex > 0 ? "found" : "not found");
  // 精确计数交给 verify-mcp-tools.mjs（它跟真实 tools/list 对账）；这里只问“ADR-0007 那两个在不在”。
  const toolCount = (source.match(/\n    name: "/g) ?? []).length;
  check("工具数量 ≥ 18（16 + apply_workflow + export_workflow）", toolCount >= 18, String(toolCount));
}

const failed = results.filter((result) => !result.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length > 0) process.exitCode = 1;
