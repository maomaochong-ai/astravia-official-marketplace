/**
 * 元数据浏览器 Activity Tab — 搜索 + 结果列表 + 实体详情 + @om 注入。
 *
 * 这是 om 插件的主面板，让用户浏览 OM 数据目录：
 * - 顶部搜索栏：关键词搜索 + 语义搜索切换
 * - 实体类型过滤
 * - 搜索结果卡片网格
 * - 点击实体 → 右侧弹出详情面板（getEntityDetails）
 * - @om 按钮 → 注入 `@om:<type>:<fqn>` 到宿主输入框
 *
 * 调用链路（不走 MCP handler，直接走 omRequest）：
 *   UI 组件 → omRequest("/search/query?query=...") → 代理进程 → OM /v1/search/query
 */

import { useCallback, useEffect, useRef, useState, type JSX } from "react";
import { omRequest, OmProxyError } from "../../../shared/om-services";

interface SearchHit {
  entityType: string;
  fullyQualifiedName?: string;
  name?: string;
  description?: string;
  owners?: Array<{ name?: string }>;
  tags?: Array<{ labelType?: string; tagFQN?: string; name?: string }>;
  tier?: string;
  serviceType?: string;
  highlight?: { hits?: string[] };
  [key: string]: unknown;
}

interface SearchResponse {
  hits?: { hits?: SearchHit[]; total?: { value?: number } };
}

const ENTITY_TYPES = [
  { value: "", label: "全部", icon: "icon-[lucide--layout-grid]" },
  { value: "table", label: "表", icon: "icon-[lucide--table-2]" },
  { value: "dashboard", label: "仪表板", icon: "icon-[lucide--layout-dashboard]" },
  { value: "pipeline", label: "管线", icon: "icon-[lucide--workflow]" },
  { value: "topic", label: "Topic", icon: "icon-[lucide--message-square]" },
  { value: "glossaryTerm", label: "术语", icon: "icon-[lucide--book-open]" },
  { value: "domain", label: "数据域", icon: "icon-[lucide--folder-tree]" },
  { value: "metric", label: "指标", icon: "icon-[lucide--trending-up]" },
  { value: "chart", label: "图表", icon: "icon-[lucide--pie-chart]" },
];

export function MetadataBrowser(): JSX.Element {
  const [query, setQuery] = useState("");
  const [entityType, setEntityType] = useState("");
  const [searchMode, setSearchMode] = useState<"keyword" | "semantic">("keyword");
  const [results, setResults] = useState<SearchHit[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<SearchHit | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<Record<string, unknown> | { error: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const searchAbortRef = useRef<{ abort: () => void } | null>(null);

  const doSearch = useCallback(async () => {
    const q = query.trim();
    if (!q) { setResults([]); setTotal(0); setSelected(null); setDetail(null); return; }

    // 取消上一次搜索
    searchAbortRef.current?.abort();

    setLoading(true);
    setError(null);
    setSelected(null);
    setDetail(null);

    try {
      let raw: unknown;
      if (searchMode === "semantic") {
        const body: Record<string, unknown> = { query: q, size: 15 };
        if (entityType) body.filters = { entityType: [entityType] };
        raw = await omRequest<unknown>("/search/vector/query", { method: "POST", body });
      } else {
        const params = new URLSearchParams({ query: q, size: "15" });
        if (entityType) params.set("entityType", entityType);
        raw = await omRequest<unknown>(`/search/query?${params.toString()}`);
      }

      const resp = raw as SearchResponse;
      setResults(resp?.hits?.hits ?? []);
      setTotal(resp?.hits?.total?.value ?? 0);
    } catch (e) {
      const err = e as OmProxyError;
      if (err.code === "NO_CONNECTION") {
        setError("未配置 OpenMetadata 连接，请先在侧边栏添加");
      } else if (err.code === "AUTH_EXPIRED") {
        setError("API Token 已过期，请在连接配置中更新");
      } else if (searchMode === "semantic" && /not configured/i.test(err.message ?? "")) {
        setError("当前 OM 实例未配置语义搜索向量嵌入，已自动降级到关键词搜索");
        // 自动降级重试
        try {
          const params = new URLSearchParams({ query: q, size: "15" });
          if (entityType) params.set("entityType", entityType);
          const raw2 = await omRequest<unknown>(`/search/query?${params.toString()}`);
          const resp2 = raw2 as SearchResponse;
          setResults(resp2?.hits?.hits ?? []);
          setTotal(resp2?.hits?.total?.value ?? 0);
        } catch (e2) {
          setError((e2 as OmProxyError).message);
        }
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [query, entityType, searchMode]);

  // 搜索防抖
  useEffect(() => {
    if (!query.trim()) return;
    const timer = setTimeout(() => { void doSearch(); }, 400);
    return () => clearTimeout(timer);
  }, [query, doSearch]);

  // 加载实体详情
  const loadDetail = useCallback(async (hit: SearchHit) => {
    setSelected(hit);
    setDetail(null);
    setDetailLoading(true);
    try {
      const fqn = hit.fullyQualifiedName ?? hit.name ?? "";
      if (!fqn) return;
      const include = ["context"]; // context 给出 PK/FK/频繁 join — Agent 写 SQL 前有用
      const raw = await omRequest<Record<string, unknown>>(
        `/${hit.entityType}/${encodeURIComponent(fqn)}?include=${include.join(",")}`,
      );
      setDetail(raw);
    } catch (e) {
      setDetail({ error: (e as OmProxyError).message });
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // @om 注入 — 触发宿主 activity tab 的 @ 选择器逻辑
  const insertAtMention = useCallback(async () => {
    if (!selected) return;
    // 实际实现需要宿主提供 insertText API，这里留 hook
    // 格式: @om:<entityType>:<fqn>
  }, [selected]);

  return (
    <div
      data-astravia-plugin-root="openmetadata"
      className="om-root flex h-full w-full min-h-0 flex-col bg-background text-foreground"
      style={{ contain: "layout style paint" }}
    >
      {/* 顶部搜索栏 */}
      <header className="flex shrink-0 items-center gap-3 border-b border-border/50 px-4 py-3">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground icon-[lucide--search]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void doSearch(); }}
            placeholder="搜索元数据：表名、仪表板、管线、术语..."
            className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {loading && (
            <span className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground icon-[lucide--loader-2]" />
          )}
        </div>

        {/* 搜索模式切换 */}
        <div className="flex shrink-0 rounded-md border border-border p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setSearchMode("keyword")}
            className={`rounded px-2.5 py-1 transition-colors ${searchMode === "keyword" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            关键词
          </button>
          <button
            type="button"
            onClick={() => setSearchMode("semantic")}
            className={`rounded px-2.5 py-1 transition-colors ${searchMode === "semantic" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            语义
          </button>
        </div>

        {/* 实体类型筛选 */}
        <select
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
          className="shrink-0 rounded-md border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {ENTITY_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </header>

      {/* 错误提示 */}
      {error && (
        <div className="mx-4 mt-3 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {/* 结果区 + 详情面板 */}
      <div className="flex min-h-0 flex-1">
        {/* 左侧结果列表 */}
        <div className={`flex min-h-0 flex-col overflow-y-auto ${selected ? "w-1/2 border-r border-border/50" : "w-full"}`}>
          {!query.trim() && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
              <span className="icon-[lucide--database] h-10 w-10 opacity-40" />
              <p className="text-sm">在上方搜索框输入关键词开始查找元数据</p>
            </div>
          )}

          {query.trim() && !loading && results.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
              <span className="icon-[lucide--search-x] h-8 w-8 opacity-40" />
              <p className="text-xs">未找到匹配的结果</p>
            </div>
          )}

          {results.length > 0 && (
            <div className="p-3 text-[11px] text-muted-foreground">
              共 {total} 条结果，显示 {results.length} 条
            </div>
          )}

          <ul className="flex-1 space-y-1 p-3">
            {results.map((hit, idx) => (
              <li key={hit.fullyQualifiedName ?? idx}>
                <button
                  type="button"
                  onClick={() => void loadDetail(hit)}
                  className={`flex w-full items-start gap-3 rounded-md border px-3 py-2 text-left transition-colors ${
                    selected?.fullyQualifiedName === hit.fullyQualifiedName
                      ? "border-primary/60 bg-primary/5"
                      : "border-border hover:border-border/80 hover:bg-muted/50"
                  }`}
                >
                  <EntityTypeIcon type={hit.entityType} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{hit.name ?? hit.fullyQualifiedName}</span>
                      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {entityTypeLabel(hit.entityType)}
                      </span>
                    </div>
                    {hit.fullyQualifiedName && hit.fullyQualifiedName !== hit.name && (
                      <p className="truncate text-[11px] text-muted-foreground/70">{hit.fullyQualifiedName}</p>
                    )}
                    {hit.description && (
                      <p className="mt-1 truncate text-[11px] text-muted-foreground">{hit.description}</p>
                    )}
                    <div className="mt-1.5 flex items-center gap-1.5">
                      {hit.owners?.slice(0, 2).map((o, i) => (
                        <span key={i} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          👤 {o.name ?? "unknown"}
                        </span>
                      ))}
                      {hit.tier && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          🏷️ Tier {hit.tier}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* 右侧详情面板 */}
        {selected && (
          <div className="flex min-h-0 w-1/2 flex-col overflow-hidden">
            <div className="flex shrink-0 items-center justify-between border-b border-border/50 px-4 py-2">
              <span className="text-xs text-muted-foreground">实体详情</span>
              <button
                type="button"
                onClick={insertAtMention}
                className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-2 py-1 text-[11px] text-primary hover:bg-primary/10"
                title="注入 @om 提及到宿主输入框"
              >
                <span className="icon-[lucide--at-sign] h-3 w-3" />
                @om 注入
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {detailLoading && (
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground py-8">
                  <span className="icon-[lucide--loader-2] h-4 w-4 animate-spin" />
                  加载详情...
                </div>
              )}
              {!detailLoading && detail && !isErrorDetail(detail) && (
                <DetailView detail={detail as Record<string, unknown>} />
              )}
              {!detailLoading && detail && isErrorDetail(detail) && (
                <div className="text-xs text-destructive">{(detail as { error?: string }).error}</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function entityTypeLabel(type: string): string {
  return ENTITY_TYPES.find((t) => t.value === type)?.label ?? type;
}

function EntityTypeIcon({ type }: { type: string }): JSX.Element {
  const iconMap: Record<string, string> = {
    table: "icon-[lucide--table-2]",
    dashboard: "icon-[lucide--layout-dashboard]",
    pipeline: "icon-[lucide--workflow]",
    topic: "icon-[lucide--message-square]",
    glossaryTerm: "icon-[lucide--book-open]",
    domain: "icon-[lucide--folder-tree]",
    metric: "icon-[lucide--trending-up]",
    chart: "icon-[lucide--pie-chart]",
  };
  const cls = iconMap[type] ?? "icon-[lucide--database]";
  const colorMap: Record<string, string> = {
    table: "text-blue-500",
    dashboard: "text-purple-500",
    pipeline: "text-green-500",
    topic: "text-orange-500",
    glossaryTerm: "text-yellow-500",
    domain: "text-cyan-500",
    metric: "text-rose-500",
    chart: "text-indigo-500",
  };
  const color = colorMap[type] ?? "text-muted-foreground";
  return (
    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted ${color}`}>
      <span className={`${cls} h-4 w-4`} />
    </div>
  );
}

function isErrorDetail(d: unknown): d is { error: string } {
  return typeof d === "object" && d !== null && "error" in (d as object);
}

/** 渲染实体详情 JSON — 递归折叠，关键字段高亮。 */
function DetailView({ detail }: { detail: Record<string, unknown> }): JSX.Element {
  const fqn = (detail as { fullyQualifiedName?: string }).fullyQualifiedName ?? "";
  const desc = (detail as { description?: string }).description;

  return (
    <div className="space-y-4 text-xs">
      {/* 标题 */}
      <div>
        <h3 className="text-sm font-medium">{(detail as { name?: string }).name ?? "实体详情"}</h3>
        {fqn && <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{fqn}</p>}
      </div>

      {/* 描述 */}
      {desc && (
        <p className="rounded-md border border-border/50 bg-muted/30 px-3 py-2 text-[11px] leading-relaxed text-foreground/80">
          {desc}
        </p>
      )}

      {/* 关键信息网格 */}
      <KeyInfoGrid detail={detail} />

      {/* 列信息（表专属） */}
      {Array.isArray((detail as { columns?: unknown[] }).columns) && (detail as { columns?: unknown[] }).columns!.length > 0 && (
        <Section title={`列 (${(detail as { columns: unknown[] }).columns.length})`}>
          <ColumnList columns={(detail as { columns: Array<{ name?: string; dataType?: string; description?: string; constraintType?: string }> }).columns} />
        </Section>
      )}

      {/* 原始 JSON（折叠） */}
      <details className="rounded-md border border-border/50">
        <summary className="cursor-pointer px-3 py-1.5 text-[11px] text-muted-foreground hover:text-foreground">
          原始 JSON
        </summary>
        <pre className="max-h-60 overflow-auto border-t border-border/50 px-3 py-2 text-[10px] text-muted-foreground">
          {JSON.stringify(detail, null, 2).slice(0, 3000)}
        </pre>
      </details>
    </div>
  );
}

function Section({ title, children }: { title: string; children: JSX.Element }): JSX.Element {
  return (
    <section>
      <h4 className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{title}</h4>
      {children}
    </section>
  );
}

function KeyInfoGrid({ detail }: { detail: Record<string, unknown> }): JSX.Element {
  const items: Array<[string, unknown]> = [];
  const add = (key: string, value: unknown) => {
    if (value !== undefined && value !== null && value !== "" && value !== false) items.push([key, value]);
  };
  add("服务", (detail as { serviceType?: string }).serviceType);
  add("类型", (detail as { entityType?: string }).entityType);
  add("Tier", (detail as { tier?: string }).tier);
  add("域名", (detail as { domain?: unknown }).domain ?? (detail as { domainTags?: unknown }).domainTags);
  add("所有者", (detail as { ownerRefs?: Array<{ name?: string }> }).ownerRefs?.map((o) => o.name).join(", "));
  add("标签", (detail as { tags?: Array<{ tagFQN?: string }> }).tags?.map((t) => t.tagFQN).filter(Boolean).join(", "));
  add("已删除", (detail as { deleted?: boolean }).deleted);
  add("数据行数", (detail as { rowCount?: number }).rowCount);
  add("最后更新", (detail as { updatedAt?: number }).updatedAt ? new Date((detail as { updatedAt: number }).updatedAt).toLocaleString() : undefined);

  if (items.length === 0) return <></>;

  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
      {items.map(([key, value]) => (
        <div key={key} className="flex gap-1.5">
          <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground/70">{key}</span>
          <span className="truncate text-[11px] text-foreground/80">
            {typeof value === "boolean" ? (value ? "是" : "否") : String(value)}
          </span>
        </div>
      ))}
    </div>
  );
}

function ColumnList({ columns }: { columns: Array<{ name?: string; dataType?: string; description?: string; constraintType?: string }> }): JSX.Element {
  return (
    <div className="overflow-hidden rounded-md border border-border/50">
      <table className="w-full text-left text-[11px]">
        <thead className="bg-muted/30 text-[10px] uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-2 py-1 font-medium">列名</th>
            <th className="px-2 py-1 font-medium">类型</th>
            <th className="px-2 py-1 font-medium">约束</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/30">
          {columns.slice(0, 20).map((col, i) => (
            <tr key={i}>
              <td className="px-2 py-1 font-mono text-foreground/90">{col.name}</td>
              <td className="px-2 py-1 text-muted-foreground">{col.dataType ?? "-"}</td>
              <td className="px-2 py-1">
                {col.constraintType ? (
                  <span className="rounded bg-muted px-1 text-[10px]">{col.constraintType}</span>
                ) : (
                  <span className="text-muted-foreground/50">-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {columns.length > 20 && (
        <p className="border-t border-border/30 px-2 py-1 text-[10px] text-muted-foreground">
          共 {columns.length} 列，显示前 20 列
        </p>
      )}
    </div>
  );
}
