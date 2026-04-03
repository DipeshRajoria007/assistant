import { createAgentState, processMessage } from "./core/agent-loop.js";
import { detectCLIs, loadConfig } from "./core/config.js";
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

	const state = createAgentState();
	log.info("Agent ready. Waiting for input...");
	return state;
}

async function handleLine(state: ReturnType<typeof createAgentState>, line: string): Promise<void> {
	if (line === "/quit" || line === "/exit") {
		log.info("Shutting down...");
		process.exit(0);
	}

	try {
		const response = await processMessage(state, line);
		process.stdout.write(`\n${response.message}\n\n`);
		printPendingActions(response.actions);
		process.stdout.write("> ");
	} catch (error) {
		log.error("Error processing message", error);
		process.stdout.write(`Error: ${error instanceof Error ? error.message : String(error)}\n> `);
	}
}

function printPendingActions(actions: Awaited<ReturnType<typeof processMessage>>["actions"]): void {
	if (actions.length === 0) return;
	process.stdout.write("Pending actions:\n");
	for (const action of actions) {
		process.stdout.write(
			`  [${action.approval}] ${action.description} (safety: ${action.safetyLevel})\n`,
		);
	}
	process.stdout.write("\n");
}

async function main(): Promise<void> {
	const state = await initDaemon();

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
			const trimmed = line.trim();
			if (trimmed) await handleLine(state, trimmed);
		}
	}
}

main().catch((error) => {
	process.stderr.write(`Fatal: ${error instanceof Error ? error.message : String(error)}\n`);
	process.exit(1);
});
