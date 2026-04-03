# Assistant

**An autonomous personal AI assistant for macOS — like Jarvis, built from scratch.**

Security-first. Cost-efficient. Production-grade. No API keys needed.

```
You:     "What am I working on?"
Jarvis:  "You're in VS Code editing agent-loop.ts on branch feat/memory.
          You have 3 uncommitted changes. Design Review starts in 25 min."

You:     "Message the team I'll be 5 minutes late"
Jarvis:  [Opens Slack → sends message → confirms]
         "Done. Sent to #team."
```

## Why Not OpenClaw?

[OpenClaw](https://github.com/openclaw/openclaw) proved the demand (250k+ GitHub stars) but has critical issues:

| Problem | OpenClaw | Assistant |
|---------|----------|-----------|
| Cost | $300-750/month API bills | **$0** — uses your existing Claude Code + Codex CLI |
| Security | 824+ malicious skills, 6 CVEs | Sandboxed execution, graduated trust, audit log |
| Memory | 1-3M tokens/session, forgets between chats | Smart context pruning, persistent memory |
| Stability | 13 releases/month, each breaks something | Strict TypeScript, 92 tests, quality gate |
| Setup | Hours of configuration | Works out of the box |

## How It Works

```
┌─────────────────────────────────────────────────────────┐
│  YOU (voice / hotkey / terminal)                         │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│  CONTEXT ENGINE                                          │
│  Active app · Git state · Calendar · Clipboard · Files   │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│  BRAIN (Agent Loop)                                      │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ Model Router │  │ Memory Store │  │ Safety Gate   │  │
│  │ Claude ↔     │  │ Knowledge    │  │ Classify      │  │
│  │ Codex CLI    │  │ Episodes     │  │ Approve/Block │  │
│  │              │  │ Goals        │  │ Audit log     │  │
│  └──────────────┘  └──────────────┘  └───────────────┘  │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│  ACTION LAYER                                            │
│  Shell · AppleScript · Accessibility · Vision · APIs     │
└─────────────────────────────────────────────────────────┘
```

**No API keys required.** Routes tasks to your installed CLIs:

| Task Type | CLI | Example |
|-----------|-----|---------|
| Reasoning | `claude -p` | "Plan the API migration" |
| Simple | `claude -p` | "What's on my calendar?" |
| Code | `codex exec` | "Write a sort function" |

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Runtime | **Bun** + TypeScript (strict) | 2x faster than Node, half memory, built-in SQLite |
| macOS UI | **Swift** + SwiftUI | Native menu bar, 30MB RAM, full OS API access |
| Storage | **SQLite** (bun:sqlite) | Zero config, single file, vector search ready |
| Skill Sandbox | **Deno** subprocesses | Built-in permission model per skill |
| LLM | **Claude Code** + **Codex CLI** | No API keys — uses your existing subscriptions |
| Lint | **Biome** | 25x faster than ESLint |
| Tests | **Bun test** (built-in) | Native, fast, zero config |

## Quick Start

```bash
# Prerequisites: Bun, Claude Code CLI, Codex CLI
bun install
bun run dev
```

## Development

```bash
bun run check       # Full quality gate: typecheck → lint → test → build
bun run dev         # Start daemon in dev mode with watch
bun run test        # Run all tests
bun run typecheck   # TypeScript strict checking
bun run lint        # Biome lint + format check
bun run build       # Build for distribution
```

**Development rules:** TDD, strict TypeScript, `bun run check` must pass before every commit. See [CLAUDE.md](CLAUDE.md) for full development guidelines.

## Project Structure

```
src/
├── index.ts                    # Entry point — daemon startup
├── core/
│   ├── agent-loop.ts           # Perception → Reasoning → Action cycle
│   ├── model-router.ts         # Routes to Claude/Codex CLI by task type
│   ├── config.ts               # Config + CLI auto-detection
│   └── logger.ts               # Structured logging
├── memory/
│   └── store.ts                # SQLite: knowledge, episodes, goals
├── context/
│   └── assembler.ts            # Fuses context into minimal LLM prompt
├── actions/
│   ├── safety-gate.ts          # Action classification + approval
│   ├── audit-log.ts            # Immutable action history
│   ├── executor.ts             # Dispatches to appropriate executor
│   └── executors/
│       └── shell.ts            # Shell command execution
├── skills/                     # (planned) Deno-sandboxed plugins
├── ipc/                        # (planned) Unix socket server
└── types/                      # TypeScript type definitions

tests/
├── unit/                       # 85+ unit tests
└── integration/                # End-to-end executor tests

macos/                          # (planned) Swift menu bar app
```

---

## Roadmap

### Phase 1: Make It Usable — *"Talk To It"*

> Goal: You can invoke the assistant and get intelligent responses.

| # | Feature | Description | Status |
|---|---------|-------------|--------|
| 1 | CLI chat mode | Interactive REPL with commands, colors, safety display | ✅ Done |
| 2 | Global hotkey invoke | Ctrl+Space from anywhere activates assistant | ✅ Done |
| 3 | Voice input | Push-to-talk with on-device Apple Speech Recognition | ✅ Done |
| 4 | Voice output | Speaks responses via macOS `say` / TTS | ⬜ Planned |

### Phase 2: Give It Eyes — *"Know What I'm Doing"*

> Goal: The assistant understands your current context without you telling it.

| # | Feature | Description | Status |
|---|---------|-------------|--------|
| 5 | Active app detector | Knows which app is in focus (VS Code, Safari, Slack) | ⬜ Planned |
| 6 | Active file/URL tracker | Current file in editor, current URL in browser | ⬜ Planned |
| 7 | Git state awareness | Branch, dirty files, recent commits, unpushed changes | ⬜ Planned |
| 8 | Calendar integration | Upcoming events from macOS Calendar | ⬜ Planned |
| 9 | Clipboard awareness | Knows what you just copied | ⬜ Planned |

### Phase 3: Give It Hands — *"Do Things On My Mac"*

> Goal: The assistant can control your Mac — open apps, send messages, manage files.

| # | Feature | Description | Status |
|---|---------|-------------|--------|
| 10 | AppleScript executor | Run AppleScript/JXA to control any app | ⬜ Planned |
| 11 | App launcher/switcher | Open, activate, close any application | ⬜ Planned |
| 12 | Notification sender | Push native macOS notifications | ⬜ Planned |
| 13 | File operations | Create, move, find files via Spotlight | ⬜ Planned |
| 14 | Browser control | Open URLs, read current tab info | ⬜ Planned |

### Phase 4: Give It Memory — *"Know Who I Am"*

> Goal: The assistant learns about you and maintains context across sessions.

| # | Feature | Description | Status |
|---|---------|-------------|--------|
| 15 | Auto-learn from conversations | Extracts preferences/knowledge and persists them | ⬜ Planned |
| 16 | Goal tracking | Persistent multi-day goals that survive across sessions | ⬜ Planned |
| 17 | Session history | Records what happened each session as episodes | ⬜ Planned |
| 18 | Context injection | Auto-prepends relevant memory + context to every LLM call | ⬜ Planned |

### Phase 5: Make It Alive — *"Always-On + Proactive"*

> Goal: The assistant runs in the background, monitors your world, and acts proactively.

| # | Feature | Description | Status |
|---|---------|-------------|--------|
| 19 | Background daemon | Runs as macOS LaunchAgent — always on | ⬜ Planned |
| 20 | Event-driven wake | Reacts to app switches, file saves, calendar alerts | ⬜ Planned |
| 21 | Proactive alerts | "Meeting in 10 min" / "Build failed" / "PR needs review" | ⬜ Planned |
| 22 | IPC server | Unix socket so CLI, menu bar, and voice can all connect | ⬜ Planned |

### Foundation (Complete)

| Feature | Status |
|---------|--------|
| Agent loop (perception → reasoning → action) | ✅ Done |
| Model router (Claude + Codex CLI, routes by task type) | ✅ Done |
| Safety gate (classifies, approves/blocks, graduated trust) | ✅ Done |
| Shell executor (runs commands, timeout, output truncation) | ✅ Done |
| Memory store (SQLite: knowledge, episodes, goals) | ✅ Done |
| Audit log (immutable action history) | ✅ Done |
| Context assembler (fuses context into prompts) | ✅ Done |
| 92 tests, TypeScript strict, Biome lint, quality gate | ✅ Done |

---

## Build Plan

```
WEEK 1 — Can Talk To It + Basic Context
├── Polish CLI chat mode (#1)
├── Active app detector (#5) — AppleScript one-liner
├── Git state awareness (#7) — shell out to git
├── Clipboard awareness (#9) — pbpaste
├── AppleScript executor (#10)
└── App launcher/switcher (#11)

WEEK 2 — Full Context + Mac Control
├── Active file/URL tracker (#6)
├── Calendar integration (#8)
├── File operations (#13)
├── Browser control (#14)
├── Context injection into prompts (#18)
└── Notification sender (#12)

WEEK 3 — Persistent Memory + Voice
├── Auto-learn from conversations (#15)
├── Goal tracking (#16)
├── Session history (#17)
└── Voice output via macOS say (#4)

WEEK 4 — Always-On Daemon
├── Background daemon as LaunchAgent (#19)
├── IPC server — Unix socket (#22)
├── Event-driven wake (#20)
├── Proactive alerts (#21)
├── Global hotkey (#2)
└── Voice input (#3)
```

### The "It's Jarvis" Moment — End of Week 2

After weeks 1-2, you'll be able to:

```
You:     "Hey, what am I working on?"
Jarvis:  "You're in VS Code editing agent-loop.ts on branch feat/memory.
          3 uncommitted changes. Design Review starts in 25 min."

You:     "Open Slack and tell the team I'll be 5 min late"
Jarvis:  [Opens Slack → navigates → types → sends]
         "Done. Sent to #team."

You:     "What did I just copy?"
Jarvis:  "A GitHub URL: github.com/DipeshRajoria007/assistant/pull/3.
          Want me to open it?"
```

## Safety Model

Every action goes through the safety gate before execution:

| Level | Actions | Approval |
|-------|---------|----------|
| **SAFE** | Read screen, list files, check git | Auto-approve |
| **LOW** | Open apps, type in fields | Auto + logged |
| **MEDIUM** | Send messages, modify files | 5s countdown to cancel |
| **HIGH** | Delete files, send emails | Explicit approval required |
| **BLOCKED** | sudo, keychain, disable security | Always blocked |

Full audit trail of every action. Undo support for reversible operations.

## License

MIT

## Contributing

This project is built autonomously with Claude Code. To contribute:

1. Fork the repo
2. Create a feature branch
3. Ensure `bun run check` passes (typecheck + lint + test + build)
4. Open a PR

Every feature must include tests. No exceptions.
