import { createLogger } from "../core/logger.js";

const log = createLogger("voice");

const VOICE_BINARY = "dist/assistant-voice";

export interface VoiceResult {
	success: boolean;
	text?: string | undefined;
	error?: string | undefined;
}

/** Check if the voice binary exists */
export async function isVoiceAvailable(): Promise<boolean> {
	try {
		const file = Bun.file(VOICE_BINARY);
		return await file.exists();
	} catch {
		return false;
	}
}

/** Record and transcribe a single voice input */
export async function captureVoiceInput(): Promise<VoiceResult> {
	const available = await isVoiceAvailable();
	if (!available) {
		return {
			success: false,
			error: "Voice binary not found. Run: bun run hotkey:build",
		};
	}

	try {
		// Run voice binary in single-shot mode
		// It waits for Enter, records, transcribes, outputs text to stdout
		const proc = Bun.spawn([VOICE_BINARY], {
			stdout: "pipe",
			stderr: "pipe",
			stdin: "pipe",
		});

		// Send Enter to start recording (FileSink API)
		proc.stdin.write("\n");
		proc.stdin.end();

		const exitCode = await proc.exited;

		const stdoutStream = proc.stdout;
		const stderrStream = proc.stderr;
		const stdout = typeof stdoutStream === "number" ? "" : await new Response(stdoutStream).text();
		const stderr = typeof stderrStream === "number" ? "" : await new Response(stderrStream).text();

		if (exitCode !== 0) {
			log.error("Voice capture failed", { exitCode, stderr });
			return {
				success: false,
				error: stderr.trim() || `Voice process exited with code ${exitCode}`,
			};
		}

		const text = stdout.trim();
		if (!text) {
			return { success: false, error: "No speech detected" };
		}

		log.info("Voice captured", { text: text.slice(0, 50) });
		return { success: true, text };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		log.error("Voice capture error", err);
		return { success: false, error: message };
	}
}
