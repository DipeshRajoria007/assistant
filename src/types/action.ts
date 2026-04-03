import { z } from "zod";

/** Safety levels for actions — determines approval flow */
export enum SafetyLevel {
	/** Read-only operations — auto-approve */
	SAFE = 0,
	/** Open apps, type in fields — auto with logging */
	LOW = 1,
	/** Send messages, modify files — countdown to cancel */
	MEDIUM = 2,
	/** Delete files, send emails — explicit approval required */
	HIGH = 3,
	/** Admin/sudo, keychain — always blocked */
	BLOCKED = 4,
}

/** How the action will be executed on macOS */
export type ExecutionMethod = "shell" | "applescript" | "accessibility" | "vision" | "api";

/** Approval status for an action */
export type ApprovalStatus = "auto" | "countdown" | "approved" | "denied" | "blocked";

/** A single executable action */
export interface Action {
	id: string;
	taskId: string;
	description: string;
	method: ExecutionMethod;
	safetyLevel: SafetyLevel;
	payload: ActionPayload;
	approval: ApprovalStatus;
	reversible: boolean;
	undoPayload?: ActionPayload;
}

/** Payload types for different execution methods */
export type ActionPayload =
	| ShellPayload
	| AppleScriptPayload
	| AccessibilityPayload
	| VisionPayload
	| ApiPayload;

export interface ShellPayload {
	type: "shell";
	command: string;
	args: string[];
	cwd?: string;
	timeout?: number;
}

export interface AppleScriptPayload {
	type: "applescript";
	script: string;
	language: "applescript" | "javascript";
}

export interface AccessibilityPayload {
	type: "accessibility";
	app: string;
	actions: AXAction[];
}

export interface AXAction {
	element: AXElementQuery;
	action: "press" | "setValue" | "focus" | "select";
	value?: string | undefined;
}

export interface AXElementQuery {
	role?: string | undefined;
	title?: string | undefined;
	identifier?: string | undefined;
	path?: string[] | undefined;
}

export interface VisionPayload {
	type: "vision";
	description: string;
	targetElement: string;
	action: "click" | "type" | "scroll" | "drag";
	value?: string;
}

export interface ApiPayload {
	type: "api";
	service: string;
	method: string;
	params: Record<string, unknown>;
}

/** Result of executing an action */
export interface ActionResult {
	actionId: string;
	success: boolean;
	output?: string;
	error?: string;
	screenshotBefore?: string;
	screenshotAfter?: string;
	timestamp: Date;
	durationMs: number;
}

/** Audit log entry — immutable record of every action */
export interface AuditEntry {
	id: string;
	actionId: string;
	taskId: string;
	timestamp: Date;
	description: string;
	method: ExecutionMethod;
	safetyLevel: SafetyLevel;
	approval: ApprovalStatus;
	result: "success" | "failure" | "blocked" | "cancelled";
	output?: string | undefined;
	error?: string | undefined;
	screenshotBefore?: string | undefined;
	screenshotAfter?: string | undefined;
	reversible: boolean;
	reversed: boolean;
}

/** Schema for validating action payloads from LLM output */
export const ShellPayloadSchema = z.object({
	type: z.literal("shell"),
	command: z.string().min(1),
	args: z.array(z.string()),
	cwd: z.string().optional(),
	timeout: z.number().positive().optional(),
});

export const AppleScriptPayloadSchema = z.object({
	type: z.literal("applescript"),
	script: z.string().min(1),
	language: z.enum(["applescript", "javascript"]),
});

export const ActionPayloadSchema = z.discriminatedUnion("type", [
	ShellPayloadSchema,
	AppleScriptPayloadSchema,
	z.object({
		type: z.literal("accessibility"),
		app: z.string().min(1),
		actions: z.array(
			z.object({
				element: z.object({
					role: z.string().optional(),
					title: z.string().optional(),
					identifier: z.string().optional(),
					path: z.array(z.string()).optional(),
				}),
				action: z.enum(["press", "setValue", "focus", "select"]),
				value: z.string().optional(),
			}),
		),
	}),
	z.object({
		type: z.literal("vision"),
		description: z.string().min(1),
		targetElement: z.string().min(1),
		action: z.enum(["click", "type", "scroll", "drag"]),
		value: z.string().optional(),
	}),
	z.object({
		type: z.literal("api"),
		service: z.string().min(1),
		method: z.string().min(1),
		params: z.record(z.unknown()),
	}),
]);
