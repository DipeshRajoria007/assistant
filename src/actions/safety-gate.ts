import { getConfig } from "../core/config.js";
import { createLogger } from "../core/logger.js";
import { SafetyLevel } from "../types/action.js";
import type { Action, ApprovalStatus } from "../types/action.js";

const log = createLogger("safety-gate");

/** Commands that are ALWAYS blocked regardless of autonomy level */
const BLOCKED_COMMANDS = [
	"sudo",
	"su ",
	"rm -rf /",
	"rm -rf ~",
	"mkfs",
	"dd if=",
	"chmod 777",
	"security delete-keychain",
	"security unlock-keychain",
	"systemsetup",
	"csrutil disable",
	"spctl --master-disable",
	"defaults write com.apple.LaunchServices LSQuarantine -bool false",
	"networksetup -setwebproxy",
	"dscl . -passwd",
];

/** Patterns that indicate dangerous shell commands */
const DANGEROUS_PATTERNS = [
	/\brm\s+-rf?\s/,
	/\bsudo\b/,
	/\bmkfs\b/,
	/\bdd\s+if=/,
	/>\s*\/dev\//,
	/\|\s*sh\b/,
	/\bcurl\b.*\|\s*(ba)?sh/,
	/\bwget\b.*\|\s*(ba)?sh/,
	/\beval\b/,
	/\bexec\b/,
];

/** File paths that should never be written to */
const PROTECTED_PATHS = [
	"/System",
	"/usr",
	"/bin",
	"/sbin",
	"/Library/LaunchDaemons",
	"/Library/LaunchAgents",
	"~/.ssh",
	"~/.gnupg",
	"~/.aws/credentials",
	"~/.config/gcloud",
];

/** Read-only shell commands that are always safe */
const READ_ONLY_COMMANDS = [
	"ls",
	"cat",
	"head",
	"tail",
	"grep",
	"find",
	"which",
	"whoami",
	"pwd",
	"echo",
	"date",
	"uptime",
	"df",
	"du",
	"ps",
	"top",
	"git status",
	"git log",
	"git diff",
	"git branch",
];

function classifyShellSafety(command: string, args: string[]): SafetyLevel {
	const fullCommand = `${command} ${args.join(" ")}`;

	if (BLOCKED_COMMANDS.some((blocked) => fullCommand.includes(blocked))) {
		return SafetyLevel.BLOCKED;
	}
	if (DANGEROUS_PATTERNS.some((pattern) => pattern.test(fullCommand))) {
		return SafetyLevel.HIGH;
	}
	if (/\brm\b/.test(fullCommand) || /\btrash\b/.test(fullCommand)) {
		return SafetyLevel.HIGH;
	}
	if (READ_ONLY_COMMANDS.some((cmd) => fullCommand.startsWith(cmd))) {
		return SafetyLevel.SAFE;
	}
	if (/^git\s+(commit|push|merge|rebase|checkout|reset)/.test(fullCommand)) {
		return SafetyLevel.MEDIUM;
	}
	return SafetyLevel.MEDIUM;
}

function classifyAppleScriptSafety(script: string): SafetyLevel {
	const lower = script.toLowerCase();
	if (/\b(send|mail|message|email)\b/.test(lower)) return SafetyLevel.MEDIUM;
	if (/\bdelete\b/.test(lower)) return SafetyLevel.HIGH;
	if (/\b(get|name|count|exists)\b/.test(lower) && !/\b(set|delete|move|send)\b/.test(lower)) {
		return SafetyLevel.SAFE;
	}
	return SafetyLevel.LOW;
}

function classifyApiSafety(service: string): SafetyLevel {
	const lower = service.toLowerCase();
	if (/\b(bank|payment|stripe|paypal)\b/.test(lower)) return SafetyLevel.HIGH;
	if (/\b(slack|email|discord|telegram|sms)\b/.test(lower)) return SafetyLevel.MEDIUM;
	return SafetyLevel.LOW;
}

/** Classify the safety level of an action */
export function classifySafetyLevel(action: Pick<Action, "method" | "payload">): SafetyLevel {
	const { method, payload } = action;

	if (method === "shell" && payload.type === "shell") {
		return classifyShellSafety(payload.command, payload.args);
	}
	if (method === "applescript" && payload.type === "applescript") {
		return classifyAppleScriptSafety(payload.script);
	}
	if (method === "accessibility" && payload.type === "accessibility") {
		const hasWrite = payload.actions.some((a) => a.action === "setValue" || a.action === "press");
		return hasWrite ? SafetyLevel.LOW : SafetyLevel.SAFE;
	}
	if (method === "vision") {
		return SafetyLevel.MEDIUM;
	}
	if (method === "api" && payload.type === "api") {
		return classifyApiSafety(payload.service);
	}
	return SafetyLevel.MEDIUM;
}

/**
 * Approval matrix: approvalMatrix[autonomyLevel][safetyLevel] = approval status.
 * Rows = autonomy levels 0-4, Columns = safety levels SAFE(0), LOW(1), MEDIUM(2), HIGH(3).
 * BLOCKED(4) is always "blocked" regardless of autonomy.
 */
const APPROVAL_MATRIX: ApprovalStatus[][] = [
	/* autonomy 0 */ ["auto", "approved", "approved", "approved"],
	/* autonomy 1 */ ["auto", "approved", "approved", "approved"],
	/* autonomy 2 */ ["auto", "countdown", "approved", "approved"],
	/* autonomy 3 */ ["auto", "auto", "countdown", "approved"],
	/* autonomy 4 */ ["auto", "auto", "auto", "countdown"],
];

/** Determine approval flow based on safety level and autonomy setting */
export function determineApproval(safetyLevel: SafetyLevel): ApprovalStatus {
	if (safetyLevel === SafetyLevel.BLOCKED) return "blocked";

	const config = getConfig();
	const autonomy = Math.min(config.defaultAutonomyLevel, 4);
	const row = APPROVAL_MATRIX[autonomy];
	return row?.[safetyLevel] ?? "approved";
}

/** Check if a file path is in a protected location */
export function isProtectedPath(filePath: string): boolean {
	const normalized = filePath.replace(/^~/, process.env.HOME ?? "");
	return PROTECTED_PATHS.some((p) => {
		const normalizedProtected = p.replace(/^~/, process.env.HOME ?? "");
		return normalized.startsWith(normalizedProtected);
	});
}

/** Full safety check pipeline: classify → check protections → determine approval */
export function evaluateAction(action: Pick<Action, "method" | "payload">): {
	safetyLevel: SafetyLevel;
	approval: ApprovalStatus;
	warnings: string[];
} {
	const warnings: string[] = [];
	const safetyLevel = classifySafetyLevel(action);
	const approval = determineApproval(safetyLevel);

	// Additional warnings for specific patterns
	if (action.payload.type === "shell") {
		const fullCommand = `${action.payload.command} ${action.payload.args.join(" ")}`;

		// Warn about piping to shell
		if (/\|\s*(ba)?sh/.test(fullCommand)) {
			warnings.push("Command pipes output to shell — potential code injection risk");
		}

		// Warn about network access
		if (/\b(curl|wget|nc|ncat)\b/.test(fullCommand)) {
			warnings.push("Command makes network requests");
		}
	}

	if (approval === "blocked") {
		log.warn("Action BLOCKED", { method: action.method, safetyLevel });
	}

	return { safetyLevel, approval, warnings };
}
