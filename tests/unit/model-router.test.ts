import { beforeEach, describe, expect, test } from "bun:test";
import { classifyComplexity, getModelForComplexity } from "../../src/core/model-router.js";
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
		expect(classifyComplexity("Create a new file called test.ts")).toBe("simple");
	});

	test("classifies compound tasks as complex", () => {
		expect(classifyComplexity("Check the logs and find the error and fix the bug and deploy")).toBe(
			"complex",
		);
	});
});

describe("getModelForComplexity", () => {
	beforeEach(() => {
		setupTestConfig();
	});

	test("returns haiku for triage", () => {
		expect(getModelForComplexity("triage")).toBe("claude-haiku-4-5-20251001");
	});

	test("returns sonnet for simple", () => {
		expect(getModelForComplexity("simple")).toBe("claude-sonnet-4-6-20260320");
	});

	test("returns opus for complex", () => {
		expect(getModelForComplexity("complex")).toBe("claude-opus-4-6-20260320");
	});
});
