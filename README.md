# yyp-cli

A personal CLI tool.

## Installation

```bash
npx yyp-cli@latest uptime
```

install globally:

```bash
npm install -g yyp-cli
```

## Usage

```bash
yyp <command> [options]
```

### `yyp uptime`

Show system boot time and uptime.

```bash
yyp uptime
```

Output:

```
  Boot time  2026-03-20 10:30:00
  Uptime     35d 18h 12m 54s
```

Options:

| Flag | Description |
|------|-------------|
| `--json` | Output as JSON |

```bash
yyp uptime --json
```

```json
{
  "bootTime": "2026-03-20T02:30:00.000Z",
  "days": 35,
  "hours": 18,
  "minutes": 12,
  "seconds": 54
}
```

### `yyp sys`

Show a hardware overview: CPU, GPU, memory, system disk and uptime.

```bash
yyp sys
```

Output:

```
  yyp-mbp · macOS 26.1 · up 4d 4h 24m
  ──────────────────────────────────────────────────────────────────
  cpu     [■■■■■■■■■■■■■■■■■■■■■■■■]  20.6%  load 4.85 / 10 cores
  memory  [■■■■■■■■■■■■■■■■■■■■■■■■]  83.1%  13.3 GiB / 16.0 GiB · swap 12.1 GiB
  disk    [■■■■■■■■■■■■■■■■■■■■■■■■]  76.5%  352.3 GiB / 460.4 GiB
  ──────────────────────────────────────────────────────────────────
  CPU     Apple M2 Pro · 10 cores (6P + 4E) · arm64
  GPU     Apple M2 Pro · 16 cores · Metal 4
```

- Bars turn yellow at 60% and red at 85%.
- `load` is the 1-minute load average: the average number of tasks running or waiting for the CPU. Compare it with the core count — above it means tasks are queuing.
- `swap` is memory paged out to disk when RAM runs short.

Subcommands:

| Command | Description |
|---------|-------------|
| `yyp sys cpu` | CPU details and per-core usage |
| `yyp sys gpu` | GPU details (VRAM / utilization via `nvidia-smi` when available) |
| `yyp sys mem` | Memory and swap usage |
| `yyp sys disk` | Usage of all mounted disks |

All of them accept `--json`:

```bash
yyp sys --json
yyp sys disk --json
```

## Requirements

Node.js >= 22.13

## Development

```bash
pnpm install
pnpm run build       # build once
pnpm run dev         # watch mode
pnpm run typecheck   # type check
pnpm run preview     # preview command output with fake data (or: pnpm preview sys)
```

## License

MIT
