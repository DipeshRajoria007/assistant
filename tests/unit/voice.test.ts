import { describe, expect, test } from "bun:test";
import { parseCommand } from "../../src/cli/formatter.js";
import { detectVoiceMethod, isVoiceAvailable } from "../../src/cli/voice.js";

describe("voice input", () => {
	test("/voice command is parsed correctly", () => {
		const cmd = parseCommand("/voice");
		expect(cmd.type).toBe("voice");
	});

	test("/v shortcut is parsed correctly", () => {
		const cmd = parseCommand("/v");
		expect(cmd.type).toBe("voice");
	});

	test("isVoiceAvailable returns boolean", async () => {
		const result = await isVoiceAvailable();
		expect(typeof result).toBe("boolean");
	});

	test("detectVoiceMethod returns a valid method or null", async () => {
		const method = await detectVoiceMethod();
		expect(method === null || method === "swift" || method === "ffmpeg").toBe(true);
	});

	test("detectVoiceMethod finds ffmpeg+claude on this machine", async () => {
		const method = await detectVoiceMethod();
		expect(method).not.toBeNull();
	});
});
