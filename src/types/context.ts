/** Represents the current state of the user's environment */
export interface UserContext {
	timestamp: Date;
	screen: ScreenContext;
	system: SystemContext;
	git?: GitContext;
	calendar?: CalendarContext;
	activeFiles: FileContext[];
}

export interface ScreenContext {
	activeApp: string;
	activeWindow: string;
	activeTab?: string;
	/** Structured AX tree summary of focused element */
	focusedElement?: AXElementSummary;
	/** Screen content description (from vision model, only when needed) */
	description?: string;
}

export interface AXElementSummary {
	role: string;
	title?: string;
	value?: string;
	children?: AXElementSummary[];
}

export interface SystemContext {
	hostname: string;
	username: string;
	platform: "darwin";
	runningApps: string[];
	clipboard?: string;
	networkStatus: "online" | "offline";
	batteryLevel?: number;
	doNotDisturb: boolean;
}

export interface GitContext {
	repoPath: string;
	branch: string;
	status: GitFileStatus[];
	recentCommits: GitCommitSummary[];
	hasUnpushedChanges: boolean;
}

export interface GitFileStatus {
	path: string;
	status: "modified" | "added" | "deleted" | "untracked" | "renamed";
}

export interface GitCommitSummary {
	hash: string;
	message: string;
	author: string;
	date: Date;
}

export interface CalendarContext {
	upcoming: CalendarEvent[];
	current?: CalendarEvent;
}

export interface CalendarEvent {
	id: string;
	title: string;
	startTime: Date;
	endTime: Date;
	location?: string;
	attendees?: string[];
	isAllDay: boolean;
}

export interface FileContext {
	path: string;
	name: string;
	language?: string;
	lastModified: Date;
	isOpen: boolean;
}

/** A compressed context snapshot for storage (fits in limited token budget) */
export interface ContextSnapshot {
	id: string;
	timestamp: Date;
	summary: string;
	activeApp: string;
	activeFile?: string | undefined;
	gitBranch?: string | undefined;
	currentGoalIds: string[];
	tokenCount: number;
}
