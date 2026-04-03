import { describe, expect, test } from "bun:test";
import { loadConfig } from "../../src/core/config.js";

describe("loadConfig", () => {
	test("loads with valid anthropic key", () => {
		const config = loadConfig({ anthropicApiKey: "sk-test-123" });
		expect(config.anthropicApiKey).toBe("sk-test-123");
		expect(config.defaultAutonomyLevel).toBe(1);
		expect(config.logLevel).toBe("info");
	});

	test("loads with valid ollama url", () => {
		const config = loadConfig({ ollamaBaseUrl: "http://localhost:11434" });
		expect(config.ollamaBaseUrl).toBe("http://localhost:11434");
	});

	test("throws when no LLM provider configured", () => {
		expect(() => loadConfig({})).toThrow("At least one LLM provider");
	});

	test("applies defaults correctly", () => {
		const config = loadConfig({ anthropicApiKey: "sk-test" });
		expect(config.maxContextTokens).toBe(8000);
		expect(config.embeddingProvider).toBe("anthropic");
		expect(config.modelRouting.triage).toBe("claude-haiku-4-5-20251001");
		expect(config.modelRouting.simple).toBe("claude-sonnet-4-6-20260320");
		expect(config.modelRouting.complex).toBe("claude-opus-4-6-20260320");
		expect(config.safety.countdownSeconds).toBe(5);
		expect(config.safety.auditLogEnabled).toBe(true);
	});

	test("overrides defaults with provided values", () => {
		const config = loadConfig({
			anthropicApiKey: "sk-test",
			defaultAutonomyLevel: 3,
			maxContextTokens: 4000,
			logLevel: "debug",
		});
		expect(config.defaultAutonomyLevel).toBe(3);
		expect(config.maxContextTokens).toBe(4000);
		expect(config.logLevel).toBe("debug");
	});

	test("rejects invalid autonomy level", () => {
		expect(() => loadConfig({ anthropicApiKey: "sk-test", defaultAutonomyLevel: 5 })).toThrow();
	});
});
