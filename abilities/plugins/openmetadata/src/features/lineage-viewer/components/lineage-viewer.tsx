/**
 * 血缘查看器 Activity Tab — 用 React Flow 渲染 OM lineage DAG。
 *
 * 用户选中一个实体后，调 OM `/v1/lineage/{entityType}/{entityId}` 获取上游/下游节点和边，
 * 然后在 Canvas 上渲染。支持：
 * - 搜索 FQN 定位实体
 * - 双击节点 → 进一步展开该节点的血缘（递归）
 * - 方向切换（上下游 / 上游仅 / 下游仅）
 * - 节点点击 → 右侧弹出实体详情（调 /v1/{entityType}/{fqn}）
 *
 * 调用链路：
 *   UI → omRequest(`/lineage/${entityType}/${entityId}`) → 代理 → OM /v1/lineage/...
 *
 * 注意：OM lineage API 用 entityType + UUID，不是 FQN。
 * 所以搜索拿到实体后先存 UUID，点血缘时用 UUID 调。
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import ReactFlow, {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type EdgeChange,
  type NodeProps,
} from "reactflow";
import "reactflow/dist/style.css";
import { omRequest, OmProxyError } from "../../../shared/om-services";

/** OM lineage API 的节点结构。 */
interface LineageNode {
  id: string;           // OM UUID
  entityType: string;   // table, pipeline, ...
  fullyQualifiedName: string;
  name?: string;
  description?: string;
  children?: LineageNode[]; // OM 嵌套结构：upstream/downstream 数组
}

interface LineageEdge {
  fromEntity?: string;
  fromId?: string;
  toEntity?: string;
  toId?: string;
  label?: string;
}

interface LineageResponse {
  nodes?: LineageNode[];
  edges?: LineageEdge[];
  upstream?: LineageNode[];
  downstream?: LineageNode[];
  entity?: { id?: string; entityType?: string; fullyQualifiedName?: string };
}

const ENTITY_COLORS: Record<string, string> = {
  table: "#3b82f6",
  dashboard: "#a855f7",
  pipeline: "#10b981",
  topic: "#f97316",
  chart: "#6366f1",
  metric: "#f43f5e",
  glossaryTerm: "#eab308",
  domain: "#06b6d4",
};

function OmLineageNode({ data }: NodeProps<LineageNode>): ReactNode {
  const color = ENTITY_COLORS[data.entityType] ?? "#6b7280";
  return (
    <div
      className="om-lineage-node rounded-lg border bg-background px-3 py-2 shadow-sm transition-shadow hover:shadow-md"
      style={{ borderColor: color, minWidth: 140, maxWidth: 200 }}
    >
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-border" />
      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-border" />
      <div className="flex items-center gap-1.5">
        <div className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {data.entityType}
        </span>
      </div>
      <div className="mt-1 text-xs font-medium leading-tight text-foreground">
        {data.name ?? data.fullyQualifiedName.split(".").pop()}
      </div>
      {data.fullyQualifiedName !== data.name && (
        <div className="mt-0.5 truncate font-mono text-[9px] text-muted-foreground/70">
          {data.fullyQualifiedName}
        </div>
      )}
    </div>
  );
}

const nodeTypes = { om: OmLineageNode };

type Direction = "both" | "upstream" | "downstream";

export function LineageViewer(): any {
  const [searchQuery, setSearchQuery] = useState("");
  const [entityType, setEntityType] = useState<string>("table");
  const [entityId, setEntityId] = useState<string | null>(null);
  const [entityFqn, setEntityFqn] = useState<string>("");
  const [direction, setDirection] = useState<Direction>("both");
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const reactWrapperRef = useRef<HTMLDivElement | null>(null);

  const fetchLineage = useCallback(async () => {
    if (!entityId) { setError("请先搜索并选中一个实体"); return; }
    setLoading(true);
    setError(null);
    setDetail(null);

    try {
      const upstream = direction !== "downstream"
        ? await omRequest<LineageResponse>(`/lineage/${entityType}/${entityId}?direction=upstream`).catch(() => null)
        : null;
      const downstream = direction !== "upstream"
        ? await omRequest<LineageResponse>(`/lineage/${entityType}/${entityId}?direction=downstream`).catch(() => null)
        : null;

      // 合并节点和边
      const nodeMap = new Map<string, Node>();
      const edgeSet = new Set<string>();
      const mergedEdges: Edge[] = [];
      let yOffset = 0;

      const addNodes = (arr?: LineageNode[], column = 0) => {
        if (!arr?.length) return;
        arr.forEach((n, i) => {
          if (!nodeMap.has(n.id)) {
            nodeMap.set(n.id, {
              id: n.id,
              type: "om",
              position: { x: column * 200, y: yOffset + i * 80 },
              data: n,
            });
          }
        });
        yOffset += arr.length * 80 + 40;
      };

      // 中心节点
      const centerNode: Node = {
        id: entityId,
        type: "om",
        position: { x: 200, y: 200 },
        data: {
          id: entityId,
          entityType,
          fullyQualifiedName: entityFqn,
          name: entityFqn.split(".").pop(),
        },
      };
      nodeMap.set(entityId, centerNode);

      addNodes(upstream?.upstream ?? upstream?.nodes, 0);
      addNodes(downstream?.downstream ?? downstream?.nodes, 4);

      // 构造边（OM lineage API edges 字段可能缺失，需从嵌套结构推断）
      const addEdge = (fromId: string, toId: string, label?: string) => {
        const key = `${fromId}→${toId}`;
        if (edgeSet.has(key)) return;
        edgeSet.add(key);
        mergedEdges.push({
          id: key,
          source: fromId,
          target: toId,
          label,
          markerEnd: { type: MarkerType.ArrowClosed },
          animated: false,
        });
      };

      // 从 upstream 结构推断边
      if (upstream?.upstream) {
        upstream.upstream.forEach((n) => addEdge(n.id, entityId));
      }
      if (downstream?.downstream) {
        downstream.downstream.forEach((n) => addEdge(entityId, n.id));
      }
      // 显式 edges
      [...(upstream?.edges ?? []), ...(downstream?.edges ?? [])].forEach((e) => {
        if (e.fromId && e.toId) addEdge(e.fromId, e.toId, e.label);
      });

      setNodes(Array.from(nodeMap.values()));
      setEdges(mergedEdges);
    } catch (e) {
      const err = e as OmProxyError;
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [entityId, entityType, entityFqn, direction]);

  // 搜索实体 → 拿到 UUID
  const searchAndLoad = useCallback(async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setError(null);
    setLoading(true);
    try {
      const params = new URLSearchParams({ query: q, size: "1" });
      if (entityType) params.set("entityType", entityType);
      const resp = await omRequest<{ hits?: { hits?: Array<{ id?: string; entityType?: string; fullyQualifiedName?: string; name?: string }> } }>(
        `/search/query?${params.toString()}`,
      );
      const hit = resp?.hits?.hits?.[0];
      if (!hit || !hit.id) {
        setError(`未找到匹配的 ${entityType}：${q}`);
        setLoading(false);
        return;
      }
      setEntityId(hit.id);
      setEntityType(hit.entityType ?? entityType);
      setEntityFqn(hit.fullyQualifiedName ?? hit.name ?? "");
    } catch (e) {
      setError((e as OmProxyError).message);
      setLoading(false);
      return;
    }
  }, [searchQuery, entityType]);

  // 拿到 entityId 后自动拉血缘
  useEffect(() => {
    if (entityId) void fetchLineage();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId, direction]);

  const onNodesChange = useCallback((changes: NodeChange[]) => setNodes((n) => applyNodeChanges(changes, n)), []);
  const onEdgesChange = useCallback((changes: EdgeChange[]) => setEdges((e) => applyEdgeChanges(changes, e)), []);
  const onConnect = useCallback((c: Connection) => setEdges((e) => addEdge(c, e)), []);

  const onNodeDoubleClick = useCallback(async (_evt: unknown, node: Node<LineageNode>) => {
    if (node.id === entityId) return;
    setEntityId(node.id);
    setEntityType(node.data.entityType);
    setEntityFqn(node.data.fullyQualifiedName);
  }, [entityId]);

  const onNodeClick = useCallback(async (_evt: unknown, node: Node<LineageNode>) => {
    if (detailLoading) return;
    setDetailLoading(true);
    setDetail(null);
    try {
      const raw = await omRequest<unknown>(`/${node.data.entityType}/${encodeURIComponent(node.data.fullyQualifiedName)}`);
      setDetail(raw);
    } catch (e) {
      setDetail({ error: (e as OmProxyError).message });
    } finally {
      setDetailLoading(false);
    }
  }, [detailLoading]);

  return (
    <div
      data-astravia-plugin-root="openmetadata"
      className="om-root flex h-full w-full min-h-0 flex-col bg-background text-foreground"
      style={{ contain: "layout style paint" }}
    >
      {/* 工具栏 */}
      <header className="flex shrink-0 items-center gap-2 border-b border-border/50 px-4 py-3">
        <span className="icon-[lucide--git-branch] h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void searchAndLoad(); }}
          placeholder="输入 FQN 或名称搜索实体..."
          className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          type="button"
          onClick={() => void searchAndLoad()}
          className="shrink-0 rounded-md border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs text-primary hover:bg-primary/10"
          disabled={loading}
        >
          {loading ? "搜索中..." : "搜索"}
        </button>

        <select
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
          className="shrink-0 rounded-md border border-input bg-background px-2 py-1.5 text-xs"
        >
          <option value="table">表</option>
          <option value="pipeline">管线</option>
          <option value="dashboard">仪表板</option>
          <option value="topic">Topic</option>
        </select>

        <div className="flex shrink-0 rounded-md border border-border p-0.5 text-xs">
          {(["upstream", "both", "downstream"] as Direction[]).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDirection(d)}
              className={`rounded px-2 py-1 ${direction === d ? "bg-muted text-foreground" : "text-muted-foreground"}`}
            >
              {d === "upstream" ? "上游" : d === "downstream" ? "下游" : "双向"}
            </button>
          ))}
        </div>

        {entityId && (
          <button
            type="button"
            onClick={() => void fetchLineage()}
            className="shrink-0 rounded-md border border-input px-2 py-1.5 text-xs hover:bg-muted/50"
            title="刷新血缘"
          >
            🔄
          </button>
        )}
      </header>

      {/* 当前实体提示 */}
      {entityId && (
        <div className="shrink-0 border-b border-border/50 bg-muted/30 px-4 py-1.5">
          <span className="text-[11px] text-muted-foreground">
            当前实体：
          </span>
          <span className="ml-1 text-[11px] font-mono text-foreground">
            {entityType}/{entityFqn}
          </span>
        </div>
      )}

      {/* 错误 */}
      {error && (
        <div className="mx-4 mt-3 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {/* 主体 */}
      <div className="flex min-h-0 flex-1">
        {/* Canvas */}
        <div ref={reactWrapperRef} className={`relative min-h-0 ${detail ? "w-1/2" : "w-full"}`}>
          {nodes.length === 0 && !loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <span className="icon-[lucide--git-branch-plus] h-10 w-10 opacity-40" />
              <p className="text-sm">搜索一个实体查看其血缘图谱</p>
              <p className="text-[11px] text-muted-foreground/70">双击节点递归展开，点击节点查看详情</p>
            </div>
          )}
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <span className="icon-[lucide--loader-2] h-4 w-4 animate-spin" />
              加载血缘...
            </div>
          )}
          {nodes.length > 0 && (
            <div data-react-flow-wrapper="true" className="absolute inset-0">
              {(
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onConnect={onConnect}
                  onNodeClick={onNodeClick}
                  onNodeDoubleClick={onNodeDoubleClick}
                  nodeTypes={nodeTypes}
                  fitView
                  fitViewOptions={{ padding: 0.3 }}
                  proOptions={{ hideAttribution: true }}
                  nodesDraggable
                  nodesConnectable={false}
                >
                  <Background gap={20} color="hsl(var(--border) / 0.4)" />
                  <Controls showInteractive={false} />
                  <MiniMap
                    nodeColor={(n) => ENTITY_COLORS[(n.data as LineageNode).entityType] ?? "#6b7280"}
                    maskColor="hsl(var(--background) / 0.7)"
                    pannable
                    zoomable
                  />
                </ReactFlow>
              ) as unknown as ReactNode}
            </div>
          )}
        </div>

        {/* 详情面板 */}
        {detail && (
          <aside className="min-h-0 w-1/2 overflow-y-auto border-l border-border/50 p-4 text-xs">
            {detailLoading && <div className="text-muted-foreground">加载详情...</div>}
            {!detailLoading && detail && (
              <pre className="max-h-full overflow-auto rounded-md border border-border/50 bg-muted/30 p-3 text-[10px] leading-relaxed text-foreground/80">
                {JSON.stringify(detail, null, 2).slice(0, 4000)}
              </pre>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
