import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { AuditLog } from "../../src/actions/audit-log.js";
import { SafetyLevel } from "../../src/types/action.js";

describe("AuditLog", () => {
	let db: Database;
	let auditLog: AuditLog;

	beforeEach(() => {
		db = new Database(":memory:");
		auditLog = new AuditLog(db);
	});

	afterEach(() => {
		db.close();
	});

	test("records and retrieves audit entries", () => {
		auditLog.record({
			id: "a1",
			actionId: "act1",
			taskId: "task1",
			timestamp: new Date("2026-04-03T10:00:00Z"),
			description: "List files in current directory",
			method: "shell",
			safetyLevel: SafetyLevel.SAFE,
			approval: "auto",
			result: "success",
			output: "file1.ts\nfile2.ts",
			reversible: false,
			reversed: false,
		});

		const entries = auditLog.getRecent(10);
		expect(entries).toHaveLength(1);
		expect(entries[0]?.description).toBe("List files in current directory");
		expect(entries[0]?.result).toBe("success");
	});

	test("retrieves entries by task", () => {
		auditLog.record({
			id: "a1",
			actionId: "act1",
			taskId: "task1",
			timestamp: new Date(),
			description: "Action 1",
			method: "shell",
			safetyLevel: SafetyLevel.SAFE,
			approval: "auto",
			result: "success",
			reversible: false,
			reversed: false,
		});
		auditLog.record({
			id: "a2",
			actionId: "act2",
			taskId: "task2",
			timestamp: new Date(),
			description: "Action 2",
			method: "shell",
			safetyLevel: SafetyLevel.LOW,
			approval: "auto",
			result: "success",
			reversible: false,
			reversed: false,
		});

		const task1Entries = auditLog.getByTask("task1");
		expect(task1Entries).toHaveLength(1);
		expect(task1Entries[0]?.description).toBe("Action 1");
	});

	test("marks actions as reversed", () => {
		auditLog.record({
			id: "a1",
			actionId: "act1",
			taskId: "task1",
			timestamp: new Date(),
			description: "Move file",
			method: "shell",
			safetyLevel: SafetyLevel.MEDIUM,
			approval: "countdown",
			result: "success",
			reversible: true,
			reversed: false,
		});

		auditLog.markReversed("act1");
		const entries = auditLog.getRecent(10);
		expect(entries[0]?.reversed).toBe(true);
	});

	test("computes stats by result type", () => {
		const base = {
			taskId: "t1",
			timestamp: new Date(),
			method: "shell" as const,
			safetyLevel: SafetyLevel.SAFE,
			approval: "auto" as const,
			reversible: false,
			reversed: false,
		};

		auditLog.record({ ...base, id: "1", actionId: "a1", description: "d1", result: "success" });
		auditLog.record({ ...base, id: "2", actionId: "a2", description: "d2", result: "success" });
		auditLog.record({ ...base, id: "3", actionId: "a3", description: "d3", result: "failure" });
		auditLog.record({ ...base, id: "4", actionId: "a4", description: "d4", result: "blocked" });

		const stats = auditLog.getStats();
		expect(stats.success).toBe(2);
		expect(stats.failure).toBe(1);
		expect(stats.blocked).toBe(1);
	});

	test("retrieves entries by time range", () => {
		auditLog.record({
			id: "a1",
			actionId: "act1",
			taskId: "task1",
			timestamp: new Date("2026-04-03T08:00:00Z"),
			description: "Morning action",
			method: "shell",
			safetyLevel: SafetyLevel.SAFE,
			approval: "auto",
			result: "success",
			reversible: false,
			reversed: false,
		});
		auditLog.record({
			id: "a2",
			actionId: "act2",
			taskId: "task1",
			timestamp: new Date("2026-04-03T14:00:00Z"),
			description: "Afternoon action",
			method: "shell",
			safetyLevel: SafetyLevel.SAFE,
			approval: "auto",
			result: "success",
			reversible: false,
			reversed: false,
		});

		const morning = auditLog.getByTimeRange(
			new Date("2026-04-03T07:00:00Z"),
			new Date("2026-04-03T12:00:00Z"),
		);
		expect(morning).toHaveLength(1);
		expect(morning[0]?.description).toBe("Morning action");
	});
});
