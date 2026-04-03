import { getConfig } from "../core/config.js";
import { createLogger } from "../core/logger.js";
import type { ContextSnapshot, UserContext } from "../types/context.js";
import type { Goal } from "../types/memory.js";

const log = createLogger("context-assembler");

/** Rough token estimation: 1 token ≈ 4 characters */
function estimateTokens(text: string): number {
	return Math.ceil(text.length / 4);
}

/**
 * Assemble the current context into a minimal prompt string.
 * Prioritizes the most relevant information to stay within token budget.
 */
export function assembleContext(
	userContext: UserContext,
	activeGoals: Goal[],
	recentHistory: string[],
): string {
	const config = getConfig();
	const maxTokens = config.maxContextTokens;
	const parts: string[] = [];
	let tokenCount = 0;

	// 1. Current environment (always included, ~200 tokens)
	const envSection = formatEnvironment(userContext);
	parts.push(envSection);
	tokenCount += estimateTokens(envSection);

	// 2. Active goals (high priority, ~100 tokens per goal)
	if (activeGoals.length > 0) {
		const goalsSection = formatGoals(activeGoals);
		const goalsTokens = estimateTokens(goalsSection);
		if (tokenCount + goalsTokens < maxTokens * 0.4) {
			parts.push(goalsSection);
			tokenCount += goalsTokens;
		}
	}

	// 3. Recent history (fills remaining budget)
	if (recentHistory.length > 0) {
		const remainingBudget = maxTokens - tokenCount - 200; // reserve 200 for padding
		const historySection = formatHistory(recentHistory, remainingBudget);
		parts.push(historySection);
		tokenCount += estimateTokens(historySection);
	}

	log.debug("Context assembled", { tokenCount, parts: parts.length });

	return parts.join("\n\n");
}

function formatEnvironment(ctx: UserContext): string {
	const lines = [
		"## Current Environment",
		`Time: ${ctx.timestamp.toLocaleString()}`,
		`App: ${ctx.screen.activeApp} — ${ctx.screen.activeWindow}`,
	];

	if (ctx.screen.activeTab) {
		lines.push(`Tab: ${ctx.screen.activeTab}`);
	}

	if (ctx.git) {
		lines.push(`Git: ${ctx.git.branch} (${ctx.git.status.length} changes)`);
	}

	if (ctx.calendar?.current) {
		lines.push(`In meeting: ${ctx.calendar.current.title}`);
	} else if (ctx.calendar?.upcoming.length) {
		const next = ctx.calendar.upcoming[0];
		if (next) {
			const minutesUntil = Math.round((next.startTime.getTime() - ctx.timestamp.getTime()) / 60000);
			lines.push(`Next event: ${next.title} in ${minutesUntil}min`);
		}
	}

	if (ctx.activeFiles.length > 0) {
		const openFiles = ctx.activeFiles
			.filter((f) => f.isOpen)
			.map((f) => f.name)
			.slice(0, 5);
		if (openFiles.length > 0) {
			lines.push(`Open files: ${openFiles.join(", ")}`);
		}
	}

	return lines.join("\n");
}

function formatGoals(goals: Goal[]): string {
	const lines = ["## Active Goals"];

	for (const goal of goals.slice(0, 5)) {
		const progress = Math.round(goal.progress * 100);
		const deadline = goal.deadline ? ` (due: ${goal.deadline.toLocaleDateString()})` : "";
		lines.push(`- [${progress}%] ${goal.title}${deadline}`);
	}

	return lines.join("\n");
}

function formatHistory(history: string[], maxTokens: number): string {
	const lines = ["## Recent Activity"];
	let tokens = estimateTokens(lines[0] ?? "");

	for (const entry of history) {
		const entryTokens = estimateTokens(entry);
		if (tokens + entryTokens > maxTokens) break;
		lines.push(`- ${entry}`);
		tokens += entryTokens;
	}

	return lines.join("\n");
}

/** Create a compressed snapshot for long-term storage */
export function createSnapshot(context: UserContext, activeGoals: Goal[]): ContextSnapshot {
	const goalIds = activeGoals.map((g) => g.id);
	const summary = [
		`App: ${context.screen.activeApp}`,
		context.git ? `Branch: ${context.git.branch}` : "",
		context.calendar?.current ? `Meeting: ${context.calendar.current.title}` : "",
	]
		.filter(Boolean)
		.join(" | ");

	return {
		id: crypto.randomUUID(),
		timestamp: context.timestamp,
		summary,
		activeApp: context.screen.activeApp,
		activeFile: context.activeFiles.find((f) => f.isOpen)?.path,
		gitBranch: context.git?.branch,
		currentGoalIds: goalIds,
		tokenCount: estimateTokens(summary),
	};
}
