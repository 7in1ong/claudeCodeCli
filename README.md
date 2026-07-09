# Claude Code CLI

An interactive command-line AI coding assistant powered by [Anthropic Claude](https://www.anthropic.com/). Chat with Claude directly in your terminal, and let it read/write files, execute shell commands, and browse your project — all through natural conversation.

## Features

- **Multi-turn conversation** — maintain context across an entire coding session
- **Agentic tool use** — Claude can read files, write files, run shell commands, and list directories on your behalf
- **Streaming responses** — see tokens appear in real time as Claude generates its reply
- **Permission confirmation** — mutating operations (file writes, shell commands) prompt for approval before running; skip with `--yes`
- **Context window management** — automatic truncation of old messages when the conversation grows too long
- **Automatic retries** — transient API errors (rate limits, server errors) are retried with exponential backoff
- **Interactive REPL** — multi-line input, slash commands, and graceful exit
- **One-shot mode** — pipe a single question and get an answer without entering the REPL
- **Mock mode** — the CLI starts even without an API key, so you can verify the UI

## Installation

```bash
# Clone the repository
git clone https://github.com/7in1ong/claudeCodeCli.git
cd claudeCodeCli

# Install dependencies
npm install

# Build (optional — you can also use `npm run dev`)
npm run build
```

## Configuration

The CLI needs an Anthropic API key to communicate with Claude. Set it via environment variable or the `--api-key` flag:

```bash
# Option 1: environment variable (recommended)
export ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxx

# Option 2: inline flag
claude-code --api-key sk-ant-xxxxxxxxxxxx "hello"
```

Get an API key at [https://console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys).

## Usage

### Interactive REPL

```bash
# Using npm scripts
npm run dev

# Or after building
npm start

# Or directly with tsx
npx tsx src/cli/index.ts
```

You'll see a prompt where you can type messages:

```
> help me write a function that reverses a string
```

Claude will respond, and may use tools (read files, run commands) to help you. Each tool action is displayed and requires confirmation (unless `--yes` is passed).

### One-shot mode

Send a single question and exit:

```bash
npm run dev -- -m "explain how async/await works in JavaScript"

# Or with positional argument
npm run dev -- "what's the difference between let and const?"
```

### CLI Options

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--model <model>` | | Model to use | `claude-sonnet-4-20250514` |
| `--api-key <key>` | | Anthropic API key | `ANTHROPIC_API_KEY` env var |
| `--message <msg>` | `-m` | Send a single message and exit | — |
| `--yes` | `-y` | Auto-approve tool actions (skip confirmation) | `false` |
| `--help` | | Show help message | — |

### REPL Commands

| Command | Description |
|---------|-------------|
| `/clear` | Reset conversation history |
| `/help` | Show REPL help |
| `exit`, `quit`, `:q` | Exit the REPL |
| Ctrl+C | Graceful exit |
| Ctrl+D | EOF exit |

### Multi-line Input

End a line with `\` to continue on the next line. Enter `.` on its own line to finish:

```
> write a function that \
... takes two numbers and \
... returns their sum
.
```

## Available Tools

Claude can use the following tools during a conversation:

| Tool | Description | Requires Confirmation |
|------|-------------|:---------------------:|
| `read_file` | Read file contents with line numbers | No |
| `list_files` | List directory contents (supports glob patterns) | No |
| `write_file` | Create or overwrite a file | **Yes** |
| `bash` | Execute a shell command | **Yes** |

Tools that modify the filesystem or execute arbitrary commands will prompt you for confirmation before running. Pass `--yes` to skip all prompts (useful in CI or scripting).

### Example: Tool in Action

```
> list all TypeScript files in src/

  [Tool] list_files — executing...
  Allow? (y/n) y

  [Tool Result] [3 entries in "./src" matching "*.ts"]
  ...
```

## Architecture

```
src/
├── cli/
│   ├── index.ts        # Entry point (#!/usr/bin/env node)
│   ├── runner.ts       # CLI orchestration, REPL, agentic loop
│   └── confirm.ts      # Permission confirmation handler
├── llm/
│   ├── client.ts       # Anthropic SDK wrapper
│   ├── stream.ts       # Streaming response handler with retries
│   ├── conversation.ts # Multi-turn context manager
│   └── types.ts        # Type definitions
├── tools/
│   ├── base.ts         # Abstract tool base class
│   ├── registry.ts     # Tool registry and discovery
│   ├── executor.ts     # Tool dispatch with confirmation gate
│   ├── read-file.ts    # read_file tool
│   ├── write-file.ts   # write_file tool
│   ├── bash-tool.ts    # bash tool
│   └── list-files.ts   # list_files tool
└── utils/
    └── index.ts        # Shared utilities
```

### Agentic Loop

The core conversation flow in `runner.ts`:

```
User input
  → ConversationManager.addUserMessage()
  → streamMessage() to Claude API
  → Stream text tokens to terminal
  → If Claude calls tools:
      → ConfirmationHandler prompts user (if required)
      → ToolExecutor runs each tool
      → Results fed back to ConversationManager
      → Loop: streamMessage() again with tool results
  → Repeat until Claude stops calling tools
```

## Troubleshooting

### "ANTHROPIC_API_KEY environment variable is not set"

Set the environment variable or pass `--api-key`:

```bash
export ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxx
# or
claude-code --api-key sk-ant-xxxxxxxxxxxx
```

### "Authentication failed: your API key is invalid or expired"

Your API key may be incorrect. Verify it at [https://console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys).

### "Cannot connect to the Anthropic API"

Check your internet connection. If behind a corporate proxy:

```bash
export HTTPS_PROXY=http://proxy.example.com:8080
```

### "Rate limit exceeded"

The CLI auto-retries on rate limits with exponential backoff. If it persists, wait a minute and try again, or check your API usage limits.

### "Connection timed out"

Check your network connection. If using a slow or unreliable connection, the built-in retry logic should handle transient timeouts automatically.

## Development

```bash
# Run tests
npm test

# Watch mode for tests
npm run test:watch

# Lint
npm run lint
npm run lint:fix

# Build
npm run build
```

## License

MIT
