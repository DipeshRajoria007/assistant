import { beforeEach, describe, expect, test } from "bun:test";
import { executeShell } from "../../src/actions/executors/shell.js";
import { setupTestConfig } from "../setup.js";

describe("executeShell", () => {
	beforeEach(() => {
		setupTestConfig();
	});

	describe("successful commands", () => {
		test("executes a simple command and captures stdout", async () => {
			const result = await executeShell({
				command: "echo",
				args: ["hello world"],
			});

			expect(result.success).toBe(true);
			expect(result.stdout.trim()).toBe("hello world");
			expect(result.stderr).toBe("");
			expect(result.exitCode).toBe(0);
			expect(result.durationMs).toBeGreaterThan(0);
		});

		test("captures multi-line output", async () => {
			const result = await executeShell({
				command: "printf",
				args: ["line1\\nline2\\nline3"],
			});

			expect(result.success).toBe(true);
			expect(result.stdout).toContain("line1");
			expect(result.stdout).toContain("line2");
			expect(result.stdout).toContain("line3");
		});

		test("respects working directory", async () => {
			const result = await executeShell({
				command: "pwd",
				args: [],
				cwd: "/tmp",
			});

			expect(result.success).toBe(true);
			// /tmp on macOS resolves to /private/tmp
			expect(result.stdout.trim()).toMatch(/\/?tmp$/);
		});

		test("passes environment variables", async () => {
			const result = await executeShell({
				command: "sh",
				args: ["-c", "echo $TEST_VAR"],
				env: { TEST_VAR: "test_value_123" },
			});

			expect(result.success).toBe(true);
			expect(result.stdout.trim()).toBe("test_value_123");
		});

		test("returns exit code 0 for successful commands", async () => {
			const result = await executeShell({
				command: "true",
				args: [],
			});

			expect(result.exitCode).toBe(0);
			expect(result.success).toBe(true);
		});
	});

	describe("failing commands", () => {
		test("captures non-zero exit code", async () => {
			const result = await executeShell({
				command: "false",
				args: [],
			});

			expect(result.success).toBe(false);
			expect(result.exitCode).not.toBe(0);
		});

		test("captures stderr output", async () => {
			const result = await executeShell({
				command: "sh",
				args: ["-c", "echo error_msg >&2; exit 1"],
			});

			expect(result.success).toBe(false);
			expect(result.stderr.trim()).toBe("error_msg");
		});

		test("handles non-existent command gracefully", async () => {
			const result = await executeShell({
				command: "this_command_does_not_exist_xyz",
				args: [],
			});

			expect(result.success).toBe(false);
			expect(result.error).toBeDefined();
		});
	});

	describe("timeout enforcement", () => {
		test("kills long-running commands after timeout", async () => {
			const result = await executeShell({
				command: "sleep",
				args: ["30"],
				timeout: 500,
			});

			expect(result.success).toBe(false);
			expect(result.timedOut).toBe(true);
			expect(result.durationMs).toBeLessThan(5000);
		});

		test("completes fast commands within timeout", async () => {
			const result = await executeShell({
				command: "echo",
				args: ["fast"],
				timeout: 5000,
			});

			expect(result.success).toBe(true);
			expect(result.timedOut).toBe(false);
		});
	});

	describe("safety integration", () => {
		test("blocks dangerous commands", async () => {
			const result = await executeShell({
				command: "sudo",
				args: ["rm", "-rf", "/"],
				safetyCheck: true,
			});

			expect(result.success).toBe(false);
			expect(result.blocked).toBe(true);
			expect(result.error).toContain("blocked");
		});

		test("blocks rm -rf /", async () => {
			const result = await executeShell({
				command: "rm",
				args: ["-rf", "/"],
				safetyCheck: true,
			});

			expect(result.success).toBe(false);
			expect(result.blocked).toBe(true);
		});

		test("allows safe read-only commands", async () => {
			const result = await executeShell({
				command: "ls",
				args: ["-la"],
				safetyCheck: true,
			});

			expect(result.success).toBe(true);
			expect(result.blocked).toBe(false);
		});

		test("skips safety check when disabled", async () => {
			// date is safe anyway, but testing the flag path
			const result = await executeShell({
				command: "date",
				args: [],
				safetyCheck: false,
			});

			expect(result.success).toBe(true);
		});
	});

	describe("output limits", () => {
		test("truncates excessively long output", async () => {
			// Generate ~200KB of output
			const result = await executeShell({
				command: "sh",
				args: ["-c", "yes 'abcdefghij' | head -n 20000"],
				maxOutputBytes: 10000,
			});

			expect(result.success).toBe(true);
			expect(result.stdout.length).toBeLessThanOrEqual(10100); // some tolerance
			expect(result.truncated).toBe(true);
		});

		test("does not truncate small output", async () => {
			const result = await executeShell({
				command: "echo",
				args: ["small"],
				maxOutputBytes: 10000,
			});

			expect(result.success).toBe(true);
			expect(result.truncated).toBe(false);
		});
	});
});
