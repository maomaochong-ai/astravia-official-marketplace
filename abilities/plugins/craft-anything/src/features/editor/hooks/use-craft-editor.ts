import type { PluginContext } from "@astravia-org/plugin-sdk";
import { definePluginPromptContext, useActivityTab } from "@astravia-org/plugin-sdk";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import {
  isBootFailure,
  isLinkMessage,
  isNoteMessage,
  isProgressMessage,
  nextDowngrade,
} from "../../../domain/link-protocol.ts";
import type { CraftNote, Downgrade } from "../../../domain/link-protocol.ts";
import { buildSiteDocument, siteRoot } from "../services/site-document.ts";
import { APP } from "../../../app.config.ts";
import { editorStrings } from "../strings.ts";
import type { EditorStrings } from "../strings.ts";
import {
  craftNotes,
  publishCraftNote,
  craftShotPath,
  recordCraftShot,
  publishCraftProgress,
  resetCraftNotes,
  setCraftFrame,
  setCraftWorkspace,
  settleCraftReply,
  subscribeCraftIntent,
  subscribeCraftNotes,
  subscribeCraftProgress,
} from "../session-registry.ts";
import type { CraftIntent } from "../session-registry.ts";
import { readWorkspaceFile, saveRenderedFile, selectionAccess } from "../services/workspace-files.ts";
import { openDocument } from "../services/open-document.ts";
import type { WorkspaceFile } from "../services/workspace-files.ts";
import { saveCanvasShot } from "../services/canvas-shot.ts";
import type { RegionRect } from "../services/canvas-shot.ts";
import { recallDocument, rememberDocument } from "../services/last-document.ts";
import { useContainerFullscreen } from "./use-container-fullscreen.ts";

/** Smallest drag that counts as an area rather than a misplaced click. */
const MIN_REGION = 0.02;

function clampRegion(rect: RegionRect): RegionRect | null {
  const x = Math.min(Math.max(rect.x, 0), 1);
  const y = Math.min(Math.max(rect.y, 0), 1);
  const x2 = Math.min(Math.max(rect.x + rect.w, 0), 1);
  const y2 = Math.min(Math.max(rect.y + rect.h, 0), 1);
  const w = x2 - x;
  const h = y2 - y;
  if (w < MIN_REGION || h < MIN_REGION) return null;
  return { x, y, w, h };
}

function rectLabel(region: RegionRect): string {
  const pct = (value: number): string => `${Math.round(value * 100)}%`;
  return `${pct(region.w)}×${pct(region.h)} at ${pct(region.x)},${pct(region.y)}`;
}

export type EditorPhase = "starting" | "ready" | "failed";

/**
 * What the boot cover needs, all of it observed rather than estimated: when this frame's
 * document was handed to the iframe, the last line upstream painted into its own
 * `*_loading` element, and whether the bridge has already reported the boot as slow.
 */
export interface BootState {
  startedAt: number;
  hasDocument: boolean;
  line: string;
  slow: boolean;
}

export interface EditorSession {
  strings: EditorStrings;
  phase: EditorPhase;
  /** False while the tab has never been shown and no engine has been started. */
  awake: boolean;
  backend: string;
  binding: WorkspaceFile | null;
  candidate: WorkspaceFile | null;
  savedAt: number | null;
  notice: string | null;
  /** "2/5 · 点击渐变工具" while an Agent batch runs in the page; null when idle. */
  boot: BootState;
  /** Package-relative icon for the boot cover; null when there is no package root. */
  iconUrl: string | null;
  progress: string | null;
  /** What the page has done lately, oldest first — the strip under the frame. */
  notes: CraftNote[];
  /** The call the model is still writing; null once it runs or ends. */
  intent: CraftIntent | null;
  /** Upstream's page as an inline document; null until the package file is read. */
  iframeDoc: string | null;
  iframeKey: string;
  frameRef: RefObject<HTMLIFrameElement | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  isFullscreen: boolean;
  overlay: boolean;
  toggleFullscreen: () => void;
  reload: () => void;
  /** Draft the panel's state into the message box; the user still presses Enter. */
  askAgent: () => Promise<void>;
  /** True while the pointer is drawing the area to hand over. */
  picking: boolean;
  /** Where the page reported a right-click, in fractions of the canvas; null = closed. */
  menu: { x: number; y: number } | null;
  closeMenu: () => void;
  /** Arm the marquee. The tab draws it; the frame is never touched. */
  beginRegion: () => void;
  cancelRegion: () => void;
  /** Crop what was drawn, drop it in `.craft/shots/`, and put a line in the message box. */
  captureRegion: (rect: RegionRect) => Promise<void>;
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
  /** `tab.active` is a value, not a getter: a scope registered once must read it live. */
  const activeRef = useRef(false);
  activeRef.current = tab.active === true;
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
  const [notes, setNotes] = useState<CraftNote[]>([]);
  const [intent, setIntent] = useState<CraftIntent | null>(null);
  /** Armed marquee: the tab paints the rubber band, the page does the cropping. */
  const [picking, setPicking] = useState(false);
  /** Open context menu: the position the page reported, in canvas fractions. */
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  /** The last crop handed over, so the chip can name it until the next one. */
  const [region, setRegion] = useState<{ path: string; rect: RegionRect } | null>(null);
  const [boot, setBoot] = useState<BootState>(() => ({
    startedAt: Date.now(),
    hasDocument: false,
    line: "",
    slow: false,
  }));
  const [nonce, setNonce] = useState(0);
  const [mode, setMode] = useState<Downgrade>("auto");

  // A tab the host keeps mounted but has never shown does not get an engine. Fifteen
  // of these apps selected at launch would otherwise compile fifteen 13–32 MB wasm
  // builds in the same renderer, which is the stall the operating system sees as a
  // frozen window.
  //
  // There used to be a twenty-second fallback here that woke the tab even when the host
  // never reported `active`, on the theory that an old host might not report it at all.
  // Every path that legitimately needs the editor goes through `openActivityTab`, which
  // activates the tab, so the fallback only ever fired for tabs nobody was looking at:
  // fifteen engines compiling behind a conversation that never asked for one. Removed.
  const [awake, setAwake] = useState(tab.active === true);
  useEffect(() => {
    if (awake) return;
    if (tab.active) setAwake(true);
  }, [awake, tab.active]);

  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const baseUrlRef = useRef<string | null>(null);
  const bindingRef = useRef<WorkspaceFile | null>(null);
  const modeRef = useRef<Downgrade>("auto");
  const selectionRef = useRef<WorkspaceFile | null>(null);
  /** The selection is offered once per wake-up, not on every selection change. */
  const autoOpenRef = useRef(false);
  /** One restore per mount: shutting the tab is not a reason to reopen twice. */
  const restoreRef = useRef(false);
  /** Read by the shortcut gate, which is registered once and re-checked per keydown. */
  const awakeRef = useRef(false);
  const reloadRef = useRef<() => void>(() => {});
  const toggleRef = useRef<() => void>(() => {});
  modeRef.current = mode;
  bindingRef.current = binding;
  selectionRef.current = candidate;
  baseUrlRef.current = baseUrl;
  awakeRef.current = awake;

  // The icon is a package file next to the site (`assets/`, the directory the marketplace
  // card reads too), so the boot cover needs no per-plugin import and no second copy of
  // the same PNG in the bundle. A dev link without that layout gets a monogram instead.
  const iconUrl = useMemo(() => {
    if (!baseUrl) return null;
    try {
      return new URL("../assets/icon.png", baseUrl).href;
    } catch {
      return null;
    }
  }, [baseUrl]);

  // ------------------------------------------------------------- page document

  // The site is a file in this package, so "starting" is a fetch and an inline
  // rewrite rather than a service spawn: no process, no first-open download. It only
  // runs once the tab has been shown (see `awake`), which is what keeps fifteen
  // installed plugins from opening fifteen engines at launch.
  useEffect(() => {
    if (!awake) return;
    let cancelled = false;
    void (async () => {
      try {
        setBaseUrl(siteRoot());
        const doc = await buildSiteDocument({ mode, uiLang });
        if (cancelled) return;
        setIframeDoc(doc);
        setBoot({ startedAt: Date.now(), hasDocument: true, line: "", slow: false });
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
  }, [awake, ctx, mode, uiLang, nonce]);

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

  // ------------------------------------------------------------ activity log

  // The page reports what it did (`craft:note`); the registry keeps the last twenty-four
  // so a tool can ask for them while this hook is unmounted. The strip renders the tail.
  useEffect(() => subscribeCraftNotes(setNotes), []);

  // One press: the tab says what the Agent is about to do, before it does it. The
  // conversation pushes this while the arguments stream; a host without
  // `agent.session.read` never sends it and the strip simply has nothing to pin.
  useEffect(() => subscribeCraftIntent(setIntent), []);

  // The Agent's screenshots are written through `ctx.fs`, which is project-scoped,
  // and the tools have no `cwd` of their own. Publishing it here covers the case the
  // conversation cannot: a panel opened with no session attached yet.
  useEffect(() => {
    setCraftWorkspace(tab.cwd);
  }, [tab.cwd]);

  // A notice is the tab's own voice — a failed read, a save that landed, the rendering
  // ladder stepping down. It used to live in the header, which no longer exists, so it
  // joins the same history instead of being said once and lost.
  useEffect(() => {
    if (!notice) return;
    publishCraftNote({ at: Date.now(), kind: "notice", detail: notice, ok: false });
  }, [notice]);

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

  // ---------------------------------------------------- opening the selection

  // The selection belongs to the host, the document to the app. A user who selects a
  // file and then shows the panel means "open this one" — that is the whole point of
  // opening the panel with a file selected. The tab cannot hand a path to the page (the
  // page is upstream's own build and has no command channel), so the bytes are staged in
  // the bridge and offered through the app's own drop / picker path; see
  // `services/open-document.ts` for the ladder and for what "opened" is allowed to mean.
  //
  // Once per wake-up, and only on the transition into ready: a selection that changes
  // later is just a selection, and pushing it into whichever editor happens to be
  // visible would replace the document the user is working on.
  useEffect(() => {
    if (!awake || phase !== "ready" || autoOpenRef.current) return;
    autoOpenRef.current = true;
    const file = selectionRef.current;
    if (!file) return;
    // Already the document on screen (a reload, or a tab re-shown): nothing to fetch.
    if (bindingRef.current?.path === file.path) return;
    void (async () => {
      const loaded = await readWorkspaceFile(ctx, file);
      if (!loaded) {
        setNotice(strings.openFailed);
        return;
      }
      const result = await openDocument({ bytes: loaded.bytes, name: file.name, mime: loaded.mimeType });
      if (result.opened) {
        const next = { path: file.path, name: file.name };
        setBinding(next);
        bindingRef.current = next;
        setSavedAt(null);
        void rememberDocument(ctx, { path: file.path, name: file.name, mime: "" });
        return;
      }
      setNotice(strings.openManual);
    })();
  }, [awake, phase, ctx, strings]);

  // Closing the activity tab destroys the frame, and the frame was holding the document:
  // the wasm app keeps its own state and the `srcDoc` is rebuilt from scratch, so the
  // panel came back empty while the file sat untouched in the project — the user then had
  // to leave the conversation, find it in the file tree and drag it back in. The path is
  // the only thing that was missing, so it is written on every open and read once here.
  //
  // Only after the engine reports a frame, and never over a host selection: a selection
  // is a fresher instruction than anything we remembered.
  useEffect(() => {
    if (!awake || phase !== "ready" || restoreRef.current) return;
    restoreRef.current = true;
    if (selectionRef.current) return;
    void (async () => {
      const last = await recallDocument(ctx);
      if (!last || bindingRef.current?.path === last.path) return;
      const loaded = await readWorkspaceFile(ctx, { path: last.path, name: last.name });
      if (!loaded) return;
      const result = await openDocument({ bytes: loaded.bytes, name: last.name, mime: last.mime });
      if (!result.opened) return;
      const next = { path: last.path, name: last.name };
      setBinding(next);
      bindingRef.current = next;
      setSavedAt(null);
      setNotice(strings.restored.replace("{name}", last.name));
    })();
  }, [awake, phase, ctx, strings]);

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

      // A right-click the page forwarded. It is a position, not a protocol message, so
      // it is handled before the guard below: pointer events over an iframe never reach
      // this document, which is why `host-bridge.js` relays the press.
      const pressed = event.data as { type?: unknown; x?: unknown; y?: unknown } | null;
      if (pressed && pressed.type === "craft:contextmenu") {
        setMenu({
          x: typeof pressed.x === "number" ? pressed.x : 0.5,
          y: typeof pressed.y === "number" ? pressed.y : 0.5,
        });
        return;
      }
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

      // One line of the page's own log: a file it was handed, a chord it received, a
      // step that landed. Pushed as it happens so the strip and the attachment agree
      // with the picture.
      if (data.type === "craft:note" && isNoteMessage(data)) {
        publishCraftNote(data.entry);
        return;
      }

      // The bridge's boot heartbeat: upstream's own loading line (the only progress
      // signal the page emits) plus its "this is slow" flag.
      if (data.type === "craft:boot") {
        const line = typeof data.loader === "string" ? data.loader.trim() : "";
        const slow = !!data.slow;
        setBoot((old) =>
          old.line === line && old.slow === slow ? old : { ...old, line, slow: old.slow || slow },
        );
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
    // The new frame starts with an empty log; keeping the old one would describe a
    // page that no longer exists.
    resetCraftNotes();
    recordCraftShot(null);
    setBoot({ startedAt: Date.now(), hasDocument: false, line: "", slow: false });
  }, []);

  reloadRef.current = reload;
  toggleRef.current = fullscreen.toggle;

  // ------------------------------------------------------------ hand it back

  /**
   * The other direction of "say it and see it": one click puts the panel's own
   * state into the input box, so the person can add a sentence and send, instead of
   * describing what is on screen from memory. It goes through `insertText` rather
   * than `sendPrompt` — the host leaves the caret in the message, so this is a
   * draft the user still owns. Nothing is sent without them pressing Enter.
   */
  const askAgent = useCallback(async (): Promise<void> => {
    const lines = [
      `${strings.askAgentLead} ${APP.name} · ${binding?.name ?? strings.untitled} · ${phase}`,
      `${strings.backendLabel} ${backend || "—"}`,
    ];
    const tail = craftNotes()
      .slice(-3)
      .map((note) => `· ${note.kind}: ${note.detail}`);
    if (tail.length > 0) lines.push(`${strings.activity}:`, ...tail);
    try {
      await ctx.conversation.insertText(`${lines.join("\n")}\n`);
      publishCraftNote({ at: Date.now(), kind: "notice", detail: strings.askAgentSent, ok: true });
    } catch {
      publishCraftNote({ at: Date.now(), kind: "notice", detail: strings.askAgentFailed, ok: false });
    }
  }, [backend, binding, ctx, phase, strings]);

  // ------------------------------------------------------ a region, not the page

  /**
   * "Hand it to the AI" used to mean the whole page. A deck has one slide the question
   * is about, and a CAD drawing has one detail; describing either in words costs more
   * than pointing at it. So the marquee the user draws over the frame is cropped by the
   * page itself (`craft:capture` takes normalized coordinates) and lands on disk, and
   * the path travels with the prompt.
   *
   * What this cannot do: the canvas is one wasm surface, so there are no elements to
   * pick. The rectangle is the smallest unit the shell can ask for.
   */
  const captureRegion = useCallback(
    async (rect: RegionRect): Promise<void> => {
      setPicking(false);
      const area = clampRegion(rect);
      if (!area) {
        publishCraftNote({ at: Date.now(), kind: "notice", detail: strings.regionTooSmall, ok: false });
        return;
      }
      try {
        const shot = await saveCanvasShot(ctx, { region: area, tag: "region" });
        if (!shot) {
          publishCraftNote({ at: Date.now(), kind: "notice", detail: strings.regionFailed, ok: false });
          return;
        }
        setRegion({ path: shot.path, rect: area });
        const line = strings.regionLead
          .replace("{app}", APP.name)
          .replace("{document}", bindingRef.current?.name ?? strings.untitled)
          .replace("{rect}", rectLabel(area))
          .replace("{path}", shot.path);
        await ctx.conversation.insertText(`${line}\n`);
      } catch (error) {
        publishCraftNote({
          at: Date.now(),
          kind: "notice",
          detail: `${strings.regionFailed} — ${String((error as Error)?.message ?? error)}`,
          ok: false,
        });
      }
    },
    [ctx, strings],
  );

  const beginRegion = useCallback((): void => {
    setMenu(null);
    setPicking(true);
  }, []);
  const cancelRegion = useCallback((): void => setPicking(false), []);
  const closeMenu = useCallback((): void => setMenu(null), []);

  // ------------------------------------------------- what the model should know

  // The state of this editor rides along with the prompt **only while this tab is the
  // one the user has selected** — the host draws the chip under the composer for as
  // long as it is set, and a chip naming the editor while the user is talking about
  // something else is furniture, not context. Selecting the tab is the moment the
  // conversation starts being about this canvas; leaving it is the moment it stops.
  //
  // It is `sticky` for the stretch it is attached: a canvas app stays the subject of
  // the conversation until the user looks away, and a one-shot attachment would make
  // the agent forget the artwork between two messages.
  //
  // This is structured `context`, not `instructions`: the host renders the payload as
  // data (`<plugin_prompt_contexts>`) and the model is told to treat it as state, so a
  // file name can never read as an order.
  useEffect(() => {
    if (!awake || tab.active !== true) {
      ctx.ui.setPromptAttachment(null);
      return;
    }
    ctx.ui.setPromptAttachment({
      id: `${APP.id}:editor`,
      label: APP.name,
      labels: binding ? [binding.name] : undefined,
      lifecycle: "sticky",
      context: definePluginPromptContext({
        schema: "astravia.craft.editor-state",
        version: 1,
        payload: {
          app: APP.id,
          document: binding?.name ?? null,
          path: binding?.path ?? null,
          phase,
          backend: backend || null,
          capture: craftShotPath(),
          // The crop the user pointed at, so the model knows a region was chosen on
          // purpose and where the file is. Absent until the first marquee.
          region: region ? { path: region.path, rect: region.rect } : null,
          recent: craftNotes()
            .slice(-6)
            .map((note) => ({ kind: note.kind, detail: note.detail, ok: note.ok })),
        },
      }),
    });
  }, [awake, tab.active, binding, phase, backend, notes, region, ctx]);

  // A closed tab must not leave a chip in the input bar pointing at nothing.
  useEffect(() => () => ctx.ui.setPromptAttachment(null), [ctx]);

  // ------------------------------------------------------------- shortcuts

  // `mod+shift+r` / `mod+shift+f` are the header's two buttons after the header left.
  // A `surface` scope is what the host offers a panel; it is gated rather than
  // unregistered so a hidden tab cannot answer for the editor that is on screen.
  useEffect(() => {
    const scope = ctx.ui.registerShortcutScope({
      id: `${APP.id}:editor`,
      kind: "surface",
      enabled: () => (everActive.current ? activeRef.current : awakeRef.current),
      bindings: [
        { key: "mod+shift+r", run: () => reloadRef.current() },
        { key: "mod+shift+f", run: () => toggleRef.current() },
      ],
    });
    return () => scope.dispose();
  }, [ctx]);
  return {
    strings,
    phase,
    awake,
    backend,
    binding,
    candidate,
    savedAt,
    notice,
    boot,
    iconUrl,
    progress,
    notes,
    intent,
    iframeDoc,
    // Re-mounting the frame is what reloads the app: same document text, new key.
    iframeKey: `${baseUrl ?? ""}#${nonce}#${mode}`,
    frameRef,
    containerRef: fullscreen.containerRef,
    isFullscreen: fullscreen.isFullscreen,
    overlay: fullscreen.overlay,
    toggleFullscreen: fullscreen.toggle,
    reload,
    askAgent,
    picking,
    beginRegion,
    cancelRegion,
    captureRegion,
    menu,
    closeMenu,
  };
}
