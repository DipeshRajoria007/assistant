import { describe, expect, test } from "bun:test";
import { parseCommand } from "../../src/cli/formatter.js";
import { cleanTextForSpeech, isSayAvailable } from "../../src/cli/speech.js";

describe("speech output", () => {
	test("/speak command is parsed correctly", () => {
		const cmd = parseCommand("/speak");
		expect(cmd.type).toBe("speak");
	});

	test("/speak shortcut /sp is parsed correctly", () => {
		const cmd = parseCommand("/sp");
		expect(cmd.type).toBe("speak");
	});

	test("isSayAvailable detects macOS say command", async () => {
		const available = await isSayAvailable();
		// On macOS, say is always available
		expect(available).toBe(true);
	});

	describe("cleanTextForSpeech", () => {
		test("strips ANSI escape codes", () => {
			const input = "\x1b[32mHello\x1b[0m world";
			expect(cleanTextForSpeech(input)).toBe("Hello world");
		});

		test("strips markdown bold/italic", () => {
			expect(cleanTextForSpeech("**bold** text")).toBe("bold text");
			expect(cleanTextForSpeech("*italic* text")).toBe("italic text");
			expect(cleanTextForSpeech("__bold__ text")).toBe("bold text");
		});

		test("strips markdown code blocks", () => {
			const input = "Here is code:\n```js\nconsole.log('hi')\n```\nDone.";
			const result = cleanTextForSpeech(input);
			expect(result).not.toContain("```");
			expect(result).toContain("Done.");
		});

		test("strips inline code backticks", () => {
			expect(cleanTextForSpeech("Run `npm install` now")).toBe("Run npm install now");
		});

		test("strips markdown headers", () => {
			expect(cleanTextForSpeech("## Section Title")).toBe("Section Title");
			expect(cleanTextForSpeech("### Another")).toBe("Another");
		});

		test("strips markdown links but keeps text", () => {
			expect(cleanTextForSpeech("Click [here](https://example.com)")).toBe("Click here");
		});

		test("strips bullet markers", () => {
			expect(cleanTextForSpeech("- item one\n- item two")).toBe("item one\nitem two");
			expect(cleanTextForSpeech("* item one")).toBe("item one");
		});

		test("collapses multiple newlines", () => {
			expect(cleanTextForSpeech("Hello\n\n\n\nWorld")).toBe("Hello\n\nWorld");
		});

		test("trims whitespace", () => {
			expect(cleanTextForSpeech("  hello  ")).toBe("hello");
		});

		test("handles empty string", () => {
			expect(cleanTextForSpeech("")).toBe("");
		});
	});
});
