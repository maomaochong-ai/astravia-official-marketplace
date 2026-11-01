import type { PluginCaptureApi } from "@astravia-org/plugin-sdk";
import { loginSignal, normalizeExtraction, normalizeValues, type Adapter, type AdapterExtraction } from "../domain/adapter";

const RUN_TIMEOUT_MS = 25_000;
const VIEWPORT = { width: 1280, height: 720 };

/** A run that produced no usable extraction. `detail` keeps the page-side message for the UI. */
export class AdapterRunError extends Error {
  constructor(
    message: string,
    readonly detail = "",
    /** Bitmap of the offscreen page at failure time: a login wall is a picture, not a string. */
    readonly screenshot = "",
    /** Set when the page wanted a human: the window stays open so the retry lands on the same page. */
    readonly loginRequired = false,
  ) {
    super(message);
    this.name = "AdapterRunError";
  }
}

interface AdapterEnvelope {
  ok?: unknown;
  value?: unknown;
  values?: unknown;
  error?: unknown;
}

/**
 * The page-side half of the contract: the Adapter's own function, a tiny `GM_*` value bridge backed
 * by the injected snapshot, and one result object the probe can read synchronously.
 *
 * `readyExpression` waits for `__astraviaDone` instead of awaiting inside the probe, because the
 * probe is evaluated synchronously: an `async` probe would stringify to `{}`.
 */
function prepareScriptFor(adapter: Adapter, values: Record<string, unknown>): string {
  return `(() => {
  window.__astraviaValues = ${JSON.stringify(values)};
  window.__astraviaResult = { ok: false, error: "适配器没有返回结果" };
  window.__astraviaDone = false;
  window.GM_getValue = (key, fallback) => Object.prototype.hasOwnProperty.call(window.__astraviaValues, key) ? window.__astraviaValues[key] : fallback;
  window.GM_setValue = (key, value) => { window.__astraviaValues[key] = value; };
  window.GM_deleteValue = (key) => { delete window.__astraviaValues[key]; };
  window.GM_listValues = () => Object.keys(window.__astraviaValues);
  window.GM_info = ${JSON.stringify({ script: { name: adapter.meta.name, version: adapter.meta.version } })};
  (async () => {
    try {
      const adapter = (${adapter.body});
      const value = await adapter({ url: location.href, document, window, fetch: window.fetch.bind(window) });
      window.__astraviaResult = { ok: true, value, values: window.__astraviaValues };
    } catch (error) {
      window.__astraviaResult = { ok: false, error: String((error && error.message) || error) };
    } finally {
      window.__astraviaDone = true;
    }
  })();
})();`;
}

function readEnvelope(probe: unknown): AdapterEnvelope | null {
  if (typeof probe === "string") {
    try {
      const parsed = JSON.parse(probe) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as AdapterEnvelope) : null;
    } catch {
      return null;
    }
  }
  return probe && typeof probe === "object" && !Array.isArray(probe) ? (probe as AdapterEnvelope) : null;
}

function timeoutMessage(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  return /timeout|timed out|超时/iu.test(text) ? "页面加载超时，站点可能拒绝了离屏访问" : text;
}

/**
 * Runs one Adapter against one page. The caller is responsible for having checked `@match` first:
 * this function does not decide which sites an Adapter may touch.
 */
export async function runAdapter(
  capture: PluginCaptureApi,
  adapter: Adapter,
  url: string,
  values: Record<string, unknown>,
): Promise<{ extraction: AdapterExtraction; values: Record<string, unknown> }> {
  const sessionKey = `adapter:${adapter.id}`;
  let screenshot = "";
  let keepWindow = false;
  try {
    const result = await capture.offscreen({
      url,
      ...VIEWPORT,
      sessionKey,
      prepareScript: prepareScriptFor(adapter, values),
      readyExpression: "window.__astraviaDone === true",
      probeScript: "JSON.stringify(window.__astraviaResult)",
      settleMs: 120,
      timeoutMs: RUN_TIMEOUT_MS,
    });
    screenshot = result.dataUrl || "";
    const envelope = readEnvelope(result.probe);
    if (!envelope) throw new AdapterRunError("页面没有回传结果", "probe 为空或不可序列化", screenshot);
    if (envelope.ok !== true) {
      const signal = loginSignal(typeof envelope.error === "string" ? envelope.error : "");
      if (signal.required) {
        // Releasing here would drop the page (and its cookies) the user is about to sign in on.
        keepWindow = true;
        throw new AdapterRunError(signal.message, "", screenshot, true);
      }
      throw new AdapterRunError("适配器执行失败", signal.message, screenshot);
    }
    const extraction = normalizeExtraction(envelope.value);
    if (!extraction) {
      throw new AdapterRunError(
        "适配器没有给出可播地址",
        "directUrl 缺失或不是 http(s) 链接，也没有标记 metadataOnly",
        screenshot,
      );
    }
    return { extraction, values: normalizeValues(envelope.values) };
  } catch (error) {
    if (error instanceof AdapterRunError) throw error;
    throw new AdapterRunError(timeoutMessage(error), error instanceof Error ? error.message : "", screenshot);
  } finally {
    if (!keepWindow) await capture.releaseOffscreen(sessionKey).catch(() => undefined);
  }
}
