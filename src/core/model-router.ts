import { getCLIs, getConfig } from "./config.js";
import { createLogger } from "./logger.js";

const log = createLogger("model-router");

/** Task complexity determines which CLI/model handles the request */
export type TaskComplexity = "triage" | "simple" | "complex" | "code";

/** Which CLI to use */
export type CLIProvider = "claude" | "codex";

/** Message format for conversations */
export interface ChatMessage {
	role: "user" | "assistant" | "system";
	content: string;
}

export interface RouterResponse {
	content: string;
	provider: CLIProvider;
	durationMs: number;
}

/** Classify how complex a task is — determines routing */
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

	// Complex: multi-step, planning, reasoning, long inputs (checked before code)
	const complexPatterns = [
		/\b(plan|design|architect|analyze|compare|evaluate)\b/,
		/\b(step.by.step|break.down|think.through|figure.out)\b/,
		/\b(why|how|explain.in.detail|what.are.the.tradeoffs)\b/,
		/\band\b.*\band\b.*\band\b/,
	];
	if (complexPatterns.some((p) => p.test(lower)) || input.length > 500) {
		return "complex";
	}

	// Code tasks: writing, fixing, reviewing code
	const codePatterns = [
		/\b(write|create|generate|implement)\b.*\b(code|function|class|component|module|test|file)\b/,
		/\b(fix|debug|patch|refactor)\b.*\b(bug|error|code|function)\b/,
		/\b(review|optimize)\b.*\b(code|pull request|pr|diff)\b/,
		/```/, // contains code blocks
	];
	if (codePatterns.some((p) => p.test(lower))) {
		return "code";
	}

	return "simple";
}

/** Get which CLI provider to use for a given complexity */
export function getProviderForComplexity(complexity: TaskComplexity): CLIProvider {
	const config = getConfig();
	return config.routing[complexity];
}

/** Send a message to the appropriate CLI based on complexity */
export async function routeMessage(
	messages: ChatMessage[],
	complexity?: TaskComplexity,
): Promise<RouterResponse> {
	const lastUserMessage = messages.findLast((m: ChatMessage) => m.role === "user");
	const autoComplexity = complexity ?? classifyComplexity(lastUserMessage?.content ?? "");
	const provider = getProviderForComplexity(autoComplexity);

	log.info(`Routing to ${provider}`, { complexity: autoComplexity });

	const start = performance.now();

	// Build the prompt from messages
	const systemMessage = messages.find((m) => m.role === "system");
	const prompt = buildPrompt(messages, systemMessage?.content);

	const content = await callCLI(provider, prompt);
	const durationMs = Math.round(performance.now() - start);

	log.info("Response received", { provider, durationMs });

	return { content, provider, durationMs };
}

/** Build a single prompt string from conversation messages */
function buildPrompt(messages: ChatMessage[], systemPrompt?: string): string {
	const parts: string[] = [];

	if (systemPrompt) {
		parts.push(systemPrompt);
	}

	// Include recent conversation context (last few exchanges)
	const conversationMessages = messages.filter((m) => m.role !== "system").slice(-6);
	for (const msg of conversationMessages) {
		if (msg.role === "user") {
			parts.push(msg.content);
		} else if (msg.role === "assistant") {
			parts.push(`[Previous response]: ${msg.content.slice(0, 500)}`);
		}
	}

	return parts.join("\n\n");
}

/** Call a CLI tool and return the response text */
async function callCLI(provider: CLIProvider, prompt: string): Promise<string> {
	const clis = getCLIs();

	if (provider === "claude") {
		return callClaude(clis.claude, prompt);
	}
	return callCodex(clis.codex, prompt);
}

async function callClaude(binaryPath: string | null, prompt: string): Promise<string> {
	if (!binaryPath) {
		throw new Error("Claude CLI not found. Install it from https://claude.ai/download");
	}

	const proc = Bun.spawn([binaryPath, "-p", "--output-format", "text", prompt], {
		stdout: "pipe",
		stderr: "pipe",
	});

	const exitCode = await proc.exited;
	const stdout = await new Response(proc.stdout).text();
	const stderr = await new Response(proc.stderr).text();

	if (exitCode !== 0) {
		log.error("Claude CLI failed", { exitCode, stderr });
		throw new Error(`Claude CLI exited with code ${exitCode}: ${stderr.slice(0, 200)}`);
	}

	return stdout.trim();
}

async function callCodex(binaryPath: string | null, prompt: string): Promise<string> {
	if (!binaryPath) {
		throw new Error("Codex CLI not found. Install it via npm: npm i -g @openai/codex");
	}

	const proc = Bun.spawn([binaryPath, "exec", prompt], { stdout: "pipe", stderr: "pipe" });

	const exitCode = await proc.exited;
	const stdout = await new Response(proc.stdout).text();
	const stderr = await new Response(proc.stderr).text();

	if (exitCode !== 0) {
		log.error("Codex CLI failed", { exitCode, stderr });
		throw new Error(`Codex CLI exited with code ${exitCode}: ${stderr.slice(0, 200)}`);
	}

	// Codex output includes metadata — extract just the response
	return parseCodexOutput(stdout);
}

/** Extract the actual response from Codex CLI output (strips metadata) */
function parseCodexOutput(raw: string): string {
	// Codex output has headers and a "codex\n" prefix before actual content
	const lines = raw.split("\n");

	// Find where actual content starts (after "codex" line or metadata)
	let contentStart = 0;
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line === "codex") {
			contentStart = i + 1;
			break;
		}
	}

	// Find where content ends (before "tokens used" or similar footer)
	let contentEnd = lines.length;
	for (let i = lines.length - 1; i >= contentStart; i--) {
		const line = lines[i];
		if (line === "tokens used" || line?.startsWith("tokens used")) {
			contentEnd = i;
			break;
		}
	}

	return lines.slice(contentStart, contentEnd).join("\n").trim();
}
