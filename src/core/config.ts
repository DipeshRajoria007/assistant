import { z } from "zod";

const ConfigSchema = z.object({
	/** Path to claude CLI binary (auto-detected if not set) */
	claudePath: z.string().optional(),
	/** Path to codex CLI binary (auto-detected if not set) */
	codexPath: z.string().optional(),
	/** Default autonomy level: 0=ask everything, 4=full auto */
	defaultAutonomyLevel: z.number().int().min(0).max(4).default(1),
	dbPath: z.string().default("data/assistant.db"),
	socketPath: z.string().default("/tmp/assistant.sock"),
	logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
	maxContextTokens: z.number().int().positive().default(8000),
	/** Which CLI to use for which task type */
	routing: z
		.object({
			triage: z.enum(["claude", "codex"]).default("claude"),
			simple: z.enum(["claude", "codex"]).default("claude"),
			complex: z.enum(["claude", "codex"]).default("claude"),
			code: z.enum(["claude", "codex"]).default("codex"),
		})
		.default({}),
	safety: z
		.object({
			countdownSeconds: z.number().int().min(1).max(30).default(5),
			auditLogEnabled: z.boolean().default(true),
			screenshotOnAction: z.boolean().default(true),
		})
		.default({}),
});

export type Config = z.infer<typeof ConfigSchema>;

/** Which CLIs are available on this machine */
export interface DetectedCLIs {
	claude: string | null;
	codex: string | null;
}

let _config: Config | null = null;
let _detectedCLIs: DetectedCLIs | null = null;

/** Detect which AI CLIs are installed */
export async function detectCLIs(): Promise<DetectedCLIs> {
	if (_detectedCLIs) return _detectedCLIs;

	const [claudePath, codexPath] = await Promise.all([findBinary("claude"), findBinary("codex")]);

	_detectedCLIs = { claude: claudePath, codex: codexPath };
	return _detectedCLIs;
}

async function findBinary(name: string): Promise<string | null> {
	try {
		const proc = Bun.spawn(["which", name], { stdout: "pipe", stderr: "pipe" });
		const exitCode = await proc.exited;
		if (exitCode !== 0) return null;
		const output = await new Response(proc.stdout).text();
		return output.trim() || null;
	} catch {
		return null;
	}
}

export function loadConfig(overrides?: Partial<Config>): Config {
	const raw = {
		claudePath: process.env.CLAUDE_PATH,
		codexPath: process.env.CODEX_PATH,
		defaultAutonomyLevel: parseIntOr(process.env.DEFAULT_AUTONOMY_LEVEL, 1),
		logLevel: process.env.LOG_LEVEL ?? "info",
		...overrides,
	};

	const result = ConfigSchema.safeParse(raw);
	if (!result.success) {
		const errors = result.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`);
		throw new Error(`Invalid configuration:\n${errors.join("\n")}`);
	}

	_config = result.data;
	return _config;
}

export function getConfig(): Config {
	if (!_config) {
		throw new Error("Config not loaded. Call loadConfig() first.");
	}
	return _config;
}

/** Get detected CLIs (must call detectCLIs first) */
export function getCLIs(): DetectedCLIs {
	if (!_detectedCLIs) {
		throw new Error("CLIs not detected. Call detectCLIs() first.");
	}
	return _detectedCLIs;
}

function parseIntOr(value: string | undefined, fallback: number): number {
	if (value === undefined) return fallback;
	const parsed = Number.parseInt(value, 10);
	return Number.isNaN(parsed) ? fallback : parsed;
}
