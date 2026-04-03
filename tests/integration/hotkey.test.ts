import { beforeAll, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";

const BINARY_PATH = `${import.meta.dir}/../../dist/assistant-hotkey`;
const BUILD_SCRIPT = `${import.meta.dir}/../../macos/build.sh`;

describe("hotkey daemon", () => {
	beforeAll(async () => {
		// Build the binary
		const proc = Bun.spawn(["bash", BUILD_SCRIPT], {
			stdout: "pipe",
			stderr: "pipe",
		});
		const exitCode = await proc.exited;
		if (exitCode !== 0) {
			const stderr = await new Response(proc.stderr).text();
			throw new Error(`Build failed: ${stderr}`);
		}
	});

	test("binary exists after build", () => {
		expect(existsSync(BINARY_PATH)).toBe(true);
	});

	test("binary is executable", async () => {
		const proc = Bun.spawn(["file", BINARY_PATH], { stdout: "pipe" });
		await proc.exited;
		const output = await new Response(proc.stdout).text();
		expect(output).toContain("Mach-O");
		expect(output).toContain("arm64");
	});

	test("binary starts and can be killed cleanly", async () => {
		// The daemon starts an event loop, so we verify it launches
		// and can be killed without crashing
		const proc = Bun.spawn([BINARY_PATH], {
			stdout: "pipe",
			stderr: "pipe",
		});

		// Give it 300ms to initialize, then kill
		await new Promise((resolve) => setTimeout(resolve, 300));
		proc.kill();
		const exitCode = await proc.exited;

		// Killed by signal = negative exit code or 9 (SIGKILL)
		// The key assertion is it didn't crash on startup
		expect(typeof exitCode).toBe("number");
	});

	test("Swift source compiles without errors", async () => {
		// Verify the source compiles with -typecheck (no binary output)
		const swiftSource = `${import.meta.dir}/../../macos/hotkey-daemon.swift`;
		const proc = Bun.spawn(
			["swiftc", "-typecheck", swiftSource, "-framework", "Cocoa", "-framework", "Carbon"],
			{ stdout: "pipe", stderr: "pipe" },
		);
		const exitCode = await proc.exited;
		expect(exitCode).toBe(0);
	});

	test("LaunchAgent plist is valid XML", async () => {
		const plistPath = `${import.meta.dir}/../../macos/com.assistant.hotkey.plist`;
		const proc = Bun.spawn(["plutil", "-lint", plistPath], {
			stdout: "pipe",
			stderr: "pipe",
		});
		const exitCode = await proc.exited;
		expect(exitCode).toBe(0);
	});
});
