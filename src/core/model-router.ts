import Anthropic from "@anthropic-ai/sdk";
import { getConfig } from "./config.js";
import { createLogger } from "./logger.js";

const log = createLogger("model-router");

/** Task complexity determines which model handles the request */
export type TaskComplexity = "triage" | "simple" | "complex";

/** Message format compatible across providers */
export interface ChatMessage {
	role: "user" | "assistant" | "system";
	content: string;
}

export interface RouterResponse {
	content: string;
	model: string;
	inputTokens: number;
	outputTokens: number;
	durationMs: number;
}

/** Classify how complex a task is — determines model routing */
export function classifyComplexity(input: string): TaskComplexity {
	const lower = input.toLowerCase();

	// Triage: yes/no questions, classifications, simple lookups
	const triagePatterns = [
		/^(is|are|was|were|do|does|did|can|could|should|will|would)\s/,
		/^(what time|what date|what day)/,
		/^(classify|categorize|label|tag)\s/,
		/\b(true or false|yes or no)\b/,
	];
	if (triagePatterns.some((p) => p.test(lower)) && input.length < 200) {
		return "triage";
	}

	// Complex: multi-step, planning, reasoning, long inputs
	const complexPatterns = [
		/\b(plan|design|architect|implement|refactor|debug|analyze|compare|evaluate)\b/,
		/\b(step.by.step|break.down|think.through|figure.out)\b/,
		/\b(why|how|explain.in.detail|what.are.the.tradeoffs)\b/,
		/\band\b.*\band\b.*\band\b/, // multiple "and"s suggest compound task
	];
	if (complexPatterns.some((p) => p.test(lower)) || input.length > 500) {
		return "complex";
	}

	// Default to simple
	return "simple";
}

/** Get the model ID for a given complexity level */
export function getModelForComplexity(complexity: TaskComplexity): string {
	const config = getConfig();
	const routing = config.modelRouting;

	switch (complexity) {
		case "triage":
			return routing.triage;
		case "simple":
			return routing.simple;
		case "complex":
			return routing.complex;
	}
}

/** Send a message to the appropriate model based on complexity */
export async function routeMessage(
	messages: ChatMessage[],
	complexity?: TaskComplexity,
): Promise<RouterResponse> {
	const lastUserMessage = messages.findLast((m: ChatMessage) => m.role === "user");
	const autoComplexity = complexity ?? classifyComplexity(lastUserMessage?.content ?? "");
	const model = getModelForComplexity(autoComplexity);

	log.info(`Routing to ${model}`, { complexity: autoComplexity });

	const start = performance.now();
	const response = await callAnthropic(messages, model);
	const durationMs = Math.round(performance.now() - start);

	log.info("Response received", {
		model,
		inputTokens: response.inputTokens,
		outputTokens: response.outputTokens,
		durationMs,
	});

	return { ...response, durationMs };
}

async function callAnthropic(messages: ChatMessage[], model: string): Promise<RouterResponse> {
	const config = getConfig();
	if (!config.anthropicApiKey) {
		throw new Error("Anthropic API key not configured");
	}

	const client = new Anthropic({ apiKey: config.anthropicApiKey });

	const systemMessage = messages.find((m) => m.role === "system");
	const chatMessages = messages
		.filter((m) => m.role !== "system")
		.map((m) => ({
			role: m.role as "user" | "assistant",
			content: m.content,
		}));

	const response = await client.messages.create({
		model,
		max_tokens: 4096,
		system: systemMessage?.content ?? "",
		messages: chatMessages,
	});

	const content = response.content[0]?.type === "text" ? (response.content[0]?.text ?? "") : "";

	return {
		content,
		model,
		inputTokens: response.usage.input_tokens,
		outputTokens: response.usage.output_tokens,
		durationMs: 0, // filled by caller
	};
}
