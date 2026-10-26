#!/usr/bin/env node
/**
 * 守 ADR-0015 的两条半：渠道模型的 payload 形状，与读回目录的分类。
 *
 * 为什么需要它：画布创作页只认「启用的渠道 + 启用的渠道模型 + 可解析的能力配置 +
 * 至少一个有效价格档」。这四件事里任何一件写错，画布只是**看不见那个模型**，不会报错——
 * 上一次用户点了按钮、插件回「已创建渠道」，画布却是空的，就是这类静默失败。
 * payload 是纯数据，可以离线断言；读回分类是纯函数，可以离线断言。
 * 剩下的（真写进 SQLite、真被目录读出来）本机没有登录会话，跑不了，不在这里假装。
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const failures = [];
const checks = [];
function check(name, condition, detail) {
  checks.push(name);
  if (condition) {
    console.log(`PASS  ${name}${detail ? `  — ${detail}` : ""}`);
  } else {
    failures.push(name);
    console.log(`FAIL  ${name}${detail ? `  — ${detail}` : ""}`);
  }
}

async function loadModule(entry, outfile) {
  await build({
    entryPoints: [join(ROOT, entry)],
    outfile,
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node22",
    logLevel: "silent",
  });
  return import(`file://${outfile}`);
}

const scratch = mkdtempSync(join(tmpdir(), "verify-channel-projection-"));
const projection = await loadModule(
  "src/features/canvas-workspace/channel-projection.ts",
  join(scratch, "channel-projection.mjs"),
);

const HOST_MODELS = [
  { modelKey: "gpt-5", name: "GPT-5", input: ["text", "image"], contextWindow: 400_000, maxTokens: 128_000 },
  { modelKey: "gpt-5", name: "GPT-5 duplicate", input: ["text"], contextWindow: 400_000, maxTokens: 128_000 },
  { modelKey: "gpt-image-1", name: "GPT Image", input: ["image"], contextWindow: 0, maxTokens: 0 },
  { modelKey: "  claude-sonnet  ", input: ["text"], contextWindow: 200_000, maxTokens: 64_000 },
  { modelKey: "tiny", input: ["text"], contextWindow: 1024, maxTokens: 900_000 },
  { modelKey: "", input: ["text"], contextWindow: 8192, maxTokens: 1024 },
];

const selected = projection.selectBridgeTextModels(HOST_MODELS);
check(
  "只选带 text 输入的模型",
  selected.map((model) => model.modelKey).join(",") === "gpt-5,claude-sonnet,tiny",
  selected.map((model) => model.modelKey).join(","),
);
check("同一个 modelKey 只出一条", selected.filter((model) => model.modelKey === "gpt-5").length === 1);
check(
  "modelKey 去空白，缺 name 时退回 modelKey",
  selected[1].modelKey === "claude-sonnet" && selected[1].displayName === "claude-sonnet",
);
check("有 name 时用它当显示名", selected[0].displayName === "GPT-5");

const payload = projection.bridgeChannelModelPayload(selected[0]);
check("能力固定为 text", payload.capability === "text");
check("协议固定为 chat-completion", payload.protocol === "chat-completion", payload.protocol);
check("渠道模型必须启用", payload.enabled === true);
check("计费模式是免费固定价", payload.billingMode === "fixed_request" && payload.unitPriceMicrocredits === 0);
check("价格已配置（否则 available 为 false）", payload.priceConfigured === true);
check(
  "不手写 priceTiers，交给上游按顶层字段生成默认档",
  !("priceTiers" in payload),
  Object.keys(payload).join(","),
);
check(
  "promptMaxChars 必须 >= 1",
  payload.capabilityConfig.text.references.promptMaxChars >= 1,
  String(payload.capabilityConfig.text.references.promptMaxChars),
);
check("providerModelKey 与 modelKey 一致（同一个上游模型）", payload.providerModelKey === payload.modelKey);
check("channelLabel 有值（画布目录按它分组）", payload.channelLabel === "Astravia");

for (const model of selected) {
  const config = projection.bridgeChannelModelPayload(model).capabilityConfig.text;
  const inRange = config.contextWindowTokens >= 4096 && config.contextWindowTokens <= 10_000_000;
  const outputOk = config.maxOutputTokens >= 256 && config.maxOutputTokens < config.contextWindowTokens;
  check(
    `${model.modelKey} 的能力参数落在画布校验区间内`,
    inRange && outputOk,
    `ctx ${config.contextWindowTokens}, out ${config.maxOutputTokens}`,
  );
}

const channel = projection.bridgeChannelPayload("http://127.0.0.1:51234/", "token-value");
check("渠道名带 astravia-bridge- 前缀（用于认领）", channel.name.startsWith(projection.BRIDGE_CHANNEL_PREFIX));
check("渠道指向 shim 的 /bridge/v1", channel.baseUrl === "http://127.0.0.1:51234/bridge/v1", channel.baseUrl);
check("建渠道时不带 models（带它会建出禁用行）", Array.isArray(channel.models) && channel.models.length === 0);
check("渠道启用", channel.enabled === true);

const catalog = {
  data: {
    channels: [
      {
        id: "ch-1",
        name: "",
        models: [
          { modelKey: "usable", capability: "text", available: true, capabilityConfig: { version: 1, text: {} } },
          { modelKey: "blocked", capability: "text", available: false, capabilityConfig: { version: 1, text: {} } },
          { modelKey: "bare", capability: "text", available: true },
          { modelKey: "picture", capability: "image", available: true, capabilityConfig: { version: 1, image: {} } },
        ],
      },
    ],
  },
};
const report = projection.classifyProjection(catalog, "ch-1", ["usable", "blocked", "bare", "picture", "ghost"]);
check("读回能认出自家渠道", report.channelFound === true);
check("available + 有文本能力配置才算可用", report.usable.join(",") === "usable", report.usable.join(","));
check(
  "available:false 归为 blocked(unavailable)",
  report.blocked.some((item) => item.modelKey === "blocked" && item.reason === "unavailable"),
);
check(
  "缺 capabilityConfig.text 归为 blocked(no-capability)",
  report.blocked.some((item) => item.modelKey === "bare" && item.reason === "no-capability"),
);
check(
  "非文本能力归为 blocked(not-text)",
  report.blocked.some((item) => item.modelKey === "picture" && item.reason === "not-text"),
);
check("目录里没有的归为 missing", report.missing.join(",") === "ghost", report.missing.join(","));

const absent = projection.classifyProjection({ channels: [{ id: "other", models: [] }] }, "ch-1", ["usable"]);
check(
  "渠道不在目录里时全部算 missing 且 channelFound 为 false",
  absent.channelFound === false && absent.missing.join(",") === "usable",
);
check(
  "同时支持 data.channels 与 channels 两种信封",
  projection.classifyProjection({ channels: catalog.data.channels }, "ch-1", ["usable"]).usable.length === 1,
);

check(
  "陈旧条目只在本渠道内计算",
  projection.staleChannelModelKeys(["a", "b", "c"], ["b"]).join(",") === "a,c",
  projection.staleChannelModelKeys(["a", "b", "c"], ["b"]).join(","),
);

if (failures.length > 0) {
  console.error(`\n[verify-channel-projection] ${failures.length} 个问题：`);
  for (const name of failures) console.error(`  - ${name}`);
  process.exit(1);
}
console.log(`\n[verify-channel-projection] ok: ${checks.length} 项（渠道模型 payload 与目录读回分类）`);
