import { z } from "zod";

const ConfigSchema = z.object({
	anthropicApiKey: z.string().min(1).optional(),
	openaiApiKey: z.string().min(1).optional(),
	ollamaBaseUrl: z.string().url().optional(),
	defaultAutonomyLevel: z.number().int().min(0).max(4).default(1),
	embeddingProvider: z.enum(["anthropic", "openai", "ollama"]).default("anthropic"),
	dbPath: z.string().default("data/assistant.db"),
	socketPath: z.string().default("/tmp/assistant.sock"),
	logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
	maxContextTokens: z.number().int().positive().default(8000),
	modelRouting: z
		.object({
			triage: z.string().default("claude-haiku-4-5-20251001"),
			simple: z.string().default("claude-sonnet-4-6-20260320"),
			complex: z.string().default("claude-opus-4-6-20260320"),
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

let _config: Config | null = null;

export function loadConfig(overrides?: Partial<Config>): Config {
	const raw = {
		anthropicApiKey: process.env.ANTHROPIC_API_KEY,
		openaiApiKey: process.env.OPENAI_API_KEY,
		ollamaBaseUrl: process.env.OLLAMA_BASE_URL,
		defaultAutonomyLevel: parseIntOr(process.env.DEFAULT_AUTONOMY_LEVEL, 1),
		embeddingProvider: process.env.EMBEDDING_PROVIDER ?? "anthropic",
		logLevel: process.env.LOG_LEVEL ?? "info",
		...overrides,
	};

	const result = ConfigSchema.safeParse(raw);
	if (!result.success) {
		const errors = result.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`);
		throw new Error(`Invalid configuration:\n${errors.join("\n")}`);
	}

	// Require at least one LLM provider
	if (!result.data.anthropicApiKey && !result.data.openaiApiKey && !result.data.ollamaBaseUrl) {
		throw new Error(
			"At least one LLM provider must be configured (ANTHROPIC_API_KEY, OPENAI_API_KEY, or OLLAMA_BASE_URL)",
		);
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

function parseIntOr(value: string | undefined, fallback: number): number {
	if (value === undefined) return fallback;
	const parsed = Number.parseInt(value, 10);
	return Number.isNaN(parsed) ? fallback : parsed;
}
