import { Database } from "bun:sqlite";
import { createLogger } from "../core/logger.js";
import type {
	Episode,
	EpisodeType,
	Goal,
	GoalPriority,
	GoalStatus,
	KnowledgeCategory,
	KnowledgeEntry,
} from "../types/memory.js";

const log = createLogger("memory-store");

export class MemoryStore {
	private db: Database;

	constructor(dbPath: string) {
		this.db = new Database(dbPath);
		this.db.run("PRAGMA journal_mode = WAL");
		this.db.run("PRAGMA foreign_keys = ON");
		this.initialize();
	}

	getDb(): Database {
		return this.db;
	}

	private initialize(): void {
		this.db.run(`
			CREATE TABLE IF NOT EXISTS knowledge (
				id TEXT PRIMARY KEY,
				category TEXT NOT NULL,
				subject TEXT NOT NULL,
				content TEXT NOT NULL,
				confidence REAL NOT NULL DEFAULT 1.0,
				source TEXT NOT NULL,
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL,
				access_count INTEGER NOT NULL DEFAULT 0,
				last_accessed_at TEXT NOT NULL
			)
		`);
		this.db.run(`
			CREATE TABLE IF NOT EXISTS episodes (
				id TEXT PRIMARY KEY,
				timestamp TEXT NOT NULL,
				type TEXT NOT NULL,
				summary TEXT NOT NULL,
				details TEXT,
				related_goal_ids TEXT NOT NULL DEFAULT '[]',
				related_knowledge_ids TEXT NOT NULL DEFAULT '[]',
				context_snapshot_id TEXT
			)
		`);
		this.db.run(`
			CREATE TABLE IF NOT EXISTS goals (
				id TEXT PRIMARY KEY,
				title TEXT NOT NULL,
				description TEXT NOT NULL,
				status TEXT NOT NULL DEFAULT 'active',
				priority TEXT NOT NULL DEFAULT 'medium',
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL,
				deadline TEXT,
				parent_goal_id TEXT,
				sub_goal_ids TEXT NOT NULL DEFAULT '[]',
				related_episode_ids TEXT NOT NULL DEFAULT '[]',
				progress REAL NOT NULL DEFAULT 0.0,
				notes TEXT NOT NULL DEFAULT '[]'
			)
		`);

		this.db.run("CREATE INDEX IF NOT EXISTS idx_knowledge_category ON knowledge(category)");
		this.db.run("CREATE INDEX IF NOT EXISTS idx_knowledge_subject ON knowledge(subject)");
		this.db.run("CREATE INDEX IF NOT EXISTS idx_episodes_timestamp ON episodes(timestamp)");
		this.db.run("CREATE INDEX IF NOT EXISTS idx_episodes_type ON episodes(type)");
		this.db.run("CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status)");

		log.info("Memory store initialized");
	}

	// === Knowledge ===

	addKnowledge(entry: Omit<KnowledgeEntry, "accessCount" | "lastAccessedAt">): KnowledgeEntry {
		const now = new Date().toISOString();
		const full: KnowledgeEntry = {
			...entry,
			accessCount: 0,
			lastAccessedAt: new Date(now),
		};

		this.db
			.prepare(
				`INSERT INTO knowledge (id, category, subject, content, confidence, source, created_at, updated_at, access_count, last_accessed_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			)
			.run(
				full.id,
				full.category,
				full.subject,
				full.content,
				full.confidence,
				full.source,
				full.createdAt.toISOString(),
				full.updatedAt.toISOString(),
				full.accessCount,
				now,
			);

		return full;
	}

	getKnowledge(id: string): KnowledgeEntry | null {
		const row = this.db
			.prepare("SELECT * FROM knowledge WHERE id = ?")
			.get(id) as KnowledgeRow | null;

		if (!row) return null;

		// Update access tracking
		this.db
			.prepare(
				"UPDATE knowledge SET access_count = access_count + 1, last_accessed_at = ? WHERE id = ?",
			)
			.run(new Date().toISOString(), id);

		return knowledgeRowToEntry(row);
	}

	searchKnowledge(query: string, category?: KnowledgeCategory, limit = 10): KnowledgeEntry[] {
		const likeQuery = `%${query}%`;

		if (category) {
			const rows = this.db
				.prepare(
					"SELECT * FROM knowledge WHERE (subject LIKE ? OR content LIKE ?) AND category = ? ORDER BY updated_at DESC LIMIT ?",
				)
				.all(likeQuery, likeQuery, category, limit) as KnowledgeRow[];
			return rows.map(knowledgeRowToEntry);
		}

		const rows = this.db
			.prepare(
				"SELECT * FROM knowledge WHERE (subject LIKE ? OR content LIKE ?) ORDER BY updated_at DESC LIMIT ?",
			)
			.all(likeQuery, likeQuery, limit) as KnowledgeRow[];
		return rows.map(knowledgeRowToEntry);
	}

	// === Episodes ===

	addEpisode(episode: Episode): void {
		this.db
			.prepare(
				`INSERT INTO episodes (id, timestamp, type, summary, details, related_goal_ids, related_knowledge_ids, context_snapshot_id)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			)
			.run(
				episode.id,
				episode.timestamp.toISOString(),
				episode.type,
				episode.summary,
				episode.details ?? null,
				JSON.stringify(episode.relatedGoalIds),
				JSON.stringify(episode.relatedKnowledgeIds),
				episode.contextSnapshotId ?? null,
			);
	}

	getRecentEpisodes(limit = 20): Episode[] {
		const rows = this.db
			.prepare("SELECT * FROM episodes ORDER BY timestamp DESC LIMIT ?")
			.all(limit) as EpisodeRow[];
		return rows.map(episodeRowToEntry);
	}

	// === Goals ===

	addGoal(goal: Goal): void {
		this.db
			.prepare(
				`INSERT INTO goals (id, title, description, status, priority, created_at, updated_at, deadline, parent_goal_id, sub_goal_ids, related_episode_ids, progress, notes)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			)
			.run(
				goal.id,
				goal.title,
				goal.description,
				goal.status,
				goal.priority,
				goal.createdAt.toISOString(),
				goal.updatedAt.toISOString(),
				goal.deadline?.toISOString() ?? null,
				goal.parentGoalId ?? null,
				JSON.stringify(goal.subGoalIds),
				JSON.stringify(goal.relatedEpisodeIds),
				goal.progress,
				JSON.stringify(goal.notes),
			);
	}

	getActiveGoals(): Goal[] {
		const rows = this.db
			.prepare("SELECT * FROM goals WHERE status = 'active' ORDER BY priority ASC, updated_at DESC")
			.all() as GoalRow[];
		return rows.map(goalRowToEntry);
	}

	updateGoalProgress(id: string, progress: number): void {
		this.db
			.prepare("UPDATE goals SET progress = ?, updated_at = ? WHERE id = ?")
			.run(progress, new Date().toISOString(), id);
	}

	updateGoalStatus(id: string, status: GoalStatus): void {
		this.db
			.prepare("UPDATE goals SET status = ?, updated_at = ? WHERE id = ?")
			.run(status, new Date().toISOString(), id);
	}

	close(): void {
		this.db.close();
		log.info("Memory store closed");
	}
}

// === Row types and converters ===

interface KnowledgeRow {
	id: string;
	category: string;
	subject: string;
	content: string;
	confidence: number;
	source: string;
	created_at: string;
	updated_at: string;
	access_count: number;
	last_accessed_at: string;
}

function knowledgeRowToEntry(row: KnowledgeRow): KnowledgeEntry {
	return {
		id: row.id,
		category: row.category as KnowledgeCategory,
		subject: row.subject,
		content: row.content,
		confidence: row.confidence,
		source: row.source,
		createdAt: new Date(row.created_at),
		updatedAt: new Date(row.updated_at),
		accessCount: row.access_count,
		lastAccessedAt: new Date(row.last_accessed_at),
	};
}

interface EpisodeRow {
	id: string;
	timestamp: string;
	type: string;
	summary: string;
	details: string | null;
	related_goal_ids: string;
	related_knowledge_ids: string;
	context_snapshot_id: string | null;
}

function episodeRowToEntry(row: EpisodeRow): Episode {
	return {
		id: row.id,
		timestamp: new Date(row.timestamp),
		type: row.type as EpisodeType,
		summary: row.summary,
		details: row.details ?? undefined,
		relatedGoalIds: JSON.parse(row.related_goal_ids) as string[],
		relatedKnowledgeIds: JSON.parse(row.related_knowledge_ids) as string[],
		contextSnapshotId: row.context_snapshot_id ?? undefined,
	};
}

interface GoalRow {
	id: string;
	title: string;
	description: string;
	status: string;
	priority: string;
	created_at: string;
	updated_at: string;
	deadline: string | null;
	parent_goal_id: string | null;
	sub_goal_ids: string;
	related_episode_ids: string;
	progress: number;
	notes: string;
}

function goalRowToEntry(row: GoalRow): Goal {
	return {
		id: row.id,
		title: row.title,
		description: row.description,
		status: row.status as GoalStatus,
		priority: row.priority as GoalPriority,
		createdAt: new Date(row.created_at),
		updatedAt: new Date(row.updated_at),
		deadline: row.deadline ? new Date(row.deadline) : undefined,
		parentGoalId: row.parent_goal_id ?? undefined,
		subGoalIds: JSON.parse(row.sub_goal_ids) as string[],
		relatedEpisodeIds: JSON.parse(row.related_episode_ids) as string[],
		progress: row.progress,
		notes: JSON.parse(row.notes) as string[],
	};
}
