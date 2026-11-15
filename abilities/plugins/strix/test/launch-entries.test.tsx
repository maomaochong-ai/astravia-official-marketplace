import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LaunchScreen } from "../src/features/scan-console/components/launch-screen";

/**
 * 首屏这一版新增的四块（1.2.2），从 DOM 上验：
 *
 *  1. 桥接状态在「连接」里，而不是独占底部一行；
 *  2. 「自动」说它这次会怎么做，而不是一律"本机"；
 *  3. 容器可用时出现「安装位置」，点开是两列表：宿主路径可打开、容器路径只复制；
 *  4. 底部有免责声明，小字、可读、在事实表下面。
 */

afterEach(cleanup);

const t = (key: string, params?: Record<string, string | number>) => (params ? `${key} ${JSON.stringify(params)}` : key);
const model = { modelKey: "openrouter/z-ai/glm-5.3", name: "glm-5.3", provider: "openrouter/z-ai" };

const installPaths = {
	platform: "win32",
	mode: "docker" as const,
	image: "ghcr.io/usestrix/strix-sandbox:1.4.0",
	container: "astravia-strix-abc",
	entries: [
		{ id: "docker-win32-docker 程序", scope: "host" as const, os: "win32" as const, label: "docker 程序", path: "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe", exists: true },
		{ id: "host-data", scope: "host" as const, os: "win32" as const, label: "台账与笔记", path: "C:\\Users\\me\\AppData\\Roaming\\astravia\\strix", exists: false },
		{ id: "container-/workspace", scope: "container" as const, os: "win32" as const, label: "工作目录", path: "/workspace", command: "docker exec -it astravia-strix-abc sh -lc 'ls -ld /workspace'" },
		{ id: "reference-darwin", scope: "reference" as const, os: "darwin" as const, label: "macOS 默认 docker", path: "/usr/local/bin/docker" },
	],
};

function renderLaunch(overrides: Record<string, unknown> = {}) {
	return render(
		<LaunchScreen
			t={t}
			model={model}
			log={[]}
			boot={{ state: "ready" }}
			version="1.2.2"
			onQuit={() => undefined}
			{...overrides}
		/>,
	);
}

describe("the footer block is gone, the bridge state moved into 连接", () => {
	it("no longer renders a standalone footer with the bridge line", () => {
		const { container } = renderLaunch();
		expect(container.querySelector(".astra-strix-launch-foot")).toBeNull();
		// 桥接状态现在在连接那一组里。
		const bridge = container.querySelector(".astra-strix-bridge-line");
		expect(bridge).toBeTruthy();
		expect(bridge?.textContent).toContain("boot.ready");
		expect(bridge?.textContent).toContain("v1.2.2");
	});
});

describe("auto says what it will do", () => {
	it("reports the container when the service resolved to docker", () => {
		const { container } = renderLaunch({
			environmentMode: "auto",
			resolvedMode: "docker",
			docker: { ready: true, imagePresent: true },
		});
		expect(container.textContent).toContain("env.statusAutoDocker");
		expect(container.textContent).not.toContain("env.statusHost");
	});

	it("reports the local machine when there is no daemon", () => {
		const { container } = renderLaunch({
			environmentMode: "auto",
			resolvedMode: "host",
			docker: { ready: false, imagePresent: null },
		});
		expect(container.textContent).toContain("env.statusAutoHost");
	});
});

describe("install locations appear only in container mode", () => {
	it("is absent when the run is on the host", () => {
		const { container } = renderLaunch({ environmentMode: "host", resolvedMode: "host", installPaths });
		expect(container.querySelector(".astra-strix-paths-row")).toBeNull();
	});

	it("opens into a table and copies container paths instead of opening them", async () => {
		const onOpenPath = vi.fn();
		const writeText = vi.fn().mockResolvedValue(undefined);
		Object.assign(navigator, { clipboard: { writeText } });

		const { container } = renderLaunch({ environmentMode: "docker", resolvedMode: "docker", installPaths, onOpenPath });

		const toggle = container.querySelector(".astra-strix-paths-toggle") as HTMLButtonElement;
		expect(toggle).toBeTruthy();
		fireEvent.click(toggle);
		const lines = [...container.querySelectorAll(".astra-strix-path-line")];
		expect(lines).toHaveLength(4);

		// 宿主路径存在 → 打开；不存在 → 只复制路径。
		fireEvent.click(lines[0]!);
		expect(onOpenPath).toHaveBeenCalledWith(installPaths.entries[0]!.path);
		fireEvent.click(lines[1]!);
		expect(onOpenPath).toHaveBeenCalledTimes(1);
		expect(writeText).toHaveBeenCalledWith(installPaths.entries[1]!.path);

		// 容器路径 → 复制 docker exec 命令，绝不调用"打开"。
		fireEvent.click(lines[2]!);
		expect(onOpenPath).toHaveBeenCalledTimes(1);
		expect(writeText).toHaveBeenCalledWith(installPaths.entries[2]!.command);
	});
});

describe("the disclaimer sits under the facts", () => {
	it("renders small print with a title and two paragraphs", () => {
		const { container } = renderLaunch();
		const legal = container.querySelector(".astra-strix-disclaimer");
		expect(legal).toBeTruthy();
		expect(legal?.querySelector(".astra-strix-disclaimer-title")?.textContent).toBe("legal.title");
		expect(legal?.querySelector(".astra-strix-disclaimer-body")?.textContent).toBe("legal.body");
		expect(legal?.querySelector(".astra-strix-disclaimer-dim")?.textContent).toBe("legal.scope");
	});

	it("comes after the fact table, not before it", () => {
		const { container } = renderLaunch();
		const rows = container.querySelector(".astra-strix-rows");
		const legal = container.querySelector(".astra-strix-disclaimer");
		expect(rows && legal).toBeTruthy();
		// compareDocumentPosition: 4 = legal follows rows
		expect(rows!.compareDocumentPosition(legal!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
	});
});

describe("the head is centred and the hint line is gone", () => {
	it("has no composer hint line any more", () => {
		const { container } = renderLaunch({ onSend: () => undefined });
		expect(container.querySelector(".astra-strix-composer-hint")).toBeNull();
	});
});
