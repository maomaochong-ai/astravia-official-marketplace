/**
 * 数据质量概览 Activity Tab — 列出 Test Cases 及其最近一次运行状态。
 *
 * OM /v1/dataQuality/testCases 返回 testCase 列表（含 entityFqn + status），
 * /v1/dataQuality/testCases/{id}/testCaseResult 可以拿最近运行结果。
 *
 * 用户交互：
 * - 顶部搜索/过滤（按 entityFqn 模糊匹配 + 按状态筛选）
 * - 卡片列表 — 每个测试用例一张卡片（entity + 测试名 + 状态徽章 + 最近运行时间）
 * - 点击卡片 → 右侧详情面板（最近 5 次运行结果 + 测试定义 + 参数）
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { omRequest, OmProxyError } from "../../../shared/om-services";

type TestCaseStatus = "success" | "failed" | "aborted" | "queued" | "processing" | "none";

interface TestCaseSummary {
  id: string;
  name: string;
  fullyQualifiedName: string;
  entityFqn: string;
  entityType: string;
  testDefinition?: string;
  testSuite?: string;
  description?: string;
  status?: TestCaseStatus;
  lastRunAt?: number;
}

interface TestCasesResponse {
  testCases?: TestCaseSummary[];
  totalCount?: number;
}

const STATUS_STYLES: Record<TestCaseStatus, { bg: string; text: string; icon: string; label: string }> = {
  success:   { bg: "bg-emerald-500/10", text: "text-emerald-600",  icon: "icon-[lucide--check-circle-2]",  label: "通过" },
  failed:    { bg: "bg-red-500/10",     text: "text-red-600",      icon: "icon-[lucide--x-circle]",      label: "失败" },
  aborted:   { bg: "bg-amber-500/10",   text: "text-amber-600",    icon: "icon-[lucide--alert-triangle]", label: "中止" },
  queued:    { bg: "bg-blue-500/10",    text: "text-blue-600",     icon: "icon-[lucide--clock]",          label: "排队中" },
  processing:{ bg: "bg-blue-500/10",    text: "text-blue-600",     icon: "icon-[lucide--loader-2]",       label: "运行中" },
  none:      { bg: "bg-muted",           text: "text-muted-foreground", icon: "icon-[lucide--circle]",      label: "无数据" },
};

export function QualityOverview(): ReactNode {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<TestCaseStatus | "all">("all");
  const [testCases, setTestCases] = useState<TestCaseSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<TestCaseSummary | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // OM 支持 entityFqn 筛选 + status 筛选
      const params = new URLSearchParams({ limit: "50", offset: "0" });
      if (searchQuery.trim()) params.set("entityFQN", searchQuery.trim());
      if (statusFilter !== "all") params.set("testCaseStatus", statusFilter.toUpperCase());
      const resp = await omRequest<TestCasesResponse>(`/dataQuality/testCases?${params.toString()}`);
      setTestCases(resp?.testCases ?? []);
    } catch (e) {
      const err = e as OmProxyError;
      if (err.code === "NO_CONNECTION") {
        setError("未配置 OpenMetadata 连接");
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => { void loadAll(); }, 300);
    return () => clearTimeout(timer);
  }, [loadAll]);

  const loadDetail = useCallback(async (tc: TestCaseSummary) => {
    setSelected(tc);
    setDetail(null);
    setDetailLoading(true);
    try {
      // 拿最近一次运行结果
      const result = await omRequest<any>(`/dataQuality/testCases/${tc.id}/testCaseResult?limit=5`).catch(() => null);
      const def = tc.testDefinition ? await omRequest<any>(`/dataQuality/testDefinitions/${encodeURIComponent(tc.testDefinition)}`).catch(() => null) : null;
      setDetail({ testCase: tc, results: result?.testCaseResults ?? [], definition: def });
    } catch (e) {
      setDetail({ error: (e as OmProxyError).message });
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const stats = useMemo(() => {
    const counts = { success: 0, failed: 0, aborted: 0, processing: 0, queued: 0, none: 0 };
    for (const tc of testCases) {
      const s = tc.status ?? "none";
      counts[s as TestCaseStatus] += 1;
    }
    return counts;
  }, [testCases]);

  return (
    <div
      data-astravia-plugin-root="openmetadata"
      className="om-root flex h-full w-full min-h-0 flex-col bg-background text-foreground"
      style={{ contain: "layout style paint" }}
    >
      {/* 顶部工具栏 */}
      <header className="flex shrink-0 items-center gap-3 border-b border-border/50 px-4 py-3">
        <span className="icon-[lucide--shield-check] h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="按实体 FQN 筛选..."
          className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as TestCaseStatus | "all")}
          className="shrink-0 rounded-md border border-input bg-background px-2 py-1.5 text-xs"
        >
          <option value="all">全部状态</option>
          <option value="success">通过</option>
          <option value="failed">失败</option>
          <option value="aborted">中止</option>
          <option value="none">无数据</option>
        </select>
        <button
          type="button"
          onClick={() => void loadAll()}
          className="shrink-0 rounded-md border border-input px-2 py-1.5 text-xs hover:bg-muted/50"
          title="刷新"
        >
          🔄
        </button>
      </header>

      {/* 统计摘要 */}
      {testCases.length > 0 && (
        <div className="shrink-0 border-b border-border/50 bg-muted/20 px-4 py-2">
          <div className="flex flex-wrap items-center gap-3 text-[11px]">
            <span className="text-muted-foreground">共 {testCases.length} 个测试用例</span>
            <StatChip count={stats.success}   label="通过" color="text-emerald-600" />
            <StatChip count={stats.failed}    label="失败" color="text-red-600" />
            <StatChip count={stats.aborted}   label="中止" color="text-amber-600" />
            <StatChip count={stats.none}      label="无数据" color="text-muted-foreground" />
          </div>
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
        {/* 列表 */}
        <div className={`min-h-0 overflow-y-auto p-3 ${selected ? "w-1/2 border-r border-border/50" : "w-full"}`}>
          {loading && testCases.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
              <span className="icon-[lucide--loader-2] h-4 w-4 animate-spin" />
              加载中...
            </div>
          )}
          {!loading && !error && testCases.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
              <span className="icon-[lucide--shield-alert] h-10 w-10 opacity-40" />
              <p className="text-sm">暂无数据质量测试用例</p>
              <p className="text-[11px] text-muted-foreground/70">在 OM 中创建 test cases 后会在此显示</p>
            </div>
          )}

          <ul className="space-y-1.5">
            {testCases.map((tc) => {
              const status = tc.status ?? "none";
              const style = STATUS_STYLES[status];
              return (
                <li key={tc.id}>
                  <button
                    type="button"
                    onClick={() => void loadDetail(tc)}
                    className={`flex w-full items-start gap-3 rounded-md border px-3 py-2 text-left transition-colors ${
                      selected?.id === tc.id ? "border-primary/60 bg-primary/5" : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <div className={`shrink-0 rounded-md px-2 py-0.5 ${style.bg} ${style.text}`}>
                      <span className={`${style.icon} h-3 w-3 inline-block`} />
                      <span className="ml-1 text-[10px] font-medium">{style.label}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{tc.name}</span>
                      </div>
                      <div className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
                        {tc.entityFqn}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground/70">
                        {tc.testDefinition && <span>{tc.testDefinition}</span>}
                        {tc.lastRunAt && <span>· {new Date(tc.lastRunAt).toLocaleString()}</span>}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* 详情 */}
        {selected && (
          <aside className="min-h-0 w-1/2 overflow-y-auto p-4 text-xs">
            {detailLoading && (
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <span className="icon-[lucide--loader-2] h-4 w-4 animate-spin" />
                加载详情...
              </div>
            )}
            {!detailLoading && detail && !detail.error && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium">{detail.testCase?.name}</h4>
                {detail.testCase?.description && (
                  <p className="rounded-md border border-border/50 bg-muted/30 p-2 text-[11px] leading-relaxed text-foreground/80">
                    {detail.testCase.description}
                  </p>
                )}

                {/* 最近运行结果表格 */}
                <Section title={`最近运行 (${detail.results?.length ?? 0})`}>
                  {!detail.results?.length && (
                    <p className="text-[11px] text-muted-foreground">暂无运行记录</p>
                  )}
                  {detail.results?.length > 0 && (
                    <div className="overflow-hidden rounded-md border border-border/50">
                      <table className="w-full text-[11px]">
                        <thead className="bg-muted/30 text-muted-foreground">
                          <tr>
                            <th className="px-2 py-1 text-left font-medium">状态</th>
                            <th className="px-2 py-1 text-left font-medium">开始时间</th>
                            <th className="px-2 py-1 text-left font-medium">耗时(ms)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                          {detail.results.map((r: any, i: number) => (
                            <tr key={i}>
                              <td className="px-2 py-1">
                                <StatusBadge status={r.testCaseStatus ?? "none"} />
                              </td>
                              <td className="px-2 py-1 font-mono text-[10px]">
                                {r.startTimestamp ? new Date(r.startTimestamp).toLocaleString() : "-"}
                              </td>
                              <td className="px-2 py-1">{r.duration ?? "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Section>

                {/* 原始 JSON */}
                <details className="rounded-md border border-border/50">
                  <summary className="cursor-pointer px-3 py-1.5 text-[11px] text-muted-foreground hover:text-foreground">
                    原始 JSON
                  </summary>
                  <pre className="max-h-60 overflow-auto border-t border-border/50 px-3 py-2 text-[10px] text-muted-foreground">
                    {JSON.stringify(detail, null, 2).slice(0, 3000)}
                  </pre>
                </details>
              </div>
            )}
            {!detailLoading && detail && detail.error && (
              <div className="text-destructive">{detail.error}</div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}

function StatChip({ count, label, color }: { count: number; label: string; color: string }): ReactNode {
  if (count === 0) return null;
  return (
    <span className={`flex items-center gap-1 ${color}`}>
      <span className="rounded-sm bg-current/10 px-1 font-mono">{count}</span>
      <span>{label}</span>
    </span>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }): ReactNode {
  return (
    <section>
      <h5 className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{title}</h5>
      {children}
    </section>
  );
}

function StatusBadge({ status }: { status: string }): ReactNode {
  const s = (status ?? "none").toLowerCase() as TestCaseStatus;
  const style = STATUS_STYLES[s] ?? STATUS_STYLES.none;
  return (
    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 ${style.bg} ${style.text}`}>
      <span className={`${style.icon} h-2.5 w-2.5`} />
      <span className="text-[10px] font-medium">{style.label}</span>
    </span>
  );
}
