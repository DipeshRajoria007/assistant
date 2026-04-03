# Assistant (Archived)

> **Status: Scrapped.** This project was an attempt to build a Jarvis-like autonomous personal AI assistant for macOS from scratch. It was abandoned after one session because the architecture was over-engineered and the core experience was fundamentally slow.

---

## What This Was

An autonomous personal AI assistant for macOS — like Jarvis from Iron Man. Security-first, cost-efficient, built from scratch as an alternative to [OpenClaw](https://github.com/openclaw/openclaw).

The thesis: OpenClaw proved massive demand (250k+ GitHub stars in 2026) but had critical security flaws (824+ malicious skills, 6 CVEs), absurd costs ($300-750/month), and stability issues (13 breaking releases in one month). We could build something better.

## What We Built

Built in a single session with Claude Code (Opus 4.6). The codebase reached:

- **139 passing tests** across 13 test files
- **6 merged PRs** to main
- TypeScript strict mode, Biome linting, full quality gate
- ~4,500 lines of code across 32 files

### Completed Features

| # | Feature | PR | What It Did |
|---|---------|-----|-------------|
| 1 | CLI chat mode | [#1](https://github.com/DipeshRajoria007/assistant/pull/1) | Interactive REPL with commands (/help, /status, /voice, /speak), colored output |
| 2 | Global hotkey | [#2](https://github.com/DipeshRajoria007/assistant/pull/2) | Swift binary monitoring Ctrl+Space globally, activates terminal from anywhere |
| 3 | Voice input | [#3](https://github.com/DipeshRajoria007/assistant/pull/3), [#5](https://github.com/DipeshRajoria007/assistant/pull/5) | Swift SFSpeechRecognizer + ffmpeg fallback for speech-to-text |
| 4 | Voice output | [#4](https://github.com/DipeshRajoria007/assistant/pull/4) | macOS `say` TTS with markdown stripping, /speak toggle |
| 5 | Streaming responses | [#6](https://github.com/DipeshRajoria007/assistant/pull/6) | Real-time token streaming via Claude CLI stream-json output |

### Completed Infrastructure

- **Agent loop** — perception/reasoning/action cycle with conversation management
- **Model router** — routes tasks to Claude Code CLI or Codex CLI by complexity (triage/simple/complex/code)
- **Safety gate** — classifies actions into 5 safety levels (SAFE → BLOCKED), graduated approval, blocks dangerous commands like `sudo rm -rf /`
- **Shell executor** — runs commands via Bun.spawn with timeout, output truncation, safety pre-check
- **Memory store** — SQLite schema for knowledge, episodes, and goals (never got to actually using it)
- **Audit log** — immutable action history (schema only, never wired in)
- **Context assembler** — builds minimal LLM prompts from context (never received real context)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Bun 1.3.11 + TypeScript (strict) |
| macOS Native | Swift 6.2.3 (hotkey daemon, voice binary) |
| Storage | SQLite via bun:sqlite |
| LLM | Claude Code CLI (`claude -p`) + Codex CLI (`codex exec`) |
| Lint | Biome |
| Tests | Bun built-in test runner |

## Why It Was Scrapped

### The Core Problem: Latency

The project was designed around shelling out to the Claude Code CLI (`claude -p "message"`) and Codex CLI (`codex exec "message"`) instead of using API keys directly. This was a deliberate choice — the user had Pro subscriptions to both but no standalone API keys.

**The result: every single message took 5-6 seconds.**

- ~3-4 seconds: Claude CLI startup (Node.js init, hook execution, MCP server connections, auth)
- ~2 seconds: actual API call

For a "Jarvis" experience, you need sub-second responses. 5-6 seconds makes the assistant feel dead. Streaming (PR #6) helped — text starts appearing at ~2-3 seconds — but the fundamental startup overhead per message was unavoidable without an API key.

We investigated alternatives:
- **`--bare` mode**: Disables hooks/MCP but requires `ANTHROPIC_API_KEY` (which we didn't have)
- **Persistent session via `--input-format stream-json`**: The stream-json input format didn't process messages — only hooks ran, no responses were generated
- **MCP server mode (`claude mcp serve`)**: Exposes Claude Code's tools (Bash, Read, Edit) but not a chat/query interface
- **Session resume (`--resume`)**: Still incurs full CLI startup overhead each time

None of these solved the fundamental problem.

### The Secondary Problem: Over-Engineering

We spent the session building infrastructure instead of a working product:

- Safety gate with 5 trust levels, 20+ blocked command patterns, and an approval matrix — before we could even send a message
- Zod schema validation for configs — before we had anything to configure
- 139 tests — for features the user never actually experienced
- PR ceremony for every feature — 6 PRs in one session for what should have been rapid prototyping
- Type definitions for 4 executor types (shell, AppleScript, accessibility, vision) — only shell was ever built

The right approach would have been: one file, 200 lines, that does something impressive. Instead we built a framework.

### The Tertiary Problem: Voice Was Broken

- The Swift SFSpeechRecognizer binary crashed (SIGABRT) in CLI environments because macOS TCC won't grant mic/speech permissions to unbundled executables
- The ffmpeg fallback worked but required recording 10 seconds of audio, saving to disk, then spawning Claude CLI to transcribe — adding 15+ seconds to every voice interaction
- Neither approach was remotely "real-time"

## What Would Have Worked Better

1. **Get an API key.** Even $5 of Anthropic credit would have eliminated the latency problem entirely. Direct API calls return first tokens in ~500ms.

2. **Build lean, not correct.** One TypeScript file. No types, no tests, no safety gates. Just: detect active app via AppleScript, read git status, read clipboard, send to Claude API, stream response. Get to the "wow" moment first, then add structure.

3. **Use existing tools as building blocks.** Instead of building a CLI from scratch, extend Claude Code itself via hooks/skills/MCP servers. The infrastructure is already there.

## Lessons Learned

- **Latency is the product.** For an interactive assistant, response time matters more than architecture, safety, or test coverage. A fast, unsafe prototype beats a slow, correct framework.
- **CLI wrappers add latency, not value.** Shelling out to `claude -p` per message is fundamentally wrong for real-time use. You need a persistent connection or direct API access.
- **Don't build the framework before the demo.** 139 tests for a product no one could use. The safety gate was perfect; the experience was terrible.
- **Over-engineering is a trap when vibing.** TDD, strict TypeScript, Biome linting, PR-per-feature — all good practices, but not for a single-session prototype where the goal is to *feel* something working.

## Project Structure (Final State)

```
src/
├── cli/
│   ├── formatter.ts        # CLI commands, colors, response formatting
│   ├── speech.ts           # macOS TTS via say command
│   └── voice.ts            # Voice input (Swift + ffmpeg fallback)
├── core/
│   ├── agent-loop.ts       # Main conversation loop
│   ├── config.ts           # Config + CLI auto-detection
│   ├── logger.ts           # Structured logging
│   └── model-router.ts     # Routes to Claude/Codex CLI with streaming
├── actions/
│   ├── executor.ts         # Action dispatch
│   ├── executors/shell.ts  # Shell command execution
│   ├── safety-gate.ts      # Action classification + approval
│   └── audit-log.ts        # Immutable action history
├── memory/store.ts         # SQLite: knowledge, episodes, goals
├── context/assembler.ts    # Context → prompt assembly
├── types/                  # TypeScript type definitions
└── index.ts                # Entry point / REPL

macos/
├── hotkey-daemon.swift     # Global Ctrl+Space hotkey
├── voice-input.swift       # SFSpeechRecognizer STT
├── build.sh                # Compile Swift binaries
├── install.sh              # Register LaunchAgent
└── uninstall.sh            # Remove LaunchAgent

tests/                      # 139 tests across 13 files
```

## License

MIT
