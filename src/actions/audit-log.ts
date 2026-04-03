import type { Database } from "bun:sqlite";
import { createLogger } from "../core/logger.js";
import type { AuditEntry } from "../types/action.js";

const log = createLogger("audit-log");

export class AuditLog {
	private db: Database;

	constructor(db: Database) {
		this.db = db;
		this.initialize();
	}

	private initialize(): void {
		this.db.run(`
			CREATE TABLE IF NOT EXISTS audit_log (
				id TEXT PRIMARY KEY,
				action_id TEXT NOT NULL,
				task_id TEXT NOT NULL,
				timestamp TEXT NOT NULL,
				description TEXT NOT NULL,
				method TEXT NOT NULL,
				safety_level INTEGER NOT NULL,
				approval TEXT NOT NULL,
				result TEXT NOT NULL,
				output TEXT,
				error TEXT,
				screenshot_before TEXT,
				screenshot_after TEXT,
				reversible INTEGER NOT NULL DEFAULT 0,
				reversed INTEGER NOT NULL DEFAULT 0
			)
		`);

		this.db.run("CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp)");
		this.db.run("CREATE INDEX IF NOT EXISTS idx_audit_task ON audit_log(task_id)");
		this.db.run("CREATE INDEX IF NOT EXISTS idx_audit_result ON audit_log(result)");
	}

	/** Record a new audit entry */
	record(entry: AuditEntry): void {
		const stmt = this.db.prepare(`
			INSERT INTO audit_log (
				id, action_id, task_id, timestamp, description,
				method, safety_level, approval, result,
				output, error, screenshot_before, screenshot_after,
				reversible, reversed
			) VALUES (
				?, ?, ?, ?, ?,
				?, ?, ?, ?,
				?, ?, ?, ?,
				?, ?
			)
		`);

		stmt.run(
			entry.id,
			entry.actionId,
			entry.taskId,
			entry.timestamp.toISOString(),
			entry.description,
			entry.method,
			entry.safetyLevel,
			entry.approval,
			entry.result,
			entry.output ?? null,
			entry.error ?? null,
			entry.screenshotBefore ?? null,
			entry.screenshotAfter ?? null,
			entry.reversible ? 1 : 0,
			entry.reversed ? 1 : 0,
		);

		log.debug("Audit entry recorded", { id: entry.id, result: entry.result });
	}

	/** Get recent audit entries */
	getRecent(limit = 50): AuditEntry[] {
		const stmt = this.db.prepare("SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT ?");
		const rows = stmt.all(limit) as AuditRow[];
		return rows.map(rowToEntry);
	}

	/** Get entries for a specific task */
	getByTask(taskId: string): AuditEntry[] {
		const stmt = this.db.prepare(
			"SELECT * FROM audit_log WHERE task_id = ? ORDER BY timestamp ASC",
		);
		const rows = stmt.all(taskId) as AuditRow[];
		return rows.map(rowToEntry);
	}

	/** Get entries within a time range */
	getByTimeRange(from: Date, to: Date): AuditEntry[] {
		const stmt = this.db.prepare(
			"SELECT * FROM audit_log WHERE timestamp BETWEEN ? AND ? ORDER BY timestamp ASC",
		);
		const rows = stmt.all(from.toISOString(), to.toISOString()) as AuditRow[];
		return rows.map(rowToEntry);
	}

	/** Mark an action as reversed (undone) */
	markReversed(actionId: string): void {
		const stmt = this.db.prepare("UPDATE audit_log SET reversed = 1 WHERE action_id = ?");
		stmt.run(actionId);
	}

	/** Get count of actions by result type */
	getStats(): Record<string, number> {
		const stmt = this.db.prepare("SELECT result, COUNT(*) as count FROM audit_log GROUP BY result");
		const rows = stmt.all() as Array<{ result: string; count: number }>;
		const stats: Record<string, number> = {};
		for (const row of rows) {
			stats[row.result] = row.count;
		}
		return stats;
	}
}

interface AuditRow {
	id: string;
	action_id: string;
	task_id: string;
	timestamp: string;
	description: string;
	method: string;
	safety_level: number;
	approval: string;
	result: string;
	output: string | null;
	error: string | null;
	screenshot_before: string | null;
	screenshot_after: string | null;
	reversible: number;
	reversed: number;
}

function rowToEntry(row: AuditRow): AuditEntry {
	return {
		id: row.id,
		actionId: row.action_id,
		taskId: row.task_id,
		timestamp: new Date(row.timestamp),
		description: row.description,
		method: row.method as AuditEntry["method"],
		safetyLevel: row.safety_level,
		approval: row.approval as AuditEntry["approval"],
		result: row.result as AuditEntry["result"],
		output: row.output ?? undefined,
		error: row.error ?? undefined,
		screenshotBefore: row.screenshot_before ?? undefined,
		screenshotAfter: row.screenshot_after ?? undefined,
		reversible: row.reversible === 1,
		reversed: row.reversed === 1,
	};
}
