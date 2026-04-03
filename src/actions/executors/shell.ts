import { createLogger } from "../../core/logger.js";
import { SafetyLevel } from "../../types/action.js";
import { classifySafetyLevel } from "../safety-gate.js";

const log = createLogger("shell-executor");

const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_MAX_OUTPUT = 1_048_576; // 1MB

export interface ShellExecutorOptions {
	command: string;
	args: string[];
	cwd?: string | undefined;
	env?: Record<string, string> | undefined;
	timeout?: number | undefined;
	safetyCheck?: boolean | undefined;
	maxOutputBytes?: number | undefined;
}

export interface ShellResult {
	success: boolean;
	stdout: string;
	stderr: string;
	exitCode: number;
	durationMs: number;
	timedOut: boolean;
	blocked: boolean;
	truncated: boolean;
	error?: string | undefined;
}

export async function executeShell(options: ShellExecutorOptions): Promise<ShellResult> {
	const {
		command,
		args,
		cwd,
		env,
		timeout = DEFAULT_TIMEOUT,
		safetyCheck = true,
		maxOutputBytes = DEFAULT_MAX_OUTPUT,
	} = options;

	// Safety check first
	if (safetyCheck) {
		const safety = classifySafetyLevel({
			method: "shell",
			payload: { type: "shell", command, args },
		});

		if (safety === SafetyLevel.BLOCKED) {
			log.warn("Command blocked by safety gate", { command, args });
			return {
				success: false,
				stdout: "",
				stderr: "",
				exitCode: -1,
				durationMs: 0,
				timedOut: false,
				blocked: true,
				truncated: false,
				error: `Command blocked by safety gate: ${command} ${args.join(" ")}`,
			};
		}
	}

	const start = performance.now();

	try {
		const spawnOpts: {
			cwd?: string;
			env?: Record<string, string | undefined>;
			stdout: "pipe";
			stderr: "pipe";
		} = { stdout: "pipe", stderr: "pipe" };

		if (cwd) spawnOpts.cwd = cwd;
		if (env) spawnOpts.env = { ...process.env, ...env };

		const proc = Bun.spawn([command, ...args], spawnOpts);

		const result = await raceTimeout(proc, timeout);
		const durationMs = Math.round(performance.now() - start);

		if (result.timedOut) {
			proc.kill();
			log.warn("Command timed out", { command, timeout, durationMs });
			return {
				success: false,
				stdout: "",
				stderr: "",
				exitCode: -1,
				durationMs,
				timedOut: true,
				blocked: false,
				truncated: false,
				error: `Command timed out after ${timeout}ms`,
			};
		}

		let stdout = result.stdout;
		let stderr = result.stderr;
		let truncated = false;

		if (stdout.length > maxOutputBytes) {
			stdout = `${stdout.slice(0, maxOutputBytes)}\n... [truncated, ${stdout.length} bytes total]`;
			truncated = true;
		}

		if (stderr.length > maxOutputBytes) {
			stderr = `${stderr.slice(0, maxOutputBytes)}\n... [truncated]`;
		}

		const exitCode = result.exitCode;
		const success = exitCode === 0;

		log.debug("Command completed", { command, exitCode, durationMs });

		return {
			success,
			stdout,
			stderr,
			exitCode,
			durationMs,
			timedOut: false,
			blocked: false,
			truncated,
		};
	} catch (err) {
		const durationMs = Math.round(performance.now() - start);
		const errorMessage = err instanceof Error ? err.message : String(err);

		log.error("Command execution failed", err);

		return {
			success: false,
			stdout: "",
			stderr: "",
			exitCode: -1,
			durationMs,
			timedOut: false,
			blocked: false,
			truncated: false,
			error: errorMessage,
		};
	}
}

interface ProcessResult {
	stdout: string;
	stderr: string;
	exitCode: number;
	timedOut: boolean;
}

async function raceTimeout(
	proc: ReturnType<typeof Bun.spawn>,
	timeout: number,
): Promise<ProcessResult> {
	const timeoutPromise = new Promise<ProcessResult>((resolve) => {
		setTimeout(() => {
			resolve({ stdout: "", stderr: "", exitCode: -1, timedOut: true });
		}, timeout);
	});

	const processPromise = (async (): Promise<ProcessResult> => {
		const exitCode = await proc.exited;

		const stdoutStream = proc.stdout;
		const stderrStream = proc.stderr;
		const stdoutBuf =
			typeof stdoutStream === "number" ? "" : await new Response(stdoutStream).text();
		const stderrBuf =
			typeof stderrStream === "number" ? "" : await new Response(stderrStream).text();

		return {
			stdout: stdoutBuf,
			stderr: stderrBuf,
			exitCode,
			timedOut: false,
		};
	})();

	return Promise.race([processPromise, timeoutPromise]);
}
