import { getCLIs, getConfig } from "./config.js";
import { createLogger } from "./logger.js";

const log = createLogger("model-router");

export type TaskComplexity = "triage" | "simple" | "complex" | "code";
export type CLIProvider = "claude" | "codex";

export interface ChatMessage {
	role: "user" | "assistant" | "system";
	content: string;
}

export interface RouterResponse {
	content: string;
	provider: CLIProvider;
	durationMs: number;
}

/** Callback for streaming text chunks */
export type StreamCallback = (chunk: string) => void;

/** Classify task complexity for routing */
export function classifyComplexity(input: string): TaskComplexity {
	const lower = input.toLowerCase();

	const triagePatterns = [
		/^(is|are|was|were|do|does|did|can|could|should|will|would)\s/,
		/^(what time|what date|what day)/,
		/^(classify|categorize|label|tag)\s/,
		/\b(true or false|yes or no)\b/,
	];
	if (triagePatterns.some((p) => p.test(lower)) && input.length < 200) {
		return "triage";
	}

	const complexPatterns = [
		/\b(plan|design|architect|analyze|compare|evaluate)\b/,
		/\b(step.by.step|break.down|think.through|figure.out)\b/,
		/\b(why|how|explain.in.detail|what.are.the.tradeoffs)\b/,
		/\band\b.*\band\b.*\band\b/,
	];
	if (complexPatterns.some((p) => p.test(lower)) || input.length > 500) {
		return "complex";
	}

	const codePatterns = [
		/\b(write|create|generate|implement)\b.*\b(code|function|class|component|module|test|file)\b/,
		/\b(fix|debug|patch|refactor)\b.*\b(bug|error|code|function)\b/,
		/\b(review|optimize)\b.*\b(code|pull request|pr|diff)\b/,
		/```/,
	];
	if (codePatterns.some((p) => p.test(lower))) {
		return "code";
	}

	return "simple";
}

export function getProviderForComplexity(complexity: TaskComplexity): CLIProvider {
	const config = getConfig();
	return config.routing[complexity];
}

/**
 * Send a message with streaming output.
 * The onChunk callback is called for each text fragment as it arrives,
 * giving the user real-time feedback instead of waiting for the full response.
 */
export async function routeMessage(
	messages: ChatMessage[],
	complexity?: TaskComplexity,
	onChunk?: StreamCallback,
): Promise<RouterResponse> {
	const lastUserMessage = messages.findLast((m: ChatMessage) => m.role === "user");
	const autoComplexity = complexity ?? classifyComplexity(lastUserMessage?.content ?? "");
	const provider = getProviderForComplexity(autoComplexity);

	log.info(`Routing to ${provider}`, { complexity: autoComplexity });

	const systemMessage = messages.find((m) => m.role === "system");
	const prompt = buildPrompt(messages, systemMessage?.content);

	const start = performance.now();
	const content = await callCLI(provider, prompt, onChunk);
	const durationMs = Math.round(performance.now() - start);

	log.info("Response received", { provider, durationMs });
	return { content, provider, durationMs };
}

function buildPrompt(messages: ChatMessage[], systemPrompt?: string): string {
	const parts: string[] = [];
	if (systemPrompt) parts.push(systemPrompt);

	const recent = messages.filter((m) => m.role !== "system").slice(-6);
	for (const msg of recent) {
		if (msg.role === "user") {
			parts.push(msg.content);
		} else if (msg.role === "assistant") {
			parts.push(`[Previous response]: ${msg.content.slice(0, 500)}`);
		}
	}
	return parts.join("\n\n");
}

async function callCLI(
	provider: CLIProvider,
	prompt: string,
	onChunk?: StreamCallback,
): Promise<string> {
	const clis = getCLIs();
	if (provider === "claude") {
		return callClaudeStreaming(clis.claude, prompt, onChunk);
	}
	return callCodex(clis.codex, prompt);
}

interface StreamState {
	lastTextSeen: string;
	fullContent: string;
}

function extractTextChunks(
	content: Array<{ type: string; text?: string }>,
	state: StreamState,
	onChunk?: StreamCallback,
): void {
	for (const block of content) {
		if (block.type !== "text" || !block.text) continue;
		const newText = block.text.slice(state.lastTextSeen.length);
		if (newText && onChunk) onChunk(newText);
		state.lastTextSeen = block.text;
	}
}

/** Process a single stream-json line, extracting text chunks and results */
function processStreamLine(line: string, state: StreamState, onChunk?: StreamCallback): void {
	if (!line.trim()) return;
	try {
		const data = JSON.parse(line);
		if (data.type === "assistant" && data.message?.content) {
			extractTextChunks(data.message.content, state, onChunk);
		}
		if (data.type === "result") {
			state.fullContent = (data.result as string) ?? "";
		}
	} catch {
		// Skip unparseable lines
	}
}

/** Read lines from a ReadableStream, calling handler for each */
async function readStreamLines(
	stream: ReadableStream<Uint8Array>,
	handler: (line: string) => void,
): Promise<void> {
	const reader = stream.getReader();
	const decoder = new TextDecoder();
	let buffer = "";

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });
		const lines = buffer.split("\n");
		buffer = lines.pop() ?? "";
		for (const line of lines) handler(line);
	}
}

/**
 * Call Claude CLI with streaming JSON output.
 * Parses assistant message chunks in real-time and calls onChunk for each.
 */
async function callClaudeStreaming(
	binaryPath: string | null,
	prompt: string,
	onChunk?: StreamCallback,
): Promise<string> {
	if (!binaryPath) {
		throw new Error("Claude CLI not found. Install it from https://claude.ai/download");
	}

	const proc = Bun.spawn(
		[binaryPath, "-p", "--output-format", "stream-json", "--verbose", "--model", "sonnet", prompt],
		{ stdout: "pipe", stderr: "pipe" },
	);

	const state = { lastTextSeen: "", fullContent: "" };
	await readStreamLines(proc.stdout, (line) => processStreamLine(line, state, onChunk));

	const exitCode = await proc.exited;
	if (exitCode !== 0 && !state.fullContent) {
		throw new Error(`Claude CLI exited with code ${exitCode}`);
	}

	return state.fullContent;
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
		log.error("Codex CLI failed", { exitCode, stderr: stderr.slice(0, 200) });
		throw new Error(`Codex CLI exited with code ${exitCode}: ${stderr.slice(0, 200)}`);
	}

	return parseCodexOutput(stdout);
}

function parseCodexOutput(raw: string): string {
	const lines = raw.split("\n");
	let contentStart = 0;
	for (let i = 0; i < lines.length; i++) {
		if (lines[i] === "codex") {
			contentStart = i + 1;
			break;
		}
	}
	let contentEnd = lines.length;
	for (let i = lines.length - 1; i >= contentStart; i--) {
		if (lines[i] === "tokens used" || lines[i]?.startsWith("tokens used")) {
			contentEnd = i;
			break;
		}
	}
	return lines.slice(contentStart, contentEnd).join("\n").trim();
}
