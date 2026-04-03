import { beforeEach, describe, expect, test } from "bun:test";
import { assembleContext, createSnapshot } from "../../src/context/assembler.js";
import type { UserContext } from "../../src/types/context.js";
import type { Goal } from "../../src/types/memory.js";
import { setupTestConfig } from "../setup.js";

function makeContext(overrides?: Partial<UserContext>): UserContext {
	return {
		timestamp: new Date("2026-04-03T10:00:00Z"),
		screen: {
			activeApp: "VS Code",
			activeWindow: "agent-loop.ts — assistant",
		},
		system: {
			hostname: "macbook",
			username: "dipesh",
			platform: "darwin",
			runningApps: ["VS Code", "Safari", "Slack"],
			networkStatus: "online",
			doNotDisturb: false,
		},
		activeFiles: [
			{
				path: "/code/assistant/src/core/agent-loop.ts",
				name: "agent-loop.ts",
				language: "typescript",
				lastModified: new Date(),
				isOpen: true,
			},
		],
		...overrides,
	};
}

function makeGoal(overrides?: Partial<Goal>): Goal {
	return {
		id: "g1",
		title: "Ship v1.0",
		description: "Release first version",
		status: "active",
		priority: "high",
		createdAt: new Date(),
		updatedAt: new Date(),
		subGoalIds: [],
		relatedEpisodeIds: [],
		progress: 0.3,
		notes: [],
		...overrides,
	};
}

describe("assembleContext", () => {
	beforeEach(() => {
		setupTestConfig();
	});

	test("includes current environment", () => {
		const ctx = makeContext();
		const result = assembleContext(ctx, [], []);

		expect(result).toContain("VS Code");
		expect(result).toContain("agent-loop.ts");
	});

	test("includes active goals", () => {
		const ctx = makeContext();
		const goals = [makeGoal({ title: "Ship v1.0", progress: 0.3 })];
		const result = assembleContext(ctx, goals, []);

		expect(result).toContain("Ship v1.0");
		expect(result).toContain("30%");
	});

	test("includes recent history", () => {
		const ctx = makeContext();
		const history = ["Deployed staging", "Fixed auth bug", "Reviewed PR #42"];
		const result = assembleContext(ctx, [], history);

		expect(result).toContain("Deployed staging");
		expect(result).toContain("Fixed auth bug");
	});

	test("includes git context when present", () => {
		const ctx = makeContext({
			git: {
				repoPath: "/code/assistant",
				branch: "feat/safety-gate",
				status: [{ path: "safety-gate.ts", status: "modified" }],
				recentCommits: [],
				hasUnpushedChanges: true,
			},
		});

		const result = assembleContext(ctx, [], []);
		expect(result).toContain("feat/safety-gate");
		expect(result).toContain("1 changes");
	});

	test("includes calendar context", () => {
		const ctx = makeContext({
			calendar: {
				upcoming: [
					{
						id: "cal1",
						title: "Design Review",
						startTime: new Date("2026-04-03T10:30:00Z"),
						endTime: new Date("2026-04-03T11:00:00Z"),
						isAllDay: false,
					},
				],
			},
		});

		const result = assembleContext(ctx, [], []);
		expect(result).toContain("Design Review");
		expect(result).toContain("30min");
	});

	test("shows current meeting when in one", () => {
		const ctx = makeContext({
			calendar: {
				current: {
					id: "cal1",
					title: "Sprint Planning",
					startTime: new Date("2026-04-03T09:00:00Z"),
					endTime: new Date("2026-04-03T10:30:00Z"),
					isAllDay: false,
				},
				upcoming: [],
			},
		});

		const result = assembleContext(ctx, [], []);
		expect(result).toContain("In meeting: Sprint Planning");
	});
});

describe("createSnapshot", () => {
	beforeEach(() => {
		setupTestConfig();
	});

	test("creates a compressed snapshot", () => {
		const ctx = makeContext();
		const goals = [makeGoal()];

		const snapshot = createSnapshot(ctx, goals);

		expect(snapshot.id).toBeDefined();
		expect(snapshot.activeApp).toBe("VS Code");
		expect(snapshot.currentGoalIds).toEqual(["g1"]);
		expect(snapshot.summary).toContain("VS Code");
	});

	test("includes git branch in snapshot", () => {
		const ctx = makeContext({
			git: {
				repoPath: "/code/assistant",
				branch: "main",
				status: [],
				recentCommits: [],
				hasUnpushedChanges: false,
			},
		});

		const snapshot = createSnapshot(ctx, []);
		expect(snapshot.gitBranch).toBe("main");
		expect(snapshot.summary).toContain("main");
	});
});
