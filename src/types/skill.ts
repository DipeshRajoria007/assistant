import { z } from "zod";

/** Permissions a skill can request */
export interface SkillPermissions {
	/** Allowed network domains */
	net: string[];
	/** Allowed file read paths */
	read: string[];
	/** Allowed file write paths */
	write: string[];
	/** Allowed environment variables */
	env: string[];
	/** Allowed subprocess commands */
	run: string[];
}

/** Skill manifest — declares what a skill does and what it needs */
export interface SkillManifest {
	name: string;
	version: string;
	description: string;
	author: string;
	entrypoint: string;
	permissions: SkillPermissions;
	triggers?: SkillTrigger[];
}

/** Events that can trigger a skill automatically */
export interface SkillTrigger {
	event: TriggerEvent;
	filter?: Record<string, string>;
}

export type TriggerEvent =
	| "app_activated"
	| "file_changed"
	| "calendar_event"
	| "git_commit"
	| "manual"
	| "schedule";

/** Result of executing a skill */
export interface SkillResult {
	skillName: string;
	success: boolean;
	output?: string;
	error?: string;
	durationMs: number;
}

/** Schema for validating skill manifests */
export const SkillManifestSchema = z.object({
	name: z
		.string()
		.min(1)
		.max(64)
		.regex(/^[a-z0-9-]+$/),
	version: z.string().regex(/^\d+\.\d+\.\d+$/),
	description: z.string().min(1).max(256),
	author: z.string().min(1),
	entrypoint: z.string().min(1),
	permissions: z.object({
		net: z.array(z.string()),
		read: z.array(z.string()),
		write: z.array(z.string()),
		env: z.array(z.string()),
		run: z.array(z.string()),
	}),
	triggers: z
		.array(
			z.object({
				event: z.enum([
					"app_activated",
					"file_changed",
					"calendar_event",
					"git_commit",
					"manual",
					"schedule",
				]),
				filter: z.record(z.string()).optional(),
			}),
		)
		.optional(),
});
