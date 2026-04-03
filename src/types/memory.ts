/** A piece of knowledge about the user */
export interface KnowledgeEntry {
	id: string;
	category: KnowledgeCategory;
	subject: string;
	content: string;
	confidence: number;
	source: string;
	createdAt: Date;
	updatedAt: Date;
	accessCount: number;
	lastAccessedAt: Date;
}

export type KnowledgeCategory =
	| "preference"
	| "identity"
	| "project"
	| "relationship"
	| "skill"
	| "pattern"
	| "workflow";

/** A timestamped event in the user's history */
export interface Episode {
	id: string;
	timestamp: Date;
	type: EpisodeType;
	summary: string;
	details?: string | undefined;
	relatedGoalIds: string[];
	relatedKnowledgeIds: string[];
	contextSnapshotId?: string | undefined;
}

export type EpisodeType =
	| "user_request"
	| "agent_action"
	| "system_event"
	| "error"
	| "milestone"
	| "observation";

/** A persistent goal the user is working toward */
export interface Goal {
	id: string;
	title: string;
	description: string;
	status: GoalStatus;
	priority: GoalPriority;
	createdAt: Date;
	updatedAt: Date;
	deadline?: Date | undefined;
	parentGoalId?: string | undefined;
	subGoalIds: string[];
	relatedEpisodeIds: string[];
	progress: number;
	notes: string[];
}

export type GoalStatus = "active" | "paused" | "completed" | "abandoned";
export type GoalPriority = "critical" | "high" | "medium" | "low";

/** Vector embedding for semantic search */
export interface Embedding {
	id: string;
	sourceId: string;
	sourceType: "knowledge" | "episode" | "goal";
	vector: Float32Array;
	text: string;
	createdAt: Date;
}

/** Result from a memory search query */
export interface MemorySearchResult {
	entry: KnowledgeEntry | Episode | Goal;
	score: number;
	matchType: "semantic" | "keyword" | "hybrid";
}
