import type { PluginContext } from "@astravia-org/plugin-sdk";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { isBootFailure, isLinkMessage, nextDowngrade } from "../../../domain/link-protocol.ts";
import type { Downgrade } from "../../../domain/link-protocol.ts";
import { ensureHub } from "../../../runtime.ts";
import { basename } from "../../../shared/formatters/paths.ts";
import { editorStrings } from "../strings.ts";
import type { EditorStrings } from "../strings.ts";
import {
  readWorkspaceFile,
  saveRenderedImage,
  selectionAccess,
} from "../services/workspace-files.ts";
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
  iframeSrc: string | null;
  iframeKey: string;
  frameRef: RefObject<HTMLIFrameElement | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  isFullscreen: boolean;
  toggleFullscreen: () => void;
  openEntry: (kind: "panel" | "system") => void;
  reload: () => void;
}

/**
 * Everything the tab does that is not markup: start the hub, speak the bridge
 * protocol, keep the save binding, and walk the WebGPU → WebGL2 → software
 * ladder. Upstream never retries by itself, so a machine without a WebGPU
 * adapter would otherwise only ever see "failed to start".
 */
export function usePhotocraftEditor(ctx: PluginContext): EditorSession {
  const strings = editorStrings(ctx.i18n.locale);
  const [baseUrl, setBaseUrl] = useState<string | null>(null);
  const [phase, setPhase] = useState<EditorPhase>("starting");
  const [backend, setBackend] = useState("");
  const [binding, setBinding] = useState<WorkspaceFile | null>(null);
  const [candidate, setCandidate] = useState<WorkspaceFile | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [mode, setMode] = useState<Downgrade>("auto");

  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const bindingRef = useRef<WorkspaceFile | null>(null);
  const modeRef = useRef<Downgrade>("auto");
  const selectionRef = useRef<WorkspaceFile | null>(null);
  modeRef.current = mode;
  bindingRef.current = binding;
  selectionRef.current = candidate;

  // ------------------------------------------------------- service + page load

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const url = await ensureHub(ctx);
        if (!cancelled) setBaseUrl(url);
      } catch (error) {
        if (!cancelled) setPhase("failed");
        setNotice(String((error as Error)?.message ?? error));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ctx]);

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
        const saved = await saveRenderedImage(ctx, { name, bytes, current: bindingRef.current });
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

      if (data.type === "pc:ready") {
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

      if (data.type === "pc:error") {
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

      if (data.type === "pc:pickOpen" && data.id) {
        const reply = (message: unknown, transfer: Transferable[] = []): void => {
          target.postMessage(message, "*", transfer);
        };
        const file = selectionRef.current;
        if (!file) {
          reply({ type: "pc:fallback", id: data.id });
          setNotice(strings.selectInExplorer);
          return;
        }
        void readWorkspaceFile(ctx, file).then((loaded) => {
          if (!loaded) {
            reply({ type: "pc:fallback", id: data.id });
            setNotice(strings.openFailed);
            return;
          }
          reply(
            { type: "pc:open", id: data.id, name: file.name, mime: loaded.mimeType, bytes: loaded.bytes },
            [loaded.bytes],
          );
          const next = { path: file.path, name: file.name };
          setBinding(next);
          bindingRef.current = next;
          setSavedAt(null);
        });
        return;
      }

      if (data.type === "pc:save" && data.bytes) {
        void save(data.name || strings.untitled, data.bytes);
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [ctx, save, strings]);

  // ------------------------------------------------------------------ actions

  // ---------------------------------------------------------------- fullscreen

  const reportFullscreenError = useCallback(
    (message: string): void => setNotice(`${strings.fullscreenFailed}: ${message}`),
    [strings],
  );
  const fullscreen = useContainerFullscreen(reportFullscreenError);

  const openEntry = useCallback(
    (kind: "panel" | "system"): void => {
      if (!baseUrl) return;
      if (kind === "panel") ctx.browser.open(baseUrl);
      else ctx.ui.openExternal(baseUrl);
    },
    [baseUrl, ctx],
  );

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
    iframeSrc: baseUrl ? (mode === "auto" ? baseUrl : `${baseUrl}/?${mode}`) : null,
    iframeKey: `${baseUrl ?? ""}#${nonce}#${mode}`,
    frameRef,
    containerRef: fullscreen.containerRef,
    isFullscreen: fullscreen.isFullscreen,
    toggleFullscreen: fullscreen.toggle,
    openEntry,
    reload,
  };
}
