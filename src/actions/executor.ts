import { createLogger } from "../core/logger.js";
import type { ActionPayload, ActionResult } from "../types/action.js";
import { executeShell } from "./executors/shell.js";

const log = createLogger("executor");

/**
 * Execute an action payload by dispatching to the appropriate executor.
 * This is the single entry point for all action execution.
 */
export async function executeAction(
	actionId: string,
	_taskId: string,
	payload: ActionPayload,
): Promise<ActionResult> {
	const start = performance.now();

	switch (payload.type) {
		case "shell":
			return executeShellAction(actionId, payload);

		case "applescript":
			return notImplemented(actionId, start, "AppleScript executor");

		case "accessibility":
			return notImplemented(actionId, start, "Accessibility executor");

		case "vision":
			return notImplemented(actionId, start, "Vision executor");

		case "api":
			return notImplemented(actionId, start, "API executor");

		default: {
			const durationMs = Math.round(performance.now() - start);
			return {
				actionId,
				success: false,
				error: `Unknown action type: ${(payload as { type: string }).type}`,
				timestamp: new Date(),
				durationMs,
			};
		}
	}
}

async function executeShellAction(
	actionId: string,
	payload: { type: "shell"; command: string; args: string[]; cwd?: string; timeout?: number },
): Promise<ActionResult> {
	const result = await executeShell({
		command: payload.command,
		args: payload.args,
		cwd: payload.cwd,
		timeout: payload.timeout,
		safetyCheck: true,
	});

	return {
		actionId,
		success: result.success,
		output: result.stdout || undefined,
		error: result.error ?? (result.success ? undefined : result.stderr || undefined),
		timestamp: new Date(),
		durationMs: result.durationMs,
	};
}

function notImplemented(actionId: string, start: number, name: string): ActionResult {
	log.warn(`${name} not yet implemented`);
	return {
		actionId,
		success: false,
		error: `${name} not yet implemented`,
		timestamp: new Date(),
		durationMs: Math.round(performance.now() - start),
	};
}
