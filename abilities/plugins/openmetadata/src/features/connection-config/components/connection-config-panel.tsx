/**
 * OpenMetadata 连接配置面板 — Workspace View。
 *
 * 从宿主侧边栏打开的整页面板，管理 OM 实例连接：
 * - 连接列表（名称 + 服务地址 + 健康状态）
 * - 新增连接表单（Server URL + API Token + 连接测试）
 * - 编辑/删除连接
 *
 * 设计遵循 dbx-pro ConnectionManagerView 的模式：
 * - 插件根容器带 data-astravia-plugin-root + contain 属性
 * - 只用 Tailwind 工具类，不引入额外 UI 组件库
 * - 连接测试直接 fetch OM /v1/users/current（不走代理，因为代理还没配好）
 */

import { useCallback, useEffect, useState, type JSX } from "react";
import { getConnectionStore, type OmConnection } from "../../../domain/connection-store";

export function ConnectionConfigPanel(): JSX.Element {
  const [connections, setConnections] = useState<OmConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", serverUrl: "", token: "" });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getConnectionStore().list();
      setConnections(list);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  function openAdd() {
    setEditingId(null);
    setForm({ name: "", serverUrl: "", token: "" });
    setShowForm(true);
    setTestResult(null);
  }

  function openEdit(conn: OmConnection) {
    setEditingId(conn.id);
    setForm({ name: conn.name, serverUrl: conn.serverUrl, token: conn.token });
    setShowForm(true);
    setTestResult(null);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setError(null);
    setTestResult(null);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.serverUrl.trim() || !form.token.trim()) {
      setError("名称、服务地址和 API Token 都是必填项");
      return;
    }
    try {
      const store = getConnectionStore();
      if (editingId) {
        await store.update(editingId, form);
      } else {
        await store.add(form);
      }
      closeForm();
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleDelete(id: string) {
    try {
      await getConnectionStore().remove(id);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await getConnectionStore().testConnection(form.serverUrl, form.token);
      setTestResult(result);
    } finally {
      setTesting(false);
    }
  }

  return (
    <div
      data-astravia-plugin-root="openmetadata"
      className="om-root h-full min-h-0 overflow-y-auto bg-background text-foreground"
      style={{ contain: "layout style paint" }}
    >
      <div className="mx-auto max-w-2xl px-5 py-6">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-border/50 pb-5">
          <div>
            <h1 className="text-base font-semibold">OpenMetadata 连接</h1>
            <p className="mt-1 text-xs text-muted-foreground">管理要连接的 OpenMetadata 数据目录实例</p>
          </div>
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
          >
            <span className="icon-[lucide--plus] h-3.5 w-3.5" />
            添加连接
          </button>
        </header>

        {error && (
          <div className="mt-4 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        {/* 连接列表 */}
        <section className="mt-5 space-y-2">
          {loading && (
            <div className="text-center text-xs text-muted-foreground py-8">加载中...</div>
          )}
          {!loading && connections.length === 0 && !showForm && (
            <div className="rounded-lg border border-dashed border-border/50 py-10 text-center">
              <span className="icon-[lucide--database] mx-auto block h-8 w-8 text-muted-foreground/40" />
              <p className="mt-2 text-xs text-muted-foreground">暂无连接，点击上方按钮添加第一个</p>
            </div>
          )}
          {!loading && connections.map((conn) => (
            <ConnectionCard
              key={conn.id}
              conn={conn}
              onEdit={() => openEdit(conn)}
              onDelete={() => handleDelete(conn.id)}
            />
          ))}
        </section>

        {/* 新增/编辑表单 */}
        {showForm && (
          <section className="mt-6 rounded-lg border border-border p-4">
            <h2 className="text-sm font-medium">{editingId ? "编辑连接" : "添加连接"}</h2>

            <div className="mt-3 space-y-3">
              <Field label="连接名称" required>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="如：生产元数据中心"
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </Field>

              <Field label="OpenMetadata 服务地址" required>
                <input
                  type="url"
                  value={form.serverUrl}
                  onChange={(e) => setForm((f) => ({ ...f, serverUrl: e.target.value }))}
                  placeholder="https://metadata.yourcompany.com"
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <p className="mt-1 text-[10px] text-muted-foreground">OM 实例根地址，不需要 /v1 后缀</p>
              </Field>

              <Field label="API Token (JWT)" required>
                <input
                  type="password"
                  value={form.token}
                  onChange={(e) => setForm((f) => ({ ...f, token: e.target.value }))}
                  placeholder="eyJhbGciOi..."
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <p className="mt-1 text-[10px] text-muted-foreground">在 OM → Settings → Bots 生成 Bot Token，或使用个人 API Token</p>
              </Field>
            </div>

            {/* 连接测试 */}
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={handleTest}
                disabled={testing || !form.serverUrl || !form.token}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-50"
              >
                <span className="icon-[lucide--wifi] h-3 w-3" />
                {testing ? "测试中..." : "测试连接"}
              </button>
              {testResult && (
                <span className={`text-[11px] ${testResult.ok ? "text-emerald-600" : "text-destructive"}`}>
                  {testResult.ok ? "✓ 连接成功" : `✗ ${testResult.message ?? "连接失败"}`}
                </span>
              )}
            </div>

            {/* 操作按钮 */}
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeForm}
                className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
              >
                {editingId ? "保存" : "添加"}
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: JSX.Element }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-foreground">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </span>
      {children}
    </label>
  );
}

function ConnectionCard({
  conn,
  onEdit,
  onDelete,
}: {
  conn: OmConnection;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border p-3 hover:border-border/80">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
          <span className="icon-[lucide--database] h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{conn.name}</p>
          <p className="truncate text-xs text-muted-foreground">{conn.serverUrl}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onEdit}
          className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          title="编辑"
        >
          <span className="icon-[lucide--pencil] h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          title="删除"
        >
          <span className="icon-[lucide--trash-2] h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
