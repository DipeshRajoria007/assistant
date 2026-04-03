import { describe, expect, test } from "bun:test";
import {
	WELCOME_BANNER,
	formatActions,
	formatResponse,
	parseCommand,
} from "../../src/cli/formatter.js";
import type { PendingAction } from "../../src/core/agent-loop.js";
import { SafetyLevel } from "../../src/types/action.js";

describe("parseCommand", () => {
	test("parses /quit command", () => {
		const cmd = parseCommand("/quit");
		expect(cmd.type).toBe("quit");
	});

	test("parses /exit command", () => {
		const cmd = parseCommand("/exit");
		expect(cmd.type).toBe("quit");
	});

	test("parses /help command", () => {
		const cmd = parseCommand("/help");
		expect(cmd.type).toBe("help");
	});

	test("parses /status command", () => {
		const cmd = parseCommand("/status");
		expect(cmd.type).toBe("status");
	});

	test("parses /goals command", () => {
		const cmd = parseCommand("/goals");
		expect(cmd.type).toBe("goals");
	});

	test("parses /clear command", () => {
		const cmd = parseCommand("/clear");
		expect(cmd.type).toBe("clear");
	});

	test("parses /history command", () => {
		const cmd = parseCommand("/history");
		expect(cmd.type).toBe("history");
	});

	test("parses unknown slash command", () => {
		const cmd = parseCommand("/unknown");
		expect(cmd.type).toBe("unknown");
		if (cmd.type === "unknown") expect(cmd.raw).toBe("/unknown");
	});

	test("parses regular message", () => {
		const cmd = parseCommand("open slack");
		expect(cmd.type).toBe("message");
		if (cmd.type === "message") expect(cmd.raw).toBe("open slack");
	});

	test("parses message with leading spaces", () => {
		const cmd = parseCommand("  hello  ");
		expect(cmd.type).toBe("message");
		if (cmd.type === "message") expect(cmd.raw).toBe("hello");
	});

	test("parses empty input", () => {
		const cmd = parseCommand("");
		expect(cmd.type).toBe("empty");
	});

	test("parses whitespace-only input", () => {
		const cmd = parseCommand("   ");
		expect(cmd.type).toBe("empty");
	});
});

describe("formatResponse", () => {
	test("formats a basic response", () => {
		const output = formatResponse("Hello, how can I help?", "claude", 150);
		expect(output).toContain("Hello, how can I help?");
		expect(output).toContain("claude");
		expect(output).toContain("150ms");
	});

	test("includes provider info", () => {
		const output = formatResponse("response", "codex", 500);
		expect(output).toContain("codex");
	});
});

describe("formatActions", () => {
	test("returns empty string for no actions", () => {
		expect(formatActions([])).toBe("");
	});

	test("formats a single action", () => {
		const actions: PendingAction[] = [
			{
				id: "1",
				description: "List files",
				method: "shell",
				payload: { type: "shell", command: "ls", args: ["-la"] },
				safetyLevel: SafetyLevel.SAFE,
				approval: "auto",
				warnings: [],
			},
		];

		const output = formatActions(actions);
		expect(output).toContain("List files");
		expect(output).toContain("SAFE");
		expect(output).toContain("auto");
	});

	test("formats blocked action with warning", () => {
		const actions: PendingAction[] = [
			{
				id: "2",
				description: "Delete everything",
				method: "shell",
				payload: { type: "shell", command: "rm", args: ["-rf", "/"] },
				safetyLevel: SafetyLevel.BLOCKED,
				approval: "blocked",
				warnings: ["Destructive operation"],
			},
		];

		const output = formatActions(actions);
		expect(output).toContain("BLOCKED");
		expect(output).toContain("Delete everything");
	});

	test("formats multiple actions", () => {
		const actions: PendingAction[] = [
			{
				id: "1",
				description: "Check git status",
				method: "shell",
				payload: { type: "shell", command: "git", args: ["status"] },
				safetyLevel: SafetyLevel.SAFE,
				approval: "auto",
				warnings: [],
			},
			{
				id: "2",
				description: "Push to remote",
				method: "shell",
				payload: { type: "shell", command: "git", args: ["push"] },
				safetyLevel: SafetyLevel.MEDIUM,
				approval: "countdown",
				warnings: [],
			},
		];

		const output = formatActions(actions);
		expect(output).toContain("Check git status");
		expect(output).toContain("Push to remote");
	});
});

describe("WELCOME_BANNER", () => {
	test("contains project name", () => {
		expect(WELCOME_BANNER).toContain("Assistant");
	});

	test("contains version info", () => {
		expect(WELCOME_BANNER).toContain("0.1.0");
	});

	test("contains help hint", () => {
		expect(WELCOME_BANNER).toContain("/help");
	});
});
