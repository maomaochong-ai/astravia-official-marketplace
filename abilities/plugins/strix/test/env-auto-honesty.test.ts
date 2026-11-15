import { describe, expect, it } from "vitest";
import { environmentState } from "../src/features/scan-console/components/launch-screen";

/**
 * 「自动」必须说真话（1.2.2）。
 *
 * 1.2.1 的面板把 preference 字符串本身当判据：只要是 `auto` 就画成「在本机执行」，
 * 于是有 docker 的机器上选了自动，界面写着无容器隔离——服务那边其实跑在容器里。
 *
 * 现在先解析、后命名：`resolved` 是服务算出来的真实落点，preference 只决定措辞。
 */

describe("auto reports where it will actually run", () => {
	it("says container when the service resolved to docker", () => {
		expect(environmentState({ mode: "auto", resolved: "docker", docker: { ready: true, imagePresent: true } })).toBe("autoDocker");
	});

	it("says the image is missing when the daemon is up but the image is not", () => {
		expect(environmentState({ mode: "auto", resolved: "docker", docker: { ready: true, imagePresent: false } })).toBe("autoNoImage");
	});

	it("says it runs on this machine when there is no daemon", () => {
		expect(environmentState({ mode: "auto", resolved: "host", docker: { ready: false, imagePresent: null } })).toBe("autoHost");
	});

	it("does not claim the container when the service resolved to host", () => {
		// daemon 在、但服务判定这次不能用（例如镜像不可达）——跟着服务，不跟着 daemon。
		expect(environmentState({ mode: "auto", resolved: "host", docker: { ready: true, imagePresent: null } })).toBe("autoHost");
	});
});

describe("explicit choices keep their old states", () => {
	it("host is always host, whatever docker says", () => {
		expect(environmentState({ mode: "host", resolved: "docker", docker: { ready: true, imagePresent: true } })).toBe("host");
	});

	it("docker reports its three states", () => {
		expect(environmentState({ mode: "docker", resolved: "docker", docker: { ready: false, imagePresent: null } })).toBe("noDocker");
		expect(environmentState({ mode: "docker", resolved: "docker", docker: { ready: true, imagePresent: false } })).toBe("noImage");
		expect(environmentState({ mode: "docker", resolved: "docker", docker: { ready: true, imagePresent: true } })).toBe("ready");
	});

	it("without a probe, auto does not invent a container", () => {
		expect(environmentState({ mode: "auto" })).toBe("autoHost");
	});
});
