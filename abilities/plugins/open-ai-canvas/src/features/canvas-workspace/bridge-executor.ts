/**
 * 模型桥：执行侧（ADR-0006 决策 1）。
 *
 * shim 收到画布的 chat 请求后只做一件事——入队；真正的推理发生在这里，用宿主的
 * `ctx.ai`。宿主的 provider 密钥不会进入本进程，画布自然也看不到它。
 *
 * 为什么需要这一层：能监听端口的 shim 没有 `ctx`，有 `ctx.ai` 的渲染进程不能监听端口。
 * 长轮询把这两半拼起来，代价是「插件必须处于激活状态」，关掉插件桥就断——这类失败
 * 由 shim 回 503 `bridge-executor-offline`，不伪装成模型报错。
 */
import { SERVICE_ID } from "../../runtime-contract";
import type { PluginContext } from "../../runtime-contract";

/** 宿主 `services.request` 上限 5 分钟，长轮询留在 30 秒内，避免和它的超时打架。 */
const POLL_TIMEOUT_MS = 30_000;
/** 增量合流间隔：逐 token 回传会产生几十倍的无用小请求。 */
const CHUNK_FLUSH_MS = 120;
/** 桥还没建好 / 后端在重启时的退避。 */
const RETRY_DELAY_MS = 3_000;
const TOKEN_PATH = "bridge.json";

interface BridgeJob {
  id: string;
  model?: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 把 OpenAI 风格的 messages 压成 `ctx.ai` 能吃的形状。
 *
 * SDK 的 `stream()` 只接受 systemPrompt + 单条 prompt（没有 messages 数组，也没有
 * 图片输入），所以这里做两件事：system 合并成 systemPrompt，历史拍平成文本前缀。
 * 图片输入在 shim 侧就被拒了（`bridge-vision-unsupported`），不会走到这里。
 */
function toAiRequest(job: BridgeJob): { systemPrompt?: string; prompt: string } {
  const system: string[] = [];
  const turns: string[] = [];
  for (const message of job.messages) {
    if (message.role === "system") {
      system.push(message.content);
      continue;
    }
    turns.push(`${message.role === "assistant" ? "Assistant" : "User"}: ${message.content}`);
  }
  const prompt = turns.length > 0 ? turns[turns.length - 1].replace(/^(User|Assistant): /, "") : "";
  const history = turns.slice(0, -1);
  const systemPrompt = [system.join("\n\n"), history.length > 0 ? `之前对话：\n${history.join("\n")}` : ""]
    .filter(Boolean)
    .join("\n\n");
  return { ...(systemPrompt ? { systemPrompt } : {}), prompt };
}

export class BridgeExecutor {
  private readonly ctx: PluginContext;
  private stopped = false;
  private token: string | undefined;
  private modelsSignature = "";
  private activeStream: AbortController | undefined;

  constructor(ctx: PluginContext) {
    this.ctx = ctx;
  }

  start(): void {
    void this.loop();
  }

  stop(): void {
    this.stopped = true;
    this.activeStream?.abort();
  }

  private async loop(): Promise<void> {
    while (!this.stopped) {
      try {
        await this.tick();
      } catch {
        // 服务重启、宿主换端口、桥还没建好：都不该把循环打死。
        await delay(RETRY_DELAY_MS);
      }
    }
  }

  /** shim 启动时把 token 写进服务数据目录；这一步本身就是「插件被授权」的凭据。 */
  private async ensureToken(): Promise<string | undefined> {
    if (this.token) return this.token;
    const raw = await this.ctx.services.readDataFile(SERVICE_ID, TOKEN_PATH).catch(() => null);
    if (!raw) return undefined;
    try {
      const parsed = JSON.parse(raw) as { token?: string };
      if (typeof parsed.token === "string" && parsed.token.length >= 32) this.token = parsed.token;
    } catch {
      // 文件被写坏：当作还没有 token，等 shim 重写。
    }
    return this.token;
  }

  private async tick(): Promise<void> {
    const token = await this.ensureToken();
    if (!token) {
      await delay(RETRY_DELAY_MS);
      return;
    }
    await this.publishModels(token);

    const response = await this.ctx.services.request<{ jobs?: BridgeJob[] }>(SERVICE_ID, {
      path: "/bridge/jobs",
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      timeoutMs: POLL_TIMEOUT_MS,
    });
    if (!response.ok) return;
    for (const job of response.body?.jobs ?? []) {
      if (this.stopped) return;
      await this.execute(job, token);
    }
  }

  /** 画布的模型下拉只认渠道里登记的 id，所以宿主有哪些文本模型要主动推过去。 */
  private async publishModels(token: string): Promise<void> {
    const list = await this.ctx.ai.listModels().catch(() => undefined);
    if (!list) return;
    const models = list.models
      .filter((model) => model.input.includes("text"))
      .map((model) => ({ id: model.modelKey, name: model.name, provider: model.provider }));
    const signature = models.map((model) => model.id).join(",");
    if (signature === this.modelsSignature) return;
    const response = await this.ctx.services
      .request(SERVICE_ID, {
        path: "/bridge/models",
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: { models },
      })
      .catch(() => undefined);
    if (response?.ok) this.modelsSignature = signature;
  }

  private async postJobCommand(
    token: string,
    jobId: string,
    action: "chunk" | "done",
    body: unknown,
  ): Promise<boolean> {
    const response = await this.ctx.services
      .request(SERVICE_ID, {
        path: `/bridge/jobs/${jobId}/${action}`,
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body,
      })
      .catch(() => undefined);
    // 404 表示画布那头已经断开、任务被回收：停止继续烧 token。
    return Boolean(response?.ok);
  }

  private async execute(job: BridgeJob, token: string): Promise<void> {
    const controller = new AbortController();
    this.activeStream = controller;
    let buffer = "";
    let lastFlush = 0;
    let flushChain: Promise<boolean> = Promise.resolve(true);

    const flush = (): void => {
      if (buffer.length === 0) return;
      const delta = buffer;
      buffer = "";
      flushChain = flushChain.then(() => this.postJobCommand(token, job.id, "chunk", { delta }));
    };

    try {
      const request = toAiRequest(job);
      const result = await this.ctx.ai.stream(
        {
          ...(job.model ? { modelKey: job.model } : {}),
          ...(request.systemPrompt ? { systemPrompt: request.systemPrompt } : {}),
          prompt: request.prompt,
          ...(job.temperature !== undefined ? { temperature: job.temperature } : {}),
          ...(job.max_tokens !== undefined ? { maxTokens: job.max_tokens } : {}),
        },
        {
          signal: controller.signal,
          onTextDelta: ({ delta }) => {
            buffer += delta;
            if (Date.now() - lastFlush < CHUNK_FLUSH_MS) return;
            lastFlush = Date.now();
            flush();
          },
        },
      );
      flush();
      const delivered = await flushChain;
      if (!delivered) return;
      // 空 body 即「正常结束」；失败走下面的 error 分支。
      await this.postJobCommand(token, job.id, "done", {});
    } catch (error) {
      if (controller.signal.aborted) return;
      flush();
      await flushChain;
      await this.postJobCommand(token, job.id, "done", {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.activeStream = undefined;
    }
  }
}

