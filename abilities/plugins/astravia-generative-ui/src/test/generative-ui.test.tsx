import type { PluginToolCallSlotToolCall } from "@astravia-org/plugin-sdk";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "../../locales/en.json";
import { InteractionStore } from "../domain/interaction-store";
import { RenderHtmlSlot } from "../features/tool-call-slots/components/render-html-slot";
import { RenderUiSlot } from "../features/tool-call-slots/components/render-ui-slot";
import type { GenerativeUiDeps } from "../shared/state/generative-ui-deps";
import { FakeStorage } from "./fake-storage";

vi.mock("@astravia-org/plugin-sdk", () => ({
    useTranslation: () => ({
        locale: "en",
        t: (key: string, params?: Record<string, string | number>) => {
            const text = (en as Record<string, string>)[key];
            if (text === undefined) throw new Error(`Missing locale key: ${key}`);
            return text.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(params?.[name] ?? ""));
        },
    }),
}));
vi.mock("chart.js/auto", () => ({ default: class { destroy() {} } }));

/**
 * 宿主设计系统在本仓库是 `.tooling/open-astravia` 的 junction，那份 checkout 自带一套
 * react/react-dom；在 jsdom 里它和本工程那份会分裂成两个 dispatcher，radix 的 hook
 * 直接读到 null（`Cannot read properties of null (reading 'useMemo')`）。
 * 这里换成同形的原生控件：被测的是表单与提交行为，不是 radix 的弹层实现。
 */
vi.mock("@astravia-org/ui", async () => {
    const React = await import("react");
    type AnyProps = Record<string, any>;
    // 占位元素：只用来给下面的遍历定位，不亲自渲染。
    const SelectItem = (_props: AnyProps) => null;
    const SelectTrigger = (_props: AnyProps) => null;
    const SelectValue = (_props: AnyProps) => null;
    const SelectContent = (_props: AnyProps) => null;
    const findProps = (node: unknown, type: unknown): AnyProps | undefined => {
        let found: AnyProps | undefined;
        React.Children.forEach(node as never, (child) => {
            if (found || !React.isValidElement(child)) return;
            found = child.type === type ? (child.props as AnyProps) : findProps((child.props as AnyProps)?.children, type);
        });
        return found;
    };
    const collectOptions = (node: unknown, out: AnyProps[] = []): AnyProps[] => {
        React.Children.forEach(node as never, (child) => {
            if (!React.isValidElement(child)) return;
            if (child.type === SelectItem) out.push(child.props as AnyProps);
            else collectOptions((child.props as AnyProps)?.children, out);
        });
        return out;
    };
    /**
     * 复刻宿主下拉的可测试形态：combobox 按钮 + listbox 选项。
     * 测试点是“选一个值并提交”，不是 radix 的弹层细节。
     */
    const Select = ({ value, onValueChange, disabled, children }: AnyProps) => {
        const [open, setOpen] = React.useState(false);
        const trigger = findProps(children, SelectTrigger) ?? {};
        const placeholder = findProps(children, SelectValue)?.placeholder;
        const options = collectOptions(children);
        const current = options.find((option) => option.value === value);
        return React.createElement(
            "div",
            null,
            React.createElement(
                "button",
                {
                    type: "button",
                    id: trigger.id,
                    role: "combobox",
                    disabled,
                    "aria-expanded": open,
                    "aria-invalid": trigger["aria-invalid"],
                    "aria-describedby": trigger["aria-describedby"],
                    onClick: () => setOpen((previous) => !previous),
                },
                current?.children ?? placeholder,
            ),
            open
                ? React.createElement(
                      "div",
                      { role: "listbox" },
                      options.map((option) =>
                          React.createElement(
                              "div",
                              {
                                  key: String(option.value),
                                  role: "option",
                                  "aria-selected": option.value === value,
                                  onClick: () => {
                                      onValueChange?.(option.value);
                                      setOpen(false);
                                  },
                              },
                              option.children,
                          ),
                      ),
                  )
                : null,
        );
    };
    return {
        Button: ({ children, ...props }: AnyProps) => React.createElement("button", props, children),
        Input: (props: AnyProps) => React.createElement("input", props),
        cn: (...values: unknown[]) => values.filter(Boolean).join(" "),
        Select,
        SelectItem,
        SelectContent,
        SelectTrigger,
        SelectValue,
        Slider: ({ value, onValueChange, ...props }: AnyProps) =>
            React.createElement("input", {
                ...props,
                type: "range",
                value,
                onChange: (event: { target: { value: string } }) => onValueChange?.(Number(event.target.value)),
            }),
        Switch: ({ checked, onCheckedChange, ...props }: AnyProps) =>
            React.createElement("input", {
                ...props,
                type: "checkbox",
                role: "switch",
                "aria-checked": Boolean(checked),
                checked: Boolean(checked),
                onChange: (event: { target: { checked: boolean } }) => onCheckedChange?.(event.target.checked),
            }),
    };
});

// Radix (behind the host dropdown) expects these browser APIs, which jsdom lacks.
Object.assign(Element.prototype, { hasPointerCapture: () => false, setPointerCapture() {}, releasePointerCapture() {}, scrollIntoView() {} });
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as never;

afterEach(cleanup);

function setup(storage = new FakeStorage()) {
    const sendPrompt = vi.fn(async () => ({ status: "sent" as const }));
    const notify = vi.fn();
    const deps: GenerativeUiDeps = { sendPrompt, notify, interactions: new InteractionStore(storage) };
    return { deps, sendPrompt, notify, storage, user: userEvent.setup() };
}

const call = (toolName: string, args: Record<string, unknown>, status: PluginToolCallSlotToolCall["status"] = "success"): PluginToolCallSlotToolCall => ({
    toolCallId: "call-1",
    toolName,
    args,
    status,
});

const tripView = {
    title: "Plan a trip",
    blocks: [
        { type: "stats", items: [{ label: "Budget", value: "$2,000" }] },
        {
            type: "form",
            title: "Trip details",
            fields: [
                { name: "city", label: "Destination", kind: "select", required: true, options: [{ label: "Paris", value: "par" }, { label: "Tokyo", value: "tyo" }] },
                { name: "notes", label: "Notes", kind: "textarea" },
                { name: "flexible", label: "Flexible dates", kind: "switch" },
            ],
            submitLabel: "Plan it",
        },
        { type: "actions", buttons: [{ label: "Surprise me", prompt: "Pick a destination for me" }] },
    ],
};

describe("render_ui view", () => {
    it("holds a stable skeleton while the arguments stream, then mounts the live view once", () => {
        const { deps } = setup();
        const { rerender } = render(<RenderUiSlot toolCall={call("render_ui", {}, "pending")} deps={deps} />);
        expect(screen.getByRole("status", { name: "Generating" })).toBeTruthy();
        // Partial arguments must not flash a half-built view.
        rerender(<RenderUiSlot toolCall={call("render_ui", tripView, "pending")} deps={deps} />);
        expect(screen.getByRole("status", { name: "Generating" })).toBeTruthy();
        expect(screen.queryByRole("button", { name: "Plan it" })).toBeNull();
        rerender(<RenderUiSlot toolCall={call("render_ui", tripView)} deps={deps} />);
        expect(screen.queryByRole("status", { name: "Generating" })).toBeNull();
        expect((screen.getByRole("button", { name: "Plan it" }) as HTMLButtonElement).disabled).toBe(false);
        expect(screen.getByText("$2,000")).toBeTruthy();
    });

    it("validates, submits values to the conversation once and stays submitted after reopening", async () => {
        const { deps, sendPrompt, storage, user } = setup();
        render(<RenderUiSlot toolCall={call("render_ui", tripView)} deps={deps} />);

        await user.click(screen.getByRole("button", { name: "Plan it" }));
        expect(screen.getByText("This field is required")).toBeTruthy();
        expect(sendPrompt).not.toHaveBeenCalled();

        await user.click(screen.getByRole("combobox", { name: /^Destination/ }));
        await user.click(await screen.findByRole("option", { name: "Tokyo" }));
        await user.type(screen.getByLabelText("Notes"), "Cherry blossoms");
        await user.click(screen.getByRole("switch", { name: "Flexible dates" }));
        await user.click(screen.getByRole("button", { name: "Plan it" }));

        await waitFor(() => expect(screen.getByText("Submitted")).toBeTruthy());
        const sent = (sendPrompt.mock.calls as unknown as string[][])[0]![0]!;
        expect(sent).toContain("- Destination: Tokyo");
        expect(sent).toContain('"flexible": true');
        expect(screen.queryByRole("button", { name: "Plan it" })).toBeNull();

        cleanup();
        render(<RenderUiSlot toolCall={call("render_ui", tripView)} deps={setup(storage).deps} />);
        await waitFor(() => expect(screen.getByText("Submitted")).toBeTruthy());
        expect(screen.getByRole("combobox", { name: /^Destination/ }).textContent).toContain("Tokyo");
    });

    it("sends a quick reply and locks the group", async () => {
        const { deps, sendPrompt, user } = setup();
        render(<RenderUiSlot toolCall={call("render_ui", tripView)} deps={deps} />);
        await user.click(screen.getByRole("button", { name: "Surprise me" }));
        expect(sendPrompt).toHaveBeenCalledWith("Pick a destination for me");
        await waitFor(() => expect((screen.getByRole("button", { name: "Surprise me" }) as HTMLButtonElement).disabled).toBe(true));
    });

    it("reports a failed send instead of marking the form submitted", async () => {
        const { deps, sendPrompt, notify, user } = setup();
        sendPrompt.mockResolvedValueOnce({ status: "failed", error: { message: "no session" } } as never);
        render(<RenderUiSlot toolCall={call("render_ui", tripView)} deps={deps} />);
        await user.click(screen.getByRole("button", { name: "Surprise me" }));
        await waitFor(() => expect(notify).toHaveBeenCalled());
        expect((screen.getByRole("button", { name: "Surprise me" }) as HTMLButtonElement).disabled).toBe(false);
    });
});

describe("unavailable view notice", () => {
    it("is neutral, not an alert, and names the plugin", () => {
        const { deps } = setup();
        render(<RenderUiSlot toolCall={{ ...call("render_ui", {}, "error"), isError: true, result: "bad field" }} deps={deps} />);
        expect(screen.queryByRole("alert")).toBeNull();
        expect(screen.getByText("Astravia Generative UI")).toBeTruthy();
        expect(screen.getByText("This view isn't available right now")).toBeTruthy();
        expect(screen.getByText("bad field").closest("details")).toBeTruthy();
    });
});

describe("render_ui layout", () => {
    it("renders nested containers and a multi-column form", async () => {
        const { deps } = setup();
        const view = {
            width: "wide",
            blocks: [
                {
                    type: "tabs",
                    tabs: [
                        { label: "Overview", blocks: [{ type: "columns", weights: [2, 1], columns: [{ blocks: [{ type: "card", title: "Main card", blocks: [{ type: "text", text: "Deep content" }] }] }, { blocks: [{ type: "stats", items: [{ label: "Users", value: "42" }] }] }] }] },
                        { label: "Form", blocks: [{ type: "form", columns: 2, fields: [{ name: "a", label: "First", kind: "text" }, { name: "b", label: "Second", kind: "text" }], submitLabel: "Go" }] },
                    ],
                },
            ],
        };
        render(<RenderUiSlot toolCall={call("render_ui", view)} deps={deps} />);
        expect(screen.getByText("Deep content")).toBeTruthy();
        expect(screen.getByText("Main card")).toBeTruthy();
        expect(screen.getByText("42")).toBeTruthy();
        expect(screen.getByLabelText("First")).toBeTruthy();
    });
});

describe("render_html view", () => {
    it("mounts the HTML in an opaque-origin sandbox and asks before sending its prompt", async () => {
        const { deps, sendPrompt, user } = setup();
        render(<RenderHtmlSlot toolCall={call("render_html", { title: "Calculator", html: "<button>Go</button>" })} deps={deps} />);
        const frame = (await screen.findByTitle("Calculator")) as HTMLIFrameElement;
        expect(frame.getAttribute("sandbox")).toBe("allow-scripts");
        expect(frame.getAttribute("srcdoc")).toContain("<button>Go</button>");

        // A message from another window is ignored.
        act(() => window.dispatchEvent(new MessageEvent("message", { data: { source: "astravia-generative-ui", kind: "prompt", text: "spoof" } })));
        expect(screen.queryByRole("dialog")).toBeNull();

        act(() =>
            window.dispatchEvent(
                new MessageEvent("message", { source: frame.contentWindow, data: { source: "astravia-generative-ui", kind: "prompt", text: "Monthly payment is $1,200" } }),
            ),
        );
        expect(screen.getByRole("dialog", { name: "This view wants to send a message" })).toBeTruthy();
        await user.click(screen.getByRole("button", { name: "Send" }));
        expect(sendPrompt).toHaveBeenCalledWith("Monthly payment is $1,200");
        await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    });

    it("does not mount partial HTML while streaming", () => {
        const { deps } = setup();
        render(<RenderHtmlSlot toolCall={call("render_html", { html: "<div>half" }, "pending")} deps={deps} />);
        expect(screen.getByText("Building the view…")).toBeTruthy();
        expect(document.querySelector("iframe")).toBeNull();
    });
});
