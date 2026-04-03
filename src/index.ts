import {
	HELP_TEXT,
	PROMPT,
	WELCOME_BANNER,
	formatActions,
	formatError,
	formatResponse,
	parseCommand,
} from "./cli/formatter.js";
import { createAgentState, processMessage, trimConversation } from "./core/agent-loop.js";
import { detectCLIs, getCLIs, loadConfig } from "./core/config.js";
import { createLogger, setLogLevel } from "./core/logger.js";

const log = createLogger("main");

async function initDaemon() {
	const config = loadConfig();
	setLogLevel(config.logLevel);

	const clis = await detectCLIs();

	if (!clis.claude && !clis.codex) {
		throw new Error("No AI CLI found. Install Claude Code or Codex CLI.");
	}

	log.info("Assistant starting", {
		autonomyLevel: config.defaultAutonomyLevel,
		claude: clis.claude ?? "not found",
		codex: clis.codex ?? "not found",
	});

	return createAgentState();
}

function write(text: string): void {
	process.stdout.write(text);
}

function showStatus(state: ReturnType<typeof createAgentState>): void {
	const clis = getCLIs();
	write(`\nCLIs: claude=${clis.claude ?? "none"}, codex=${clis.codex ?? "none"}\n`);
	write(`Messages in context: ${state.messages.length}\n`);
	write(`Pending actions: ${state.pendingActions.length}\n\n`);
}

function showHistory(state: ReturnType<typeof createAgentState>): void {
	const msgs = state.messages.filter((m) => m.role === "user").slice(-10);
	if (msgs.length === 0) {
		write("\nNo conversation history.\n\n");
		return;
	}
	write("\nRecent messages:\n");
	for (const msg of msgs) {
		const preview = msg.content.length > 80 ? `${msg.content.slice(0, 80)}...` : msg.content;
		write(`  > ${preview}\n`);
	}
	write("\n");
}

async function sendMessage(
	state: ReturnType<typeof createAgentState>,
	text: string,
): Promise<void> {
	try {
		const response = await processMessage(state, text);
		write(formatResponse(response.message, response.provider, response.durationMs));
		const actionOutput = formatActions(response.actions);
		if (actionOutput) write(actionOutput);
		trimConversation(state);
	} catch (error) {
		write(formatError(error instanceof Error ? error.message : String(error)));
	}
}

/** Returns false when the session should end */
async function handleCommand(
	state: ReturnType<typeof createAgentState>,
	input: string,
): Promise<boolean> {
	const cmd = parseCommand(input);

	switch (cmd.type) {
		case "empty":
			return true;
		case "quit":
			write("\nGoodbye.\n");
			return false;
		case "help":
			write(HELP_TEXT);
			return true;
		case "clear":
			state.messages.length = 1;
			state.pendingActions = [];
			write("\nConversation cleared.\n");
			return true;
		case "status":
			showStatus(state);
			return true;
		case "goals":
			write("\nNo active goals yet. Goals will be tracked as you work.\n\n");
			return true;
		case "history":
			showHistory(state);
			return true;
		case "unknown":
			write(formatError(`Unknown command: ${cmd.raw}. Type /help for commands.`));
			return true;
		case "message":
			await sendMessage(state, cmd.raw);
			return true;
	}
}

async function main(): Promise<void> {
	const state = await initDaemon();

	write(WELCOME_BANNER);
	write(PROMPT);

	const reader = Bun.stdin.stream().getReader();
	const decoder = new TextDecoder();
	let buffer = "";

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;

		buffer += decoder.decode(value, { stream: true });
		const lines = buffer.split("\n");
		buffer = lines.pop() ?? "";

		for (const line of lines) {
			const shouldContinue = await handleCommand(state, line);
			if (!shouldContinue) return;
			write(PROMPT);
		}
	}
}

main().catch((error) => {
	process.stderr.write(`Fatal: ${error instanceof Error ? error.message : String(error)}\n`);
	process.exit(1);
});
