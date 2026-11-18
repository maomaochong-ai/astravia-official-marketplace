import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { TodeskConsoleView } from "./todesk-console-view";
import type { ConsoleDeps, RunResult } from "../../../runtime-contract";

afterEach(cleanup);

const STATUS = `[libusb] Info: noise
ToDesk ID:123456789
ToDesk 4.8.8.4 for windows
Start ToDesk with Windows: ON
PID:7332   C:\\Program Files\\ToDesk\\ToDesk.exe`;

const CODE = "123456789";

const STORE_DEVICES = [
	{ UserId: "123456789", UserName: "Office PC", RecentConnectTime: "1700000000000", IsConnected: "1", PassEx: "aa", IsPinned: "1" },
	{ UserId: "987654321", UserName: "Laptop", RecentConnectTime: "1600000000000", IsConnected: "0", PassEx: "" },
];

function harness(
	options: { settings?: Record<string, unknown>; failRun?: boolean; withStore?: boolean } = {},
) {
	const { settings = {}, failRun = false, withStore = false } = options;
	const runs: { file: string; args: string[]; env?: Record<string, string> }[] = [];
	let settingsValue: Record<string, unknown> = settings;

	const deps: ConsoleDeps = {
		readTextFile: async (path) => {
			if (withStore && path.endsWith("devlist_1.json")) return JSON.stringify({ DeviceInfo: STORE_DEVICES });
			throw new Error("ENOENT");
		},
		listDirectory: async (path) => {
			if (!withStore) return [];
			if (path.endsWith("\\Users")) return [{ name: "me", path: "C:\\Users\\me", isDirectory: true }];
			if (path.endsWith("\\ToDesk")) {
				return [{ name: "devlist_1.json", path: "C:\\Users\\me\\AppData\\Local\\ToDesk\\devlist_1.json" }];
			}
			return [];
		},
		readSettings: async () => settingsValue,
		writeSettings: async (value) => {
			settingsValue = value;
		},
		openExternal: async () => undefined,
		run: async (file, args, env): Promise<RunResult> => {
			runs.push({ file, args, env });
			if (failRun) throw new Error("Plugin todesk command disabled by user: ToDesk.exe");
			if (args[0] === "-status") return { exitCode: 1, stdout: STATUS, stderr: "" };
			return { exitCode: 1, stdout: "", stderr: "" };
		},
		notifyError: () => undefined,
		notify: () => undefined,
	};

	return { deps, runs, settings: () => settingsValue };
}

const t = (key: string, params?: Record<string, string | number>) =>
	params ? `${key}(${Object.values(params).join(",")})` : key;

describe("ToDesk console view", () => {


	it("lists the client's saved devices, pinned first, and connects the one with a credential", async () => {
		const { deps, runs } = harness({ withStore: true });
		render(<TodeskConsoleView deps={deps} t={t} canRun />);

		await screen.findByText("Office PC");
		expect(screen.getByText("Laptop")).toBeTruthy();
		expect(screen.getByText("devices.pinned")).toBeTruthy();

		// The first row carries a saved credential: one click is a connect with no password.
		await userEvent.click(screen.getAllByRole("button", { name: "devices.connect" })[0]);
		await waitFor(() => expect(runs.some((run) => run.args[0] === "-control")).toBe(true));
		const control = runs.find((run) => run.args[0] === "-control");
		expect(control?.args).toEqual(["-control", "-id", "123456789"]);
	});

	it("hands a saved device without a credential to the manual row", async () => {
		const { deps, runs } = harness({ withStore: true });
		render(<TodeskConsoleView deps={deps} t={t} canRun />);

		await screen.findByText("Laptop");
		await userEvent.click(screen.getByRole("button", { name: "devices.fill" }));

		const field = screen.getByLabelText("connect.deviceId") as HTMLInputElement;
		await waitFor(() => expect(field.value).toBe("987654321"));
		expect(runs.some((run) => run.args[0] === "-control")).toBe(false);
	});

	it("shows the readiness verdict and its items", async () => {
		const { deps } = harness({ withStore: true });
		render(<TodeskConsoleView deps={deps} t={t} canRun />);

		await screen.findByText("readiness.title");
		// The harness has no readable config.ini, so the panel must say "unknown",
		// not paint a green verdict over flags it never saw.
		expect(screen.getByText("readiness.verdict.degraded")).toBeTruthy();
		expect(screen.getByText("readiness.item.posture-unknown")).toBeTruthy();
	});

	it("draws each capability switch as a real switch, and toggling it persists", async () => {
		const { deps, settings } = harness();
		render(<TodeskConsoleView deps={deps} t={t} canRun />);
		await screen.findAllByText(CODE);

		const switches = screen.getAllByRole("switch");
		expect(switches.length).toBeGreaterThanOrEqual(11);
		// All on by default, and each one announces its own tool id.
		expect(switches.every((node) => node.getAttribute("aria-checked") === "true")).toBe(true);
		expect(switches[0].getAttribute("aria-label")).toBe("diag.tools.status.name");

		await userEvent.click(switches[0]);
		await waitFor(() => expect(screen.getAllByRole("switch")[0].getAttribute("aria-checked")).toBe("false"));
		// The choice is stored, not just painted.
		expect((settings().tools as Record<string, boolean>).status).toBe(false);
	});

	it("keeps every visible control usable by default", async () => {
		const { deps } = harness();
		render(<TodeskConsoleView deps={deps} t={t} canRun />);
		await screen.findAllByText(CODE);

		const buttons = screen.getAllByRole("button") as HTMLButtonElement[];
		const disabled = buttons.filter((button) => button.disabled).map((button) => button.textContent);
		// Only the submit button, and only because the code field is still empty.
		expect(disabled).toEqual(["connect.action"]);
	});

	it("requires both the code and the password before it will connect", async () => {
		const user = userEvent.setup();
		const { deps, runs } = harness();
		render(<TodeskConsoleView deps={deps} t={t} canRun />);

		await screen.findAllByText(CODE);
		await user.type(screen.getByLabelText("connect.deviceId"), "111 222 333");
		const submit = screen.getByRole("button", { name: "connect.action" }) as HTMLButtonElement;
		expect(submit.disabled).toBe(true);

		await user.type(screen.getByLabelText("connect.password"), "a12345");
		await waitFor(() => expect(submit.disabled).toBe(false));
		await user.click(submit);

		await waitFor(() =>
			expect(runs.some((run) => run.args.join(" ") === "-control -id 111222333 -passwd a12345")).toBe(true),
		);
	});

	it("keeps the code and password inputs on one row", async () => {
		const { deps } = harness();
		const { container } = render(<TodeskConsoleView deps={deps} t={t} canRun />);

		await screen.findAllByText(CODE);
		const form = container.querySelector("form") as HTMLFormElement;
		expect(form.className).toContain("flex-nowrap");
		expect(form.querySelectorAll("input")).toHaveLength(2);
	});

	it("gates only on a malformed code, with a live hint", async () => {
		const user = userEvent.setup();
		const { deps } = harness();
		render(<TodeskConsoleView deps={deps} t={t} canRun />);

		await screen.findAllByText(CODE);
		await user.type(screen.getByLabelText("connect.deviceId"), "111");
		expect(screen.getByText("connect.digits(3)")).toBeTruthy();
		expect((screen.getByRole("button", { name: "connect.action" }) as HTMLButtonElement).disabled).toBe(true);
	});

	it("surfaces the host's command-grant refusal in plain words", async () => {
		const { deps } = harness({ failRun: true });
		render(<TodeskConsoleView deps={deps} t={t} canRun />);
		expect(await screen.findByText("local.commandDenied")).toBeTruthy();
	});

	it("lets the user switch each agent capability instead of blocking them", async () => {
		const user = userEvent.setup();
		const { deps, settings } = harness();
		render(<TodeskConsoleView deps={deps} t={t} canRun />);

		await screen.findAllByText(CODE);
		const connectSwitch = screen.getByLabelText("diag.tools.connect.name") as HTMLElement;
		expect(connectSwitch.getAttribute("aria-checked")).toBe("true");

		await user.click(connectSwitch);
		await waitFor(() => expect(settings().tools).toMatchObject({ connect: false, status: true }));
	});

	it("prints the last command it ran, code included", async () => {
		const user = userEvent.setup();
		const { deps } = harness();
		render(<TodeskConsoleView deps={deps} t={t} canRun />);

		await screen.findAllByText(CODE);
		await user.type(screen.getByLabelText("connect.deviceId"), "111222333");
		await user.type(screen.getByLabelText("connect.password"), "a12345");
		await user.click(screen.getByRole("button", { name: "connect.action" }));

		expect(await screen.findByText("ToDesk.exe -control -id 111222333 -passwd a12345")).toBeTruthy();
	});

	it("has no MCP channel or token controls", async () => {
		const { deps } = harness();
		render(<TodeskConsoleView deps={deps} t={t} canRun />);
		await screen.findAllByText(CODE);
		expect(screen.queryByLabelText("token.title")).toBeNull();
		expect(screen.queryByText(/channel\./)).toBeNull();
	});

	it("shows a session row with a working disconnect after connecting", async () => {
		const user = userEvent.setup();
		const { deps, runs } = harness();
		render(<TodeskConsoleView deps={deps} t={t} canRun />);

		await screen.findAllByText(CODE);
		await user.type(screen.getByLabelText("connect.deviceId"), "111222333");
		await user.type(screen.getByLabelText("connect.password"), "a12345");
		await user.click(screen.getByRole("button", { name: "connect.action" }));

		expect(await screen.findByText("session.started(111222333)")).toBeTruthy();
		await user.click(screen.getByRole("button", { name: "session.disconnect" }));

		await waitFor(() => expect(runs.some((run) => run.args.join(" ") === "-exit")).toBe(true));
		expect(await screen.findByText("session.ended(111222333)")).toBeTruthy();
		// the client is gone, so the identity block must stop claiming it runs
		expect(screen.queryByRole("button", { name: "session.disconnect" })).toBeNull();
	});

	it("re-reads this machine's code on demand instead of leaving it stale", async () => {
		const user = userEvent.setup();
		const { deps, runs } = harness();
		render(<TodeskConsoleView deps={deps} t={t} canRun />);

		await screen.findAllByText(CODE);
		const before = runs.filter((run) => run.args[0] === "-status").length;
		await user.click(screen.getByRole("button", { name: "connect.ownRefresh" }));
		await waitFor(() => expect(runs.filter((run) => run.args[0] === "-status").length).toBeGreaterThan(before));
	});

	it("reports an unavailable client inline instead of toasting", async () => {
		const user = userEvent.setup();
		const { deps } = harness({ failRun: true });
		render(<TodeskConsoleView deps={deps} t={t} canRun />);

		await screen.findByText("local.commandDenied");
		await user.click(screen.getByRole("button", { name: "device.open" }));
		// still a sentence on the panel (identity block + connect note), never a toast
		expect((await screen.findAllByText("local.commandDenied")).length).toBeGreaterThanOrEqual(1);
	});
});
