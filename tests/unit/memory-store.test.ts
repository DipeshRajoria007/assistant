import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { MemoryStore } from "../../src/memory/store.js";
import { setupTestConfig } from "../setup.js";

describe("MemoryStore", () => {
	let store: MemoryStore;

	beforeEach(() => {
		setupTestConfig();
		store = new MemoryStore(":memory:");
	});

	afterEach(() => {
		store.close();
	});

	describe("knowledge", () => {
		test("adds and retrieves knowledge", () => {
			const now = new Date();
			store.addKnowledge({
				id: "k1",
				category: "preference",
				subject: "editor",
				content: "User prefers VS Code with Vim bindings",
				confidence: 0.9,
				source: "user_stated",
				createdAt: now,
				updatedAt: now,
			});

			const result = store.getKnowledge("k1");
			expect(result).not.toBeNull();
			expect(result?.subject).toBe("editor");
			expect(result?.content).toBe("User prefers VS Code with Vim bindings");
			expect(result?.category).toBe("preference");
		});

		test("returns null for missing knowledge", () => {
			expect(store.getKnowledge("nonexistent")).toBeNull();
		});

		test("searches knowledge by keyword", () => {
			const now = new Date();
			store.addKnowledge({
				id: "k1",
				category: "preference",
				subject: "language",
				content: "User prefers TypeScript over JavaScript",
				confidence: 1.0,
				source: "observed",
				createdAt: now,
				updatedAt: now,
			});
			store.addKnowledge({
				id: "k2",
				category: "skill",
				subject: "expertise",
				content: "User is expert in Python and machine learning",
				confidence: 0.8,
				source: "inferred",
				createdAt: now,
				updatedAt: now,
			});

			const results = store.searchKnowledge("TypeScript");
			expect(results).toHaveLength(1);
			expect(results[0]?.id).toBe("k1");
		});

		test("filters search by category", () => {
			const now = new Date();
			store.addKnowledge({
				id: "k1",
				category: "preference",
				subject: "test",
				content: "data",
				confidence: 1.0,
				source: "test",
				createdAt: now,
				updatedAt: now,
			});
			store.addKnowledge({
				id: "k2",
				category: "skill",
				subject: "test",
				content: "data",
				confidence: 1.0,
				source: "test",
				createdAt: now,
				updatedAt: now,
			});

			const results = store.searchKnowledge("test", "skill");
			expect(results).toHaveLength(1);
			expect(results[0]?.category).toBe("skill");
		});

		test("increments access count on get", () => {
			const now = new Date();
			store.addKnowledge({
				id: "k1",
				category: "preference",
				subject: "test",
				content: "data",
				confidence: 1.0,
				source: "test",
				createdAt: now,
				updatedAt: now,
			});

			store.getKnowledge("k1");
			store.getKnowledge("k1");
			const entry = store.getKnowledge("k1");
			// Each get increments, but we read the value before the current increment
			// So after 3 gets, the count we read will be 2 (from previous gets)
			expect(entry?.accessCount).toBe(2);
		});
	});

	describe("episodes", () => {
		test("adds and retrieves episodes", () => {
			store.addEpisode({
				id: "e1",
				timestamp: new Date(),
				type: "user_request",
				summary: "User asked to deploy the app",
				relatedGoalIds: ["g1"],
				relatedKnowledgeIds: [],
			});

			const episodes = store.getRecentEpisodes(10);
			expect(episodes).toHaveLength(1);
			expect(episodes[0]?.summary).toBe("User asked to deploy the app");
			expect(episodes[0]?.relatedGoalIds).toEqual(["g1"]);
		});

		test("returns episodes in reverse chronological order", () => {
			const base = Date.now();
			store.addEpisode({
				id: "e1",
				timestamp: new Date(base - 2000),
				type: "user_request",
				summary: "First",
				relatedGoalIds: [],
				relatedKnowledgeIds: [],
			});
			store.addEpisode({
				id: "e2",
				timestamp: new Date(base - 1000),
				type: "agent_action",
				summary: "Second",
				relatedGoalIds: [],
				relatedKnowledgeIds: [],
			});
			store.addEpisode({
				id: "e3",
				timestamp: new Date(base),
				type: "milestone",
				summary: "Third",
				relatedGoalIds: [],
				relatedKnowledgeIds: [],
			});

			const episodes = store.getRecentEpisodes(10);
			expect(episodes[0]?.summary).toBe("Third");
			expect(episodes[1]?.summary).toBe("Second");
			expect(episodes[2]?.summary).toBe("First");
		});

		test("respects limit parameter", () => {
			for (let i = 0; i < 10; i++) {
				store.addEpisode({
					id: `e${i}`,
					timestamp: new Date(),
					type: "system_event",
					summary: `Event ${i}`,
					relatedGoalIds: [],
					relatedKnowledgeIds: [],
				});
			}

			expect(store.getRecentEpisodes(3)).toHaveLength(3);
		});
	});

	describe("goals", () => {
		test("adds and retrieves active goals", () => {
			const now = new Date();
			store.addGoal({
				id: "g1",
				title: "Ship v1.0",
				description: "Release the first version of the assistant",
				status: "active",
				priority: "high",
				createdAt: now,
				updatedAt: now,
				subGoalIds: [],
				relatedEpisodeIds: [],
				progress: 0.3,
				notes: ["Started core module"],
			});

			const goals = store.getActiveGoals();
			expect(goals).toHaveLength(1);
			expect(goals[0]?.title).toBe("Ship v1.0");
			expect(goals[0]?.progress).toBe(0.3);
			expect(goals[0]?.notes).toEqual(["Started core module"]);
		});

		test("updates goal progress", () => {
			const now = new Date();
			store.addGoal({
				id: "g1",
				title: "Test goal",
				description: "Test",
				status: "active",
				priority: "medium",
				createdAt: now,
				updatedAt: now,
				subGoalIds: [],
				relatedEpisodeIds: [],
				progress: 0,
				notes: [],
			});

			store.updateGoalProgress("g1", 0.75);
			const goals = store.getActiveGoals();
			expect(goals[0]?.progress).toBe(0.75);
		});

		test("updates goal status", () => {
			const now = new Date();
			store.addGoal({
				id: "g1",
				title: "Test goal",
				description: "Test",
				status: "active",
				priority: "medium",
				createdAt: now,
				updatedAt: now,
				subGoalIds: [],
				relatedEpisodeIds: [],
				progress: 1.0,
				notes: [],
			});

			store.updateGoalStatus("g1", "completed");
			const activeGoals = store.getActiveGoals();
			expect(activeGoals).toHaveLength(0);
		});

		test("does not return non-active goals", () => {
			const now = new Date();
			store.addGoal({
				id: "g1",
				title: "Paused goal",
				description: "On hold",
				status: "paused",
				priority: "low",
				createdAt: now,
				updatedAt: now,
				subGoalIds: [],
				relatedEpisodeIds: [],
				progress: 0.5,
				notes: [],
			});

			expect(store.getActiveGoals()).toHaveLength(0);
		});
	});
});
