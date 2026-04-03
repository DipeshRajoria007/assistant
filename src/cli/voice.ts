import { createLogger } from "../core/logger.js";

const log = createLogger("voice");

const VOICE_BINARY = "dist/assistant-voice";
const RECORDING_PATH = "/tmp/assistant-voice-recording.wav";
const RECORDING_DURATION = 10; // seconds

export interface VoiceResult {
	success: boolean;
	text?: string | undefined;
	error?: string | undefined;
}

/** Detect which voice capture method is available */
export async function detectVoiceMethod(): Promise<"swift" | "ffmpeg" | null> {
	// Try Swift binary first
	try {
		const file = Bun.file(VOICE_BINARY);
		if (await file.exists()) return "swift";
	} catch {
		// ignore
	}

	// Fallback: ffmpeg + claude for transcription
	if ((await binaryExists("ffmpeg")) && (await binaryExists("claude"))) {
		return "ffmpeg";
	}

	return null;
}

/** Check if voice input is available via any method */
export async function isVoiceAvailable(): Promise<boolean> {
	return (await detectVoiceMethod()) !== null;
}

/** Record and transcribe a single voice input */
export async function captureVoiceInput(): Promise<VoiceResult> {
	const method = await detectVoiceMethod();

	if (!method) {
		return {
			success: false,
			error: "No voice method available. Need: ffmpeg + claude CLI, or run bun run hotkey:build",
		};
	}

	if (method === "swift") {
		return captureWithSwift();
	}
	return captureWithFfmpeg();
}

/** Capture using the Swift SFSpeechRecognizer binary */
async function captureWithSwift(): Promise<VoiceResult> {
	try {
		const proc = Bun.spawn([VOICE_BINARY], {
			stdout: "pipe",
			stderr: "pipe",
			stdin: "pipe",
		});

		proc.stdin.write("\n");
		proc.stdin.end();

		const exitCode = await proc.exited;
		const stdout = typeof proc.stdout === "number" ? "" : await new Response(proc.stdout).text();

		if (exitCode !== 0) {
			log.warn("Swift voice failed, will try ffmpeg next time", { exitCode });
			return captureWithFfmpeg();
		}

		const text = stdout.trim();
		if (!text) return { success: false, error: "No speech detected" };

		log.info("Voice captured (swift)", { text: text.slice(0, 50) });
		return { success: true, text };
	} catch {
		log.warn("Swift voice error, falling back to ffmpeg");
		return captureWithFfmpeg();
	}
}

/** Capture using ffmpeg recording + Claude CLI transcription */
async function captureWithFfmpeg(): Promise<VoiceResult> {
	const ffmpegAvail = await binaryExists("ffmpeg");
	const claudeAvail = await binaryExists("claude");

	if (!ffmpegAvail || !claudeAvail) {
		return {
			success: false,
			error: "Need both ffmpeg and claude CLI for voice input",
		};
	}

	// Step 1: Record audio with ffmpeg
	const recordResult = await recordAudio();
	if (!recordResult.success) {
		return { success: false, error: recordResult.error };
	}

	// Step 2: Transcribe with Claude
	const transcription = await transcribeWithClaude(RECORDING_PATH);
	return transcription;
}

async function recordAudio(): Promise<{ success: boolean; error?: string }> {
	log.info(`Recording ${RECORDING_DURATION}s of audio...`);

	const proc = Bun.spawn(
		[
			"ffmpeg",
			"-f",
			"avfoundation",
			"-i",
			":0",
			"-t",
			String(RECORDING_DURATION),
			"-ar",
			"16000",
			"-ac",
			"1",
			"-y",
			RECORDING_PATH,
		],
		{ stdout: "pipe", stderr: "pipe" },
	);

	const exitCode = await proc.exited;

	if (exitCode !== 0) {
		const stderr = typeof proc.stderr === "number" ? "" : await new Response(proc.stderr).text();
		log.error("ffmpeg recording failed", { exitCode });
		return { success: false, error: `Recording failed: ${stderr.slice(-200)}` };
	}

	// Verify file exists and has content
	const file = Bun.file(RECORDING_PATH);
	const exists = await file.exists();
	if (!exists) {
		return { success: false, error: "Recording file not created" };
	}

	const size = file.size;
	if (size < 1000) {
		return { success: false, error: "Recording too short or empty" };
	}

	log.info("Audio recorded", { size });
	return { success: true };
}

async function transcribeWithClaude(audioPath: string): Promise<VoiceResult> {
	log.info("Transcribing with Claude...");

	const proc = Bun.spawn(
		[
			"claude",
			"-p",
			"--output-format",
			"text",
			`Transcribe this audio file exactly. Output ONLY the transcribed text, nothing else. No quotes, no labels, no commentary. File: ${audioPath}`,
		],
		{ stdout: "pipe", stderr: "pipe" },
	);

	const exitCode = await proc.exited;
	const stdout = typeof proc.stdout === "number" ? "" : await new Response(proc.stdout).text();

	if (exitCode !== 0) {
		const stderr = typeof proc.stderr === "number" ? "" : await new Response(proc.stderr).text();
		log.error("Claude transcription failed", { exitCode, stderr: stderr.slice(0, 200) });
		return { success: false, error: "Transcription failed" };
	}

	const text = stdout.trim();
	if (!text) return { success: false, error: "No speech detected in recording" };

	log.info("Voice captured (ffmpeg+claude)", { text: text.slice(0, 50) });
	return { success: true, text };
}

async function binaryExists(name: string): Promise<boolean> {
	try {
		const proc = Bun.spawn(["which", name], { stdout: "pipe", stderr: "pipe" });
		return (await proc.exited) === 0;
	} catch {
		return false;
	}
}
