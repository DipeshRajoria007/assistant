import { beforeEach, describe, expect, test } from "bun:test";
import { executeAction } from "../../src/actions/executor.js";
import type { ActionPayload } from "../../src/types/action.js";
import { setupTestConfig } from "../setup.js";

describe("executeAction", () => {
	beforeEach(() => {
		setupTestConfig();
	});

	test("executes shell commands end-to-end", async () => {
		const payload: ActionPayload = {
			type: "shell",
			command: "echo",
			args: ["integration test"],
		};

		const result = await executeAction("act-1", "task-1", payload);

		expect(result.success).toBe(true);
		expect(result.output?.trim()).toBe("integration test");
		expect(result.actionId).toBe("act-1");
		expect(result.durationMs).toBeGreaterThanOrEqual(0);
	});

	test("blocks dangerous shell commands through safety gate", async () => {
		const payload: ActionPayload = {
			type: "shell",
			command: "sudo",
			args: ["rm", "-rf", "/"],
		};

		const result = await executeAction("act-2", "task-1", payload);

		expect(result.success).toBe(false);
		expect(result.error).toContain("blocked");
	});

	test("returns not-implemented for applescript", async () => {
		const payload: ActionPayload = {
			type: "applescript",
			script: 'tell application "Finder" to get name',
			language: "applescript",
		};

		const result = await executeAction("act-3", "task-1", payload);

		expect(result.success).toBe(false);
		expect(result.error).toContain("not yet implemented");
	});

	test("returns not-implemented for accessibility", async () => {
		const payload: ActionPayload = {
			type: "accessibility",
			app: "Safari",
			actions: [{ element: { role: "AXButton" }, action: "press" }],
		};

		const result = await executeAction("act-4", "task-1", payload);

		expect(result.success).toBe(false);
		expect(result.error).toContain("not yet implemented");
	});

	test("returns not-implemented for vision", async () => {
		const payload: ActionPayload = {
			type: "vision",
			description: "Click send",
			targetElement: "Send",
			action: "click",
		};

		const result = await executeAction("act-5", "task-1", payload);

		expect(result.success).toBe(false);
		expect(result.error).toContain("not yet implemented");
	});

	test("returns not-implemented for API", async () => {
		const payload: ActionPayload = {
			type: "api",
			service: "github",
			method: "createPR",
			params: {},
		};

		const result = await executeAction("act-6", "task-1", payload);

		expect(result.success).toBe(false);
		expect(result.error).toContain("not yet implemented");
	});

	test("captures failing command output", async () => {
		const payload: ActionPayload = {
			type: "shell",
			command: "ls",
			args: ["/nonexistent_dir_12345"],
		};

		const result = await executeAction("act-7", "task-1", payload);

		expect(result.success).toBe(false);
		expect(result.error).toBeDefined();
	});
});
