import { describe, expect, test } from "bun:test";
import { loadConfig } from "../../src/core/config.js";

describe("loadConfig", () => {
	test("loads with default values", () => {
		const config = loadConfig({});
		expect(config.defaultAutonomyLevel).toBe(1);
		expect(config.logLevel).toBe("info");
	});

	test("applies defaults for routing", () => {
		const config = loadConfig({});
		expect(config.routing.triage).toBe("claude");
		expect(config.routing.simple).toBe("claude");
		expect(config.routing.complex).toBe("claude");
		expect(config.routing.code).toBe("codex");
	});

	test("applies safety defaults", () => {
		const config = loadConfig({});
		expect(config.safety.countdownSeconds).toBe(5);
		expect(config.safety.auditLogEnabled).toBe(true);
	});

	test("overrides defaults with provided values", () => {
		const config = loadConfig({
			defaultAutonomyLevel: 3,
			maxContextTokens: 4000,
			logLevel: "debug",
		});
		expect(config.defaultAutonomyLevel).toBe(3);
		expect(config.maxContextTokens).toBe(4000);
		expect(config.logLevel).toBe("debug");
	});

	test("rejects invalid autonomy level", () => {
		expect(() => loadConfig({ defaultAutonomyLevel: 5 })).toThrow();
	});

	test("allows custom routing", () => {
		const config = loadConfig({
			routing: { triage: "codex", simple: "codex", complex: "claude", code: "codex" },
		});
		expect(config.routing.triage).toBe("codex");
		expect(config.routing.complex).toBe("claude");
	});
});
