import type { PendingAction } from "../core/agent-loop.js";
import { SafetyLevel } from "../types/action.js";

// ANSI color codes
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const CYAN = "\x1b[36m";
const RESET = "\x1b[0m";

export const WELCOME_BANNER = `
${BOLD}${CYAN}  Assistant v0.1.0${RESET}
${DIM}  Autonomous personal AI for macOS${RESET}
${DIM}  Type /help for commands, /quit to exit${RESET}
`;

export const HELP_TEXT = `
${BOLD}Commands:${RESET}
  ${CYAN}/help${RESET}      Show this help message
  ${CYAN}/status${RESET}    Show current context (active app, git, calendar)
  ${CYAN}/goals${RESET}     Show active goals
  ${CYAN}/history${RESET}   Show recent conversation history
  ${CYAN}/clear${RESET}     Clear conversation and start fresh
  ${CYAN}/voice${RESET}     Push-to-talk: record and transcribe speech
  ${CYAN}/speak${RESET}     Toggle voice output (speaks responses aloud)
  ${CYAN}/quit${RESET}      Exit the assistant

${BOLD}Tips:${RESET}
  ${DIM}Just type naturally — the assistant figures out what to do.${RESET}
  ${DIM}Actions are shown before execution. Dangerous ones need approval.${RESET}
`;

export type CLICommand =
	| { type: "quit" }
	| { type: "help" }
	| { type: "status" }
	| { type: "goals" }
	| { type: "history" }
	| { type: "clear" }
	| { type: "voice" }
	| { type: "speak" }
	| { type: "message"; raw: string }
	| { type: "unknown"; raw: string }
	| { type: "empty" };

export function parseCommand(input: string): CLICommand {
	const trimmed = input.trim();

	if (!trimmed) return { type: "empty" };

	if (trimmed.startsWith("/")) {
		const cmd = trimmed.toLowerCase();
		switch (cmd) {
			case "/quit":
			case "/exit":
			case "/q":
				return { type: "quit" };
			case "/help":
			case "/h":
				return { type: "help" };
			case "/status":
			case "/s":
				return { type: "status" };
			case "/goals":
			case "/g":
				return { type: "goals" };
			case "/history":
				return { type: "history" };
			case "/clear":
				return { type: "clear" };
			case "/voice":
			case "/v":
				return { type: "voice" };
			case "/speak":
			case "/sp":
				return { type: "speak" };
			default:
				return { type: "unknown", raw: trimmed };
		}
	}

	return { type: "message", raw: trimmed };
}

export function formatResponse(content: string, provider: string, durationMs: number): string {
	const meta = `${DIM}[${provider} | ${durationMs}ms]${RESET}`;
	return `\n${content}\n${meta}\n`;
}

export function formatActions(actions: PendingAction[]): string {
	if (actions.length === 0) return "";

	const lines: string[] = [`\n${BOLD}Actions:${RESET}`];

	for (const action of actions) {
		const safetyLabel = formatSafetyLevel(action.safetyLevel);
		const approvalLabel = formatApproval(action.approval);
		lines.push(`  ${safetyLabel} ${action.description} ${approvalLabel}`);

		for (const warning of action.warnings) {
			lines.push(`    ${YELLOW}! ${warning}${RESET}`);
		}
	}

	return `${lines.join("\n")}\n`;
}

function formatSafetyLevel(level: SafetyLevel): string {
	switch (level) {
		case SafetyLevel.SAFE:
			return `${GREEN}[SAFE]${RESET}`;
		case SafetyLevel.LOW:
			return `${GREEN}[LOW]${RESET}`;
		case SafetyLevel.MEDIUM:
			return `${YELLOW}[MEDIUM]${RESET}`;
		case SafetyLevel.HIGH:
			return `${RED}[HIGH]${RESET}`;
		case SafetyLevel.BLOCKED:
			return `${RED}${BOLD}[BLOCKED]${RESET}`;
		default:
			return "[UNKNOWN]";
	}
}

function formatApproval(approval: string): string {
	switch (approval) {
		case "auto":
			return `${DIM}(auto)${RESET}`;
		case "countdown":
			return `${YELLOW}(5s to cancel)${RESET}`;
		case "approved":
			return `${CYAN}(needs approval)${RESET}`;
		case "blocked":
			return `${RED}(blocked)${RESET}`;
		default:
			return `(${approval})`;
	}
}

export function formatError(message: string): string {
	return `\n${RED}Error: ${message}${RESET}\n`;
}

export function formatStatus(info: {
	activeApp?: string;
	gitBranch?: string;
	gitDirty?: number;
	upcomingEvent?: string;
	provider: string;
}): string {
	const lines: string[] = [`\n${BOLD}Status:${RESET}`];

	if (info.activeApp) {
		lines.push(`  App:      ${info.activeApp}`);
	}
	if (info.gitBranch) {
		const dirty = info.gitDirty ? ` (${info.gitDirty} changes)` : "";
		lines.push(`  Git:      ${info.gitBranch}${dirty}`);
	}
	if (info.upcomingEvent) {
		lines.push(`  Calendar: ${info.upcomingEvent}`);
	}
	lines.push(`  Provider: ${info.provider}`);

	return `${lines.join("\n")}\n`;
}

export const PROMPT = `${CYAN}>${RESET} `;
