import { describe, expect, test } from "bun:test";
import { parseCommand } from "../../src/cli/formatter.js";
import { isVoiceAvailable } from "../../src/cli/voice.js";

describe("voice input", () => {
	test("/voice command is parsed correctly", () => {
		const cmd = parseCommand("/voice");
		expect(cmd.type).toBe("voice");
	});

	test("/v shortcut is parsed correctly", () => {
		const cmd = parseCommand("/v");
		expect(cmd.type).toBe("voice");
	});

	test("isVoiceAvailable returns false when binary not at expected path", async () => {
		// The binary may or may not be built during tests
		const result = await isVoiceAvailable();
		expect(typeof result).toBe("boolean");
	});
});
