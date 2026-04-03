import { createLogger } from "../core/logger.js";

const log = createLogger("speech");

export interface SpeechOptions {
	voice?: string | undefined;
	rate?: number | undefined;
}

const DEFAULT_VOICE = "Samantha";
const DEFAULT_RATE = 200; // words per minute

/** Check if macOS say command is available */
export async function isSayAvailable(): Promise<boolean> {
	try {
		const proc = Bun.spawn(["which", "say"], { stdout: "pipe", stderr: "pipe" });
		const exitCode = await proc.exited;
		return exitCode === 0;
	} catch {
		return false;
	}
}

/** Speak text using macOS say command */
export async function speak(text: string, options?: SpeechOptions): Promise<boolean> {
	const cleaned = cleanTextForSpeech(text);
	if (!cleaned) return false;

	const voice = options?.voice ?? DEFAULT_VOICE;
	const rate = options?.rate ?? DEFAULT_RATE;

	try {
		const proc = Bun.spawn(["say", "-v", voice, "-r", String(rate), cleaned], {
			stdout: "pipe",
			stderr: "pipe",
		});

		const exitCode = await proc.exited;

		if (exitCode !== 0) {
			// Fallback to default system voice if specified voice not found
			const fallback = Bun.spawn(["say", "-r", String(rate), cleaned], {
				stdout: "pipe",
				stderr: "pipe",
			});
			const fbExit = await fallback.exited;
			if (fbExit !== 0) {
				log.error("Speech failed", { exitCode: fbExit });
				return false;
			}
		}

		return true;
	} catch (err) {
		log.error("Speech error", err);
		return false;
	}
}

/** Stop any currently speaking audio */
export async function stopSpeaking(): Promise<void> {
	try {
		const proc = Bun.spawn(["killall", "say"], {
			stdout: "pipe",
			stderr: "pipe",
		});
		await proc.exited;
	} catch {
		// Ignore — may not be speaking
	}
}

/** Clean text for speech: strip markdown, ANSI codes, code blocks, etc. */
export function cleanTextForSpeech(text: string): string {
	let cleaned = text;

	// Strip ANSI escape codes (ESC[ ... m)
	// biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape stripping requires matching ESC char
	cleaned = cleaned.replace(/\x1b\[[0-9;]*m/g, "");

	// Strip code blocks (```...```)
	cleaned = cleaned.replace(/```[\s\S]*?```/g, "");

	// Strip inline code backticks
	cleaned = cleaned.replace(/`([^`]*)`/g, "$1");

	// Strip markdown headers
	cleaned = cleaned.replace(/^#{1,6}\s+/gm, "");

	// Strip markdown links [text](url) → text
	cleaned = cleaned.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");

	// Strip bold/italic markers
	cleaned = cleaned.replace(/\*\*([^*]*)\*\*/g, "$1");
	cleaned = cleaned.replace(/__([^_]*)__/g, "$1");
	cleaned = cleaned.replace(/\*([^*]*)\*/g, "$1");
	cleaned = cleaned.replace(/_([^_]*)_/g, "$1");

	// Strip bullet markers
	cleaned = cleaned.replace(/^[\s]*[-*]\s+/gm, "");

	// Collapse multiple newlines
	cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

	return cleaned.trim();
}
