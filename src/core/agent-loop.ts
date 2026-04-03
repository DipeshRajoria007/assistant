import { evaluateAction } from "../actions/safety-gate.js";
import type {
	ActionPayload,
	ApprovalStatus,
	ExecutionMethod,
	SafetyLevel,
} from "../types/action.js";
import { createLogger } from "./logger.js";
import { classifyComplexity, routeMessage } from "./model-router.js";
import type { ChatMessage, RouterResponse } from "./model-router.js";

const log = createLogger("agent-loop");

/** The state of an agent processing cycle */
export interface AgentState {
	conversationId: string;
	messages: ChatMessage[];
	pendingActions: PendingAction[];
	status: "idle" | "thinking" | "acting" | "waiting_approval" | "error";
	lastError?: string;
}

export interface PendingAction {
	id: string;
	description: string;
	method: ExecutionMethod;
	payload: ActionPayload;
	safetyLevel: SafetyLevel;
	approval: ApprovalStatus;
	warnings: string[];
}

export interface AgentResponse {
	message: string;
	actions: PendingAction[];
	complexity: ReturnType<typeof classifyComplexity>;
	provider: string;
	durationMs: number;
}

/** System prompt that defines the assistant's behavior */
const SYSTEM_PROMPT = `You are an autonomous personal AI assistant running on macOS.
You have access to the user's screen, files, calendar, and system.
You can execute actions on the user's behalf through structured commands.

RULES:
1. Be concise and direct. Don't over-explain.
2. When you need to act, describe the specific action clearly.
3. For multi-step tasks, break them into numbered steps.
4. Always consider safety — destructive actions need confirmation.
5. Use the cheapest reliable method (API > AppleScript > Accessibility > Vision).
6. If uncertain about intent, ask ONE clarifying question.

RESPONSE FORMAT:
Respond naturally. If you need to execute actions, include them as:
[ACTION: method=shell, command="...", args=["..."]]
[ACTION: method=applescript, script="...", language=applescript]
[ACTION: method=accessibility, app="...", element="...", action=press]

Only include actions when you intend to perform them. Regular conversation doesn't need actions.`;

/** Create a fresh agent state */
export function createAgentState(conversationId?: string): AgentState {
	return {
		conversationId: conversationId ?? crypto.randomUUID(),
		messages: [{ role: "system", content: SYSTEM_PROMPT }],
		pendingActions: [],
		status: "idle",
	};
}

/** Process a user message through the agent loop */
export async function processMessage(
	state: AgentState,
	userMessage: string,
	contextPrefix?: string,
): Promise<AgentResponse> {
	state.status = "thinking";

	// Build the full message with context
	const fullMessage = contextPrefix
		? `${contextPrefix}\n\nUser request: ${userMessage}`
		: userMessage;

	state.messages.push({ role: "user", content: fullMessage });

	// Route to appropriate model
	const complexity = classifyComplexity(userMessage);
	let response: RouterResponse;

	try {
		response = await routeMessage(state.messages, complexity);
	} catch (error) {
		state.status = "error";
		state.lastError = error instanceof Error ? error.message : String(error);
		throw error;
	}

	// Add assistant response to conversation
	state.messages.push({ role: "assistant", content: response.content });

	// Parse any actions from the response
	const actions = parseActions(response.content);

	// Evaluate safety for each action
	const pendingActions: PendingAction[] = actions.map((action) => {
		const evaluation = evaluateAction({ method: action.method, payload: action.payload });
		return {
			id: crypto.randomUUID(),
			description: action.description,
			method: action.method,
			payload: action.payload,
			safetyLevel: evaluation.safetyLevel,
			approval: evaluation.approval,
			warnings: evaluation.warnings,
		};
	});

	state.pendingActions = pendingActions;

	if (pendingActions.some((a) => a.approval === "approved")) {
		state.status = "waiting_approval";
	} else {
		state.status = "idle";
	}

	log.info("Message processed", {
		complexity,
		provider: response.provider,
		actions: pendingActions.length,
		needsApproval: pendingActions.filter((a) => a.approval === "approved").length,
	});

	return {
		message: response.content,
		actions: pendingActions,
		complexity,
		provider: response.provider,
		durationMs: response.durationMs,
	};
}

interface ParsedAction {
	description: string;
	method: ExecutionMethod;
	payload: ActionPayload;
}

/** Parse action blocks from the LLM response */
function parseActions(content: string): ParsedAction[] {
	const actionPattern = /\[ACTION:\s*(.+?)\]/g;
	const actions: ParsedAction[] = [];

	let match = actionPattern.exec(content);
	while (match) {
		const params = match[1];
		if (params) {
			const action = parseActionParams(params);
			if (action) {
				actions.push(action);
			}
		}
		match = actionPattern.exec(content);
	}

	return actions;
}

/** Extract key=value pairs from an action param string */
function extractPairs(params: string): Record<string, string> {
	const pairs: Record<string, string> = {};
	const pairPattern = /(\w+)=(?:"([^"]*)"|\[([^\]]*)\]|(\S+))/g;
	let pairMatch = pairPattern.exec(params);
	while (pairMatch) {
		const key = pairMatch[1];
		const value = pairMatch[2] ?? pairMatch[3] ?? pairMatch[4];
		if (key && value !== undefined) {
			pairs[key] = value;
		}
		pairMatch = pairPattern.exec(params);
	}
	return pairs;
}

function buildShellAction(pairs: Record<string, string>): ParsedAction {
	return {
		description: `Execute: ${pairs.command ?? "unknown"}`,
		method: "shell",
		payload: {
			type: "shell",
			command: pairs.command ?? "",
			args: pairs.args ? parseStringArray(pairs.args) : [],
		},
	};
}

function buildAppleScriptAction(pairs: Record<string, string>): ParsedAction {
	return {
		description: `AppleScript: ${(pairs.script ?? "").slice(0, 50)}...`,
		method: "applescript",
		payload: {
			type: "applescript",
			script: pairs.script ?? "",
			language: (pairs.language as "applescript" | "javascript") ?? "applescript",
		},
	};
}

function buildAccessibilityAction(pairs: Record<string, string>): ParsedAction {
	return {
		description: `AX: ${pairs.action ?? "interact"} in ${pairs.app ?? "unknown"}`,
		method: "accessibility",
		payload: {
			type: "accessibility",
			app: pairs.app ?? "",
			actions: [
				{
					element: { title: pairs.element, role: pairs.role },
					action: (pairs.action as "press" | "setValue" | "focus" | "select") ?? "press",
					value: pairs.value,
				},
			],
		},
	};
}

const ACTION_BUILDERS: Record<string, (pairs: Record<string, string>) => ParsedAction> = {
	shell: buildShellAction,
	applescript: buildAppleScriptAction,
	accessibility: buildAccessibilityAction,
};

/** Parse key=value params from an action string */
function parseActionParams(params: string): ParsedAction | null {
	const pairs = extractPairs(params);
	const method = pairs.method;
	if (!method) return null;
	const builder = ACTION_BUILDERS[method];
	return builder ? builder(pairs) : null;
}

/** Parse a simple string array like '"a","b","c"' */
function parseStringArray(input: string): string[] {
	return input
		.split(",")
		.map((s) => s.trim().replace(/^"|"$/g, ""))
		.filter(Boolean);
}

/** Trim conversation history to stay within token limits */
export function trimConversation(state: AgentState, maxMessages = 20): void {
	const systemMessage = state.messages[0];
	if (state.messages.length > maxMessages && systemMessage) {
		// Keep system prompt + last N messages
		state.messages = [systemMessage, ...state.messages.slice(-(maxMessages - 1))];
		log.debug("Conversation trimmed", { remaining: state.messages.length });
	}
}
