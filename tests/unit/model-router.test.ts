import { beforeEach, describe, expect, test } from "bun:test";
import { classifyComplexity, getProviderForComplexity } from "../../src/core/model-router.js";
import { setupTestConfig } from "../setup.js";

describe("classifyComplexity", () => {
	test("classifies yes/no questions as triage", () => {
		expect(classifyComplexity("Is the build passing?")).toBe("triage");
		expect(classifyComplexity("Can you open VS Code?")).toBe("triage");
		expect(classifyComplexity("Does this file exist?")).toBe("triage");
	});

	test("classifies time questions as triage", () => {
		expect(classifyComplexity("What time is my next meeting?")).toBe("triage");
		expect(classifyComplexity("What date is the deadline?")).toBe("triage");
	});

	test("classifies code generation as code", () => {
		expect(classifyComplexity("Write a function to sort an array")).toBe("code");
		expect(classifyComplexity("Create a React component for the sidebar")).toBe("code");
		expect(classifyComplexity("Fix the bug in the auth code")).toBe("code");
	});

	test("classifies code review as code", () => {
		expect(classifyComplexity("Review the code in this pull request")).toBe("code");
	});

	test("classifies planning/reasoning as complex", () => {
		expect(classifyComplexity("Plan the migration from REST to GraphQL")).toBe("complex");
		expect(classifyComplexity("Analyze the performance bottleneck in the API")).toBe("complex");
		expect(classifyComplexity("Design a caching strategy for the feed")).toBe("complex");
	});

	test("classifies step-by-step requests as complex", () => {
		expect(classifyComplexity("Break down the deployment process step by step")).toBe("complex");
		expect(classifyComplexity("Think through the auth flow")).toBe("complex");
	});

	test("classifies long inputs as complex", () => {
		const longInput = `Please help me with ${"this task ".repeat(60)}`;
		expect(classifyComplexity(longInput)).toBe("complex");
	});

	test("classifies simple requests as simple", () => {
		expect(classifyComplexity("Open Slack")).toBe("simple");
		expect(classifyComplexity("Send a message to the team")).toBe("simple");
	});

	test("classifies compound tasks as complex", () => {
		expect(classifyComplexity("Check the logs and find the error and fix the bug and deploy")).toBe(
			"complex",
		);
	});
});

describe("getProviderForComplexity", () => {
	beforeEach(() => {
		setupTestConfig();
	});

	test("returns claude for triage by default", () => {
		expect(getProviderForComplexity("triage")).toBe("claude");
	});

	test("returns claude for simple by default", () => {
		expect(getProviderForComplexity("simple")).toBe("claude");
	});

	test("returns claude for complex by default", () => {
		expect(getProviderForComplexity("complex")).toBe("claude");
	});

	test("returns codex for code by default", () => {
		expect(getProviderForComplexity("code")).toBe("codex");
	});

	test("respects custom routing config", () => {
		setupTestConfig({
			routing: { triage: "codex", simple: "codex", complex: "claude", code: "codex" },
		});
		expect(getProviderForComplexity("triage")).toBe("codex");
		expect(getProviderForComplexity("simple")).toBe("codex");
	});
});
