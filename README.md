# yyp-cli

A personal CLI tool.

## Installation

```bash
pnpm link --global
```

Or publish and install globally:

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
Boot time : 2026/3/20 10:30:00
Uptime    : 35d 18h 12m 54s
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

## Development

```bash
pnpm install
pnpm run build       # build once
pnpm run dev         # watch mode
```

## License

MIT
