import { describe, expect, it } from "vitest";
import { looksLikeTarget, parseLaunchPrompt } from "../domain/launch-request";

/**
 * The launch prompt is read the way upstream reads it (setup.go:submitSetupPrompt):
 * scannable tokens become targets, anything else becomes the instruction. A prompt
 * that is only instructions must still launch, and a prompt that is only targets
 * must not acquire an instruction.
 */
describe("launch prompt", () => {
	it("recognises the five shapes upstream treats as a target", () => {
		for (const token of [
			"https://app.example.com",
			"https://github.com/org/repo.git",
			"./app-directory",
			"/srv/code",
			"example.com",
			"192.168.1.42",
		]) {
			expect(looksLikeTarget(token), token).toBe(true);
		}
	});

	it("does not read prose as a target", () => {
		for (const token of ["test", "the", "api", "v1.2", "example", ""]) {
			expect(looksLikeTarget(token), token).toBe(false);
		}
	});

	it("splits targets from the method", () => {
		expect(parseLaunchPrompt("scan https://app.example.com for IDOR")).toEqual({
			targets: ["https://app.example.com"],
			instruction: "scan https://app.example.com for IDOR",
		});
	});

	it("keeps a target-only prompt free of an instruction", () => {
		expect(parseLaunchPrompt("example.com")).toEqual({ targets: ["example.com"], instruction: "" });
	});

	it("passes a method-only prompt through as the instruction", () => {
		expect(parseLaunchPrompt("review the auth flow of the current project")).toEqual({
			targets: [],
			instruction: "review the auth flow of the current project",
		});
	});

	it("de-duplicates against targets the assessment already has", () => {
		expect(parseLaunchPrompt("example.com and api.example.com", ["example.com"]).targets).toEqual([
			"api.example.com",
		]);
	});
});
