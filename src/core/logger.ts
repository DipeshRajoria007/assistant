type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
};

let currentLevel: LogLevel = "info";

export function setLogLevel(level: LogLevel): void {
	currentLevel = level;
}

function shouldLog(level: LogLevel): boolean {
	return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function formatMessage(level: LogLevel, module: string, message: string): string {
	const timestamp = new Date().toISOString();
	return `[${timestamp}] [${level.toUpperCase()}] [${module}] ${message}`;
}

export function createLogger(module: string) {
	return {
		debug(message: string, data?: Record<string, unknown>) {
			if (shouldLog("debug")) {
				const msg = formatMessage("debug", module, message);
				if (data) {
					process.stderr.write(`${msg} ${JSON.stringify(data)}\n`);
				} else {
					process.stderr.write(`${msg}\n`);
				}
			}
		},
		info(message: string, data?: Record<string, unknown>) {
			if (shouldLog("info")) {
				const msg = formatMessage("info", module, message);
				if (data) {
					process.stderr.write(`${msg} ${JSON.stringify(data)}\n`);
				} else {
					process.stderr.write(`${msg}\n`);
				}
			}
		},
		warn(message: string, data?: Record<string, unknown>) {
			if (shouldLog("warn")) {
				const msg = formatMessage("warn", module, message);
				if (data) {
					process.stderr.write(`${msg} ${JSON.stringify(data)}\n`);
				} else {
					process.stderr.write(`${msg}\n`);
				}
			}
		},
		error(message: string, error?: unknown) {
			if (shouldLog("error")) {
				const msg = formatMessage("error", module, message);
				if (error instanceof Error) {
					process.stderr.write(`${msg} ${error.message}\n${error.stack ?? ""}\n`);
				} else if (error) {
					process.stderr.write(`${msg} ${JSON.stringify(error)}\n`);
				} else {
					process.stderr.write(`${msg}\n`);
				}
			}
		},
	};
}
