# Assistant — Autonomous Personal AI for macOS

## What Is This?

A Jarvis-like autonomous personal assistant. Security-first, cost-efficient, production-grade.
Built with Bun + TypeScript (core), Swift (macOS native layer), Deno (skill sandboxing).

## Architecture

```
Swift (menu bar + OS APIs) ←→ Unix Socket ←→ Bun (agent core) ←→ LLM APIs
                                                  ↕
                                            SQLite + sqlite-vec
```

Three execution layers for macOS control (cascade):
1. Structured: APIs, AppleScript, shell commands (fast, reliable)
2. Accessibility: AX tree navigation + CGEvent (medium, universal)
3. Vision: Screenshot + vision model + coordinate click (slow, fallback)

## Development Rules

- **NEVER commit without `bun run check` passing** (typecheck + lint + test + build)
- **EVERY feature starts with a test file first** (TDD)
- Run tests after EVERY code change, not just at the end
- Use the model router — never hardcode a specific LLM provider
- All external skills run in Deno sandbox — no exceptions
- No mocks for cross-layer integration tests — test real boundaries
- TypeScript strict mode is non-negotiable — fix type errors, don't suppress them
- No `any` types — use `unknown` and narrow with type guards
- No `console.log` in production code — use the structured logger

## Commands

```bash
bun run check       # Full quality gate: typecheck → lint → test → build
bun run dev         # Start daemon in dev mode with watch
bun run start       # Start daemon in production mode
bun run build       # Build for distribution
bun run typecheck   # TypeScript type checking (tsc --noEmit)
bun run lint        # Biome lint + format check
bun run lint:fix    # Auto-fix lint and format issues
bun run test        # Run all tests
bun run test:unit   # Run unit tests only
bun run test:int    # Run integration tests only
```

## Project Structure

```
src/
├── index.ts              # Entry point — daemon startup
├── core/
│   ├── agent-loop.ts     # Main perception → reasoning → action cycle
│   ├── model-router.ts   # Routes to Haiku/Sonnet/Opus/local based on task
│   ├── task-planner.ts   # Breaks complex tasks into executable steps
│   └── config.ts         # Configuration management via env + defaults
├── memory/
│   ├── store.ts          # SQLite + sqlite-vec wrapper
│   ├── knowledge.ts      # Semantic knowledge about the user
│   ├── episodes.ts       # Timestamped event log
│   └── goals.ts          # Persistent goal tracking
├── context/
│   ├── assembler.ts      # Fuses all context into minimal LLM prompt
│   ├── screen.ts         # Screen context (via Swift IPC)
│   ├── calendar.ts       # Calendar events
│   ├── git.ts            # Git repository state
│   └── files.ts          # Active file tracking
├── actions/
│   ├── router.ts         # Picks execution method per action
│   ├── safety-gate.ts    # Action classification + approval
│   ├── audit-log.ts      # Immutable action history
│   ├── undo-stack.ts     # Reversible action tracking
│   └── executors/
│       ├── shell.ts      # Shell command execution
│       ├── applescript.ts # JXA/AppleScript
│       ├── accessibility.ts # AX tree (via Swift bridge)
│       └── vision.ts     # Screenshot + vision model
├── skills/
│   ├── registry.ts       # Skill discovery and loading
│   ├── sandbox.ts        # Deno subprocess sandboxing
│   └── manifest.ts       # Skill manifest parser + validator
├── ipc/
│   ├── server.ts         # Unix domain socket server
│   └── protocol.ts       # Message encoding/decoding
└── types/
    ├── action.ts         # Action types and safety levels
    ├── context.ts        # Context types
    ├── memory.ts         # Memory types
    └── skill.ts          # Skill manifest types

tests/
├── unit/                 # Fast, isolated tests
├── integration/          # Cross-module tests
└── setup.ts              # Shared test utilities
```

## Key Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Runtime | Bun | 2x faster, half memory vs Node.js |
| Language | TypeScript strict | Catch bugs at compile time |
| DB | SQLite + sqlite-vec | Zero-config, single file, vector search |
| Lint | Biome | 25x faster than ESLint, single tool |
| Test | Bun test (built-in) | Native, fast, zero-config |
| macOS UI | Swift + SwiftUI | Native, 30MB RAM, full OS APIs |
| Skill sandbox | Deno subprocesses | Built-in permission model |
| LLM | Multi-provider | Route by task complexity for cost |
| IPC | Unix domain socket | Local only, low latency |

## Safety Levels

Actions are classified into safety levels:
- **SAFE (0)**: Read-only operations — auto-approve
- **LOW (1)**: Open apps, type in fields — auto with logging
- **MEDIUM (2)**: Send messages, modify files — show plan, countdown to cancel
- **HIGH (3)**: Delete files, send emails, financial — explicit approval required
- **BLOCKED (4)**: Admin/sudo, keychain, disable security — always blocked

## Model Routing

- **Haiku**: Triage, classification, event filtering ($0.25/M tokens)
- **Sonnet**: Simple tasks, quick code, summaries ($3/M tokens)
- **Opus**: Complex reasoning, planning, multi-step ($15/M tokens)
- **Local (Ollama)**: Sensitive context that shouldn't leave device (free)
