/**
 * 声明式 workflow 编译成 operations（ADR-0007）
 *
 * 由 server/src/boot.ts 按职责切出（ADR-0012）。
 */
import crypto from "node:crypto";
import { codedError } from "./payload-source-resolution.ts";
import { BUILTIN_NODE_TYPES, LAYOUT_STEP_X, LAYOUT_STEP_Y } from "./canvas-node-contract.ts";

export let LAST_WORKFLOW: any = null;

// 编译发生在 mcp.ts（write_workflow 工具），展示发生在 routes.ts 的状态快照。
export function setLastWorkflow(value: any): void {
  LAST_WORKFLOW = value;
}

// 布局步长同上（LAYOUT_STEP_X / LAYOUT_STEP_Y）。

/**
 * 把声明式 workflow 编译成一批 operations（ADR-0007 决策 2）。
 * 不做的事：不猜节点语义、不补默认 metadata、不代跑生成。
 * 做的事：校验类型、按依赖分层布局、按 __key 幂等。
 *
 * @param workflow    { nodes, edges }
 * @param existing    { nodes, connections }，来自当前画布（可为空）
 */
export function compileWorkflow(workflow: any, existing: any) {
  const nodes = Array.isArray(workflow?.nodes) ? workflow.nodes : [];
  if (nodes.length === 0) throw codedError("workflow-empty", "workflow.nodes 不能为空");

  const byKey = new Map();
  for (const node of nodes) {
    const key = String(node?.key ?? "");
    if (!key) throw codedError("workflow-invalid-node", "每个节点都需要 key（用于连线与幂等）");
    if (byKey.has(key)) throw codedError("workflow-invalid-node", `节点 key 重复：${key}`);
    if (!BUILTIN_NODE_TYPES.includes(node.type)) {
      throw codedError(
        "unknown_node_type",
        `unknown_node_type: ${node.type}（内置类型：${BUILTIN_NODE_TYPES.join(", ")}；插件节点请先用 add_node 确认）`,
      );
    }
    byKey.set(key, node);
  }

  // 深度 = 依赖链长度。edges 里的两端必须在 nodes 里，否则拼出来的图是断的。
  const parents: Map<string, string[]> = new Map(
    nodes.map((node: any) => [node.key, [...(node.depends_on ?? [])]] as [string, string[]]),
  );
  for (const edge of workflow?.edges ?? []) {
    if (!byKey.has(edge?.from) || !byKey.has(edge?.to)) {
      throw codedError("workflow-invalid-edge", `连线引用了不存在的节点：${edge?.from} → ${edge?.to}`);
    }
    if (edge.to === edge.from) throw codedError("workflow-cycle", "节点不能连自己");
    parents.get(edge.to).push(edge.from);
  }

  const depth = new Map();
  const visiting = new Set();
  const depthOf = (key) => {
    if (depth.has(key)) return depth.get(key);
    if (visiting.has(key)) throw codedError("workflow-cycle", `依赖成环：${[...visiting, key].join(" → ")}`);
    visiting.add(key);
    let value = 0;
    for (const parent of parents.get(key) ?? []) value = Math.max(value, depthOf(parent) + 1);
    visiting.delete(key);
    depth.set(key, value);
    return value;
  };

  const existingNodes = Array.isArray(existing?.nodes) ? existing.nodes : [];
  const priorByKey: Map<string, any> = new Map(
    existingNodes
      .filter((node: any) => node?.metadata?.__key)
      .map((node: any) => [node.metadata.__key, node] as [string, any]),
  );
  // 已存在的连线按「起点→终点节点 id」去重，否则重试一次就会多一层重复连线。
  const priorEdges = new Set(
    (existing?.connections ?? []).map((conn) => `${conn.fromNodeId}->${conn.toNodeId}`),
  );

  const rows = new Map();
  const operations = [];
  const mapping = {};

  for (const node of nodes) {
    const column = depthOf(node.key);
    const row = rows.get(column) ?? 0;
    rows.set(column, row + 1);
    const position = node.position ?? { x: column * LAYOUT_STEP_X, y: row * LAYOUT_STEP_Y };
    const metadata = { ...(node.metadata ?? {}), __key: node.key };
    const prior = priorByKey.get(node.key);

    if (prior) {
      // 幂等：同一个 key 再来一次是改，不是再造一份。
      mapping[node.key] = prior.id;
      operations.push({
        type: "patch_node",
        id: prior.id,
        patch: { title: node.title ?? prior.title, position, metadata },
      });
      continue;
    }

    const id = crypto.randomUUID();
    mapping[node.key] = id;
    operations.push({
      type: "create_node",
      id,
      node: {
        id,
        type: node.type,
        title: node.title || node.type,
        position,
        ...(node.width !== undefined && { width: node.width }),
        ...(node.height !== undefined && { height: node.height }),
        metadata,
      },
    });
  }

  for (const edge of workflow?.edges ?? []) {
    const signature = `${mapping[edge.from]}->${mapping[edge.to]}`;
    if (priorEdges.has(signature)) continue;
    const id = crypto.randomUUID();
    operations.push({
      type: "create_connection",
      id,
      connection: { id, fromNodeId: mapping[edge.from], toNodeId: mapping[edge.to] },
    });
  }

  return { operations, mapping, depth: Object.fromEntries(depth) };
}
