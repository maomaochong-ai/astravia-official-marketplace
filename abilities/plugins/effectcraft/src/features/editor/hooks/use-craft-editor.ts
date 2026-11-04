import type { PluginContext } from "@astravia-org/plugin-sdk";
import { useActivityTab } from "@astravia-org/plugin-sdk";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { isBootFailure, isLinkMessage, isProgressMessage, nextDowngrade } from "../../../domain/link-protocol.ts";
import type { Downgrade } from "../../../domain/link-protocol.ts";
import { buildSiteDocument, siteRoot } from "../services/site-document.ts";
import { APP } from "../../../app.config.ts";
import { editorStrings } from "../strings.ts";
import type { EditorStrings } from "../strings.ts";
import { publishCraftProgress, setCraftFrame, settleCraftReply, subscribeCraftProgress } from "../session-registry.ts";
import { readWorkspaceFile, saveRenderedFile, selectionAccess } from "../services/workspace-files.ts";
import type { WorkspaceFile } from "../services/workspace-files.ts";
import { useContainerFullscreen } from "./use-container-fullscreen.ts";

export type EditorPhase = "starting" | "ready" | "failed";

export interface EditorSession {
  strings: EditorStrings;
  phase: EditorPhase;
  backend: string;
  binding: WorkspaceFile | null;
  candidate: WorkspaceFile | null;
  savedAt: number | null;
  notice: string | null;
  /** "2/5 · 点击渐变工具" while an Agent batch runs in the page; null when idle. */
  progress: string | null;
  /** Upstream's page as an inline document; null until the package file is read. */
  iframeDoc: string | null;
  iframeKey: string;
  frameRef: RefObject<HTMLIFrameElement | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  isFullscreen: boolean;
  overlay: boolean;
  toggleFullscreen: () => void;
  reload: () => void;
}

/**
 * Everything the tab does that is not markup: read the package's site, speak the
 * bridge protocol, keep the save binding, walk the WebGPU → WebGL2 → software
 * ladder, and
 * surface the step an Agent batch is on.
 *
 * Upstream's own retry is a `location.replace` to `?webgl`, which works here because
 * the frame document is given a real URL; this ladder only steps in when the page
 * never reports anything at all.
 */
export function useCraftEditor(ctx: PluginContext): EditorSession {
  const strings = editorStrings(ctx.i18n.locale);
  // The host keeps this document alive while its tab is hidden (display:none) so that
  // unsaved work survives a tab switch. Nothing on this side spins at 60 fps for a
  // page nobody is looking at: the bridge holds the app's next frame instead.
  // `active` defaults to false when the host provides no context, so a build that
  // predates the hook never pauses a live editor — we only pause after seeing active.
  const tab = useActivityTab();
  const everActive = useRef(false);
  if (tab.active) everActive.current = true;
  const paused = everActive.current && !tab.active;
  const uiLang: "zh" | "en" = /^zh/i.test(ctx.i18n.locale || "") ? "zh" : "en";
  const [baseUrl, setBaseUrl] = useState<string | null>(null);
  const [iframeDoc, setIframeDoc] = useState<string | null>(null);
  const [phase, setPhase] = useState<EditorPhase>("starting");
  const [backend, setBackend] = useState("");
  const [binding, setBinding] = useState<WorkspaceFile | null>(null);
  const [candidate, setCandidate] = useState<WorkspaceFile | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [mode, setMode] = useState<Downgrade>("auto");

  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const baseUrlRef = useRef<string | null>(null);
  const bindingRef = useRef<WorkspaceFile | null>(null);
  const modeRef = useRef<Downgrade>("auto");
  const selectionRef = useRef<WorkspaceFile | null>(null);
  modeRef.current = mode;
  bindingRef.current = binding;
  selectionRef.current = candidate;
  baseUrlRef.current = baseUrl;

  // ------------------------------------------------------------- page document

  // The site is a file in this package, so "starting" is a fetch and an inline
  // rewrite rather than a service spawn: no process, no first-open download.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        setBaseUrl(siteRoot());
        const doc = await buildSiteDocument({ mode, uiLang });
        if (cancelled) return;
        setIframeDoc(doc);
      } catch (error) {
        if (cancelled) return;
        setIframeDoc(null);
        setPhase("failed");
        setNotice(String((error as Error)?.message ?? error));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ctx, mode, uiLang, nonce]);

  // ------------------------------------------------------- frame handle (tools)

  useEffect(() => {
    setCraftFrame({
      post(message, transfer) {
        const target = frameRef.current?.contentWindow;
        if (!target) return false;
        target.postMessage(message, "*", transfer ?? []);
        return true;
      },
      baseUrl: () => baseUrlRef.current,
    });
    return () => setCraftFrame(null);
  }, []);

  // --------------------------------------------------------- step progress

  // The batch runs in the page and reports each step as it starts. Showing it here
  // is the difference between "something happened in the tab" and "this is what is
  // happening right now": the line names the step, the canvas shows its effect.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = subscribeCraftProgress((event) => {
      setProgress(`${event.index + 1}/${event.total} · ${event.label}`);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setProgress(null), 4000);
    });
    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  // --------------------------------------------------------------- pause gate

  // Re-sent on `phase`, so a reloaded frame (which starts with a fresh, unpaused
  // bridge) inherits the current visibility instead of drawing forever in a
  // hidden tab. postMessage is delivered to a display:none frame; frames are not.
  useEffect(() => {
    const target = frameRef.current?.contentWindow;
    if (!target) return;
    target.postMessage({ type: paused ? "craft:pause" : "craft:resume" }, "*");
  }, [paused, phase]);

  // -------------------------------------------------------- explorer selection

  useEffect(() => {
    const access = selectionAccess(ctx);
    const read = (): void => setCandidate(access.current());
    read();
    if (access.denied) setNotice(strings.noWorkspaceAccess);
    const disposable = access.onChange(read);
    return () => disposable?.dispose();
  }, [ctx, strings]);

  // ----------------------------------------------------------------- save path

  const save = useCallback(
    async (name: string, bytes: ArrayBuffer): Promise<void> => {
      try {
        const saved = await saveRenderedFile(ctx, { name, bytes, current: bindingRef.current });
        if (!saved) return;
        // Only the first save binds a path: an export must not steal the
        // document's own save target.
        if (!bindingRef.current) setBinding(saved);
        setSavedAt(Date.now());
        setNotice(`${strings.saved} · ${saved.name}`);
      } catch (error) {
        setNotice(`${strings.saveFailed}: ${String((error as Error)?.message ?? error)}`);
      }
    },
    [ctx, strings],
  );

  // --------------------------------------------------------- message protocol

  useEffect(() => {
    const onMessage = (event: MessageEvent): void => {
      const target = frameRef.current?.contentWindow;
      if (!target || event.source !== target) return; // 0002 D3: identity, not origin
      if (!isLinkMessage(event.data)) return;
      const data = event.data;

      // Answers to requests sent by the Agent tools (act / look / stage).
      if (data.type === "craft:reply") {
        settleCraftReply(data);
        return;
      }

      if (data.type === "craft:progress" && isProgressMessage(data)) {
        publishCraftProgress(data);
        return;
      }

      if (data.type === "craft:ready") {
        setPhase("ready");
        setBackend(
          data.backend === "gpu"
            ? strings.backendGpu
            : data.backend === "cpu-or-gl"
              ? strings.backendCpu
              : "",
        );
        return;
      }

      if (data.type === "craft:error") {
        const message = String(data.message ?? "");
        if (!isBootFailure(message)) {
          if (message) setNotice(message);
          return;
        }
        const next = nextDowngrade(modeRef.current);
        if (!next) {
          setPhase("failed");
          setNotice(message || strings.failed);
          return;
        }
        modeRef.current = next;
        setMode(next);
        setPhase("starting");
        setNotice(next === "webgl" ? strings.degradeGl : strings.degradeCpu);
        return;
      }

      if (data.type === "craft:pickOpen" && data.id) {
        const id = data.id;
        const reply = (message: unknown, transfer: Transferable[] = []): void => {
          target.postMessage(message, "*", transfer);
        };
        const file = selectionRef.current;
        if (!file) {
          reply({ type: "craft:fallback", id });
          setNotice(strings.selectInExplorer);
          return;
        }
        void readWorkspaceFile(ctx, file).then((loaded) => {
          if (!loaded) {
            reply({ type: "craft:fallback", id });
            setNotice(strings.openFailed);
            return;
          }
          reply(
            { type: "craft:open", id, name: file.name, mime: loaded.mimeType, bytes: loaded.bytes },
            [loaded.bytes],
          );
          const next = { path: file.path, name: file.name };
          setBinding(next);
          bindingRef.current = next;
          setSavedAt(null);
        });
        return;
      }

      if (data.type === "craft:save" && data.bytes) {
        void save(data.name || strings.untitled, data.bytes);
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [ctx, save, strings]);

  // ---------------------------------------------------------------- fullscreen

  const reportFullscreenError = useCallback(
    (message: string): void => setNotice(`${strings.fullscreenFailed}: ${message}`),
    [strings],
  );
  const fullscreen = useContainerFullscreen(reportFullscreenError);

  const reload = useCallback((): void => {
    // A reload is a fresh start: try WebGPU again before falling back.
    modeRef.current = "auto";
    setMode("auto");
    setPhase("starting");
    setNonce((value) => value + 1);
    setNotice(null);
  }, []);

  return {
    strings,
    phase,
    backend,
    binding,
    candidate,
    savedAt,
    notice,
    progress,
    iframeDoc,
    // Re-mounting the frame is what reloads the app: same document text, new key.
    iframeKey: `${baseUrl ?? ""}#${nonce}#${mode}`,
    frameRef,
    containerRef: fullscreen.containerRef,
    isFullscreen: fullscreen.isFullscreen,
    overlay: fullscreen.overlay,
    toggleFullscreen: fullscreen.toggle,
    reload,
  };
}
