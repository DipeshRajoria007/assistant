import { beforeAll, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";

const BINARY_PATH = `${import.meta.dir}/../../dist/assistant-voice`;
const BUILD_SCRIPT = `${import.meta.dir}/../../macos/build.sh`;

describe("voice binary", () => {
	beforeAll(async () => {
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

	test("binary is arm64 Mach-O executable", async () => {
		const proc = Bun.spawn(["file", BINARY_PATH], { stdout: "pipe" });
		await proc.exited;
		const output = await new Response(proc.stdout).text();
		expect(output).toContain("Mach-O");
		expect(output).toContain("arm64");
	});

	test("Swift source compiles without errors", async () => {
		const swiftSource = `${import.meta.dir}/../../macos/voice-input.swift`;
		const proc = Bun.spawn(
			["swiftc", "-typecheck", swiftSource, "-framework", "Speech", "-framework", "AVFoundation"],
			{ stdout: "pipe", stderr: "pipe" },
		);
		const exitCode = await proc.exited;
		expect(exitCode).toBe(0);
	});
});
