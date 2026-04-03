import { loadConfig } from "../src/core/config.js";
import { setLogLevel } from "../src/core/logger.js";

/** Initialize test environment with mock config */
export function setupTestConfig(overrides?: Record<string, unknown>): void {
	loadConfig({
		defaultAutonomyLevel: 2,
		dbPath: ":memory:",
		logLevel: "error",
		...overrides,
	});
	setLogLevel("error");
}
