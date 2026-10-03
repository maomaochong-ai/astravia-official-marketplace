/**
 * 连接池：按「连接身份」复用驱动句柄。
 *
 * 之所以需要它：引擎是常驻进程，而 UI 每一句 SQL 都是一次 HTTP 请求；
 * 不复用就变成每次查询重开一次数据库文件（SQLite 会很慢，远程库更甚）。
 *
 * 约定：
 * - key 由调用方给出（见 request-router.mjs 的 poolKeyFor），**不含明文口令**；
 * - 句柄在 driver 报错时被**丢弃并关闭**（半开连接不能留）；
 * - 空闲超过 idleTtlMs 由 reap() 回收；进程退出走 closeAll()。
 */

import { engineError, isEngineError } from "./protocol.mjs";

export class ConnectionPool {
  constructor({ idleTtlMs = 300_000, now = () => Date.now() } = {}) {
    this.idleTtlMs = idleTtlMs;
    this.now = now;
    /** @type {Map<string, {handle: unknown, lastUsed: number}>} */
    this.entries = new Map();
    /** @type {Map<string, Promise<unknown>>} */
    this.pending = new Map();
    this.invalidations = 0;
  }

  /**
   * 借出句柄。openHandle 由调用方提供（通常是 `() => driver.acquire(spec)`），
   * 池只负责身份复用与生命周期，不依赖驱动契约。
   */
  async acquire(key, openHandle) {
    const existing = this.entries.get(key);
    if (existing) {
      existing.lastUsed = this.now();
      return existing.handle;
    }
    const inflight = this.pending.get(key);
    if (inflight) return inflight;

    const opening = (async () => {
      try {
        const handle = await openHandle();
        this.entries.set(key, { handle, lastUsed: this.now() });
        return handle;
      } catch (error) {
        if (isEngineError(error)) throw error;
        throw engineError("CONNECTION_ERROR", error instanceof Error ? error.message : String(error));
      } finally {
        this.pending.delete(key);
      }
    })();
    this.pending.set(key, opening);
    return opening;
  }

  /**
   * 借出句柄执行 fn。**任何**抛出都会让该连接失效
   * （网络抖动或语法错误之后，句柄状态已不可信）。
   */
  async withConnection(key, openHandle, fn) {
    const handle = await this.acquire(key, openHandle);
    try {
      const result = await fn(handle);
      const entry = this.entries.get(key);
      if (entry) entry.lastUsed = this.now();
      return result;
    } catch (error) {
      await this.invalidate(key);
      throw error;
    }
  }

  async invalidate(key) {
    const entry = this.entries.get(key);
    if (!entry) return;
    this.entries.delete(key);
    this.invalidations += 1;
    try {
      await entry.handle.close();
    } catch {
      // 关闭失败不影响调用方：句柄已从池中移除。
    }
  }

  async reap() {
    const deadline = this.now() - this.idleTtlMs;
    for (const [key, entry] of [...this.entries]) {
      if (entry.lastUsed <= deadline) await this.invalidate(key);
    }
  }

  async closeAll() {
    const keys = [...this.entries.keys()];
    for (const key of keys) await this.invalidate(key);
    this.pending.clear();
  }

  stats() {
    const now = this.now();
    return {
      size: this.entries.size,
      invalidations: this.invalidations,
      connections: [...this.entries.entries()].map(([key, entry]) => ({
        // key 是 8 位摘要，不含任何凭据，可安全回给 UI 做诊断
        key: key.slice(0, 8),
        idleMs: now - entry.lastUsed,
      })),
    };
  }
}
