import { beforeEach, describe, expect, it, vi } from "vitest";

const registrations = {
  workspaceView: [] as Array<Record<string, unknown>>,
  activityTab: [] as Array<Record<string, unknown>>,
  inputAction: [] as Array<Record<string, unknown>>,
};

vi.mock("../features/downloader/components/downloader-view", () => ({
  DownloaderView: () => null,
}));
vi.mock("../features/connection/components/service-status-slot", () => ({
  ServiceStatusSlot: () => null,
}));
vi.mock("../runtime", () => ({
  ensureServiceStarted: vi.fn(async () => undefined),
}));

const { default: plugin } = await import("../index");

function createContext() {
  const disposed: string[] = [];
  const visible: Array<[string, boolean]> = [];
  const opened: string[] = [];
  const notify = vi.fn();
  const context = {
    plugin: { id: "video-downloader", version: "1.1.0" },
    permissions: { has: () => true },
    i18n: { t: (key: string) => key },
    services: {},
    ui: {
      notify,
      registerAbilityDetailSlot: (input: Record<string, unknown>) => {
        registrations.workspaceView.push({ detail: true, ...input });
        return { dispose: () => disposed.push("detail") };
      },
      registerWorkspaceView: (input: Record<string, unknown>) => {
        registrations.workspaceView.push(input);
        return { dispose: () => disposed.push("view") };
      },
      registerActivityTab: (input: Record<string, unknown>) => {
        registrations.activityTab.push(input);
        return { dispose: () => disposed.push("tab") };
      },
      registerInputAction: (input: Record<string, unknown>) => {
        registrations.inputAction.push(input);
        return { dispose: () => disposed.push("action") };
      },
      setActivityTabVisible: (id: string, value: boolean) => visible.push([id, value]),
      openActivityTab: (id: string) => opened.push(id),
    },
  };
  return { context, disposed, visible, opened, notify };
}

describe("plugin activation surfaces", () => {
  beforeEach(() => {
    registrations.workspaceView = [];
    registrations.activityTab = [];
    registrations.inputAction = [];
  });

  it("registers the queue as both a workspace view and an addable activity tab", async () => {
    const { context } = createContext();
    await plugin.activate(context as never);

    const view = registrations.workspaceView.find((entry) => entry.id === "downloader");
    expect(view).toBeDefined();
    expect(view?.label).toBe("%downloader.title%");

    const tab = registrations.activityTab[0];
    expect(tab?.id).toBe("downloads");
    expect(tab?.label).toBe("%downloader.title%");
    expect(tab?.scope_use).toEqual(["conversation", "project"]);
    // On the tab bar from the start; the composer chip only opens and hides it.
    expect(tab?.initiallyVisible).toBe(true);
  });

  it("opens the panel from the composer chip", async () => {
    const { context, visible, opened } = createContext();
    await plugin.activate(context as never);

    const action = registrations.inputAction[0];
    expect(action?.id).toBe("open-downloads");
    expect(action?.scope_use).toEqual(["conversation", "project"]);

    const onToggle = action?.onToggle as (active: boolean) => void;
    onToggle(true);
    expect(visible).toEqual([["downloads", true]]);
    expect(opened).toEqual(["downloads"]);

    onToggle(false);
    expect(visible.at(-1)).toEqual(["downloads", false]);
  });

  it("disposes every contribution and surfaces service failures", async () => {
    const { context, disposed, notify } = createContext();
    const runtime = await import("../runtime");
    vi.mocked(runtime.ensureServiceStarted).mockRejectedValueOnce(new Error("boom"));

    const dispose = (await plugin.activate(context as never)) as () => Promise<void>;
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ message: "error.serviceStart" }));

    await dispose();
    expect(disposed).toEqual(expect.arrayContaining(["action", "tab", "view", "detail"]));
  });
});
