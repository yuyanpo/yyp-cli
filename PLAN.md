# Plan: yyp-cli — TypeScript CLI with Boot Time Feature

## Context

Build a TypeScript CLI tool from scratch. The first feature is `yyp uptime` — display system boot time and uptime in days/hours/minutes/seconds, with colored output via chalk.

**Tech choices:**
- Package manager: **pnpm**
- Bundler: **tsdown** (powered by Rolldown, modern tsup alternative)
- CLI framework: **commander**
- Color output: **chalk** (v5, ESM — tsdown bundles it into CJS correctly)
- Shebang: written directly in `src/index.ts` (TypeScript 3.5+ supports it; tsdown/rolldown preserves it)

---

## Directory Structure

```
yyp-cli/
├── package.json
├── tsconfig.json
├── tsdown.config.ts
├── .gitignore
├── .npmignore
├── src/
│   ├── index.ts              # CLI entry point (shebang + commander wiring)
│   └── commands/
│       └── uptime.ts         # Boot time / uptime logic with chalk colors
```

---

## Files to Create

### `package.json`
```json
{
  "name": "yyp-cli",
  "version": "0.1.0",
  "description": "A personal CLI tool",
  "main": "dist/index.cjs",
  "bin": { "yyp": "dist/index.cjs" },
  "scripts": {
    "build": "tsdown",
    "dev": "tsdown --watch",
    "prepublishOnly": "pnpm run build"
  },
  "files": ["dist"],
  "engines": { "node": ">=18" },
  "author": "yuyanpo",
  "license": "MIT",
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsdown": "latest",
    "typescript": "^5.8.0"
  },
  "dependencies": {
    "chalk": "^5.4.1",
    "commander": "^14.0.0"
  }
}
```

### `tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "moduleResolution": "node",
    "rootDir": "src",
    "outDir": "dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### `tsdown.config.ts`
```ts
import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  format: 'cjs',
  target: 'node18',
  clean: true,
})
```

Note: tsdown does not yet have a `banner` option (issue #288). The shebang is placed directly in `src/index.ts` — tsdown/rolldown preserves shebang lines from the entry file.

### `src/index.ts`
```ts
#!/usr/bin/env node
import { Command } from 'commander'
import { registerUptimeCommand } from './commands/uptime.js'

const program = new Command()
program.name('yyp').description('Personal CLI tool').version('0.1.0')
registerUptimeCommand(program)
program.parse()
```

### `src/commands/uptime.ts`

Use `execSync('sysctl kern.boottime')` on macOS to get exact boot epoch. Use chalk to color the output:

```ts
import { execSync } from 'node:child_process'
import { Command } from 'commander'
import chalk from 'chalk'

interface BootInfo {
  bootDate: Date
  days: number
  hours: number
  minutes: number
  seconds: number
}

function getBootInfo(): BootInfo {
  const raw = execSync('sysctl kern.boottime', { encoding: 'utf8' })
  // Output: kern.boottime: { sec = 1770887470, usec = 247131 } ...
  const match = raw.match(/sec\s*=\s*(\d+)/)
  if (!match) throw new Error('Could not parse kern.boottime — macOS only')
  const bootSec = parseInt(match[1], 10)
  const total = Math.floor(Date.now() / 1000) - bootSec
  return {
    bootDate: new Date(bootSec * 1000),
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  }
}

export function registerUptimeCommand(program: Command): void {
  program
    .command('uptime')
    .description('Show system boot time and uptime')
    .option('--json', 'Output as JSON')
    .action((opts: { json?: boolean }) => {
      const info = getBootInfo()
      if (opts.json) {
        console.log(JSON.stringify({
          bootTime: info.bootDate.toISOString(),
          days: info.days, hours: info.hours,
          minutes: info.minutes, seconds: info.seconds,
        }, null, 2))
        return
      }
      console.log(
        chalk.bold('Boot time') + ' : ' +
        chalk.cyan(info.bootDate.toLocaleString())
      )
      console.log(
        chalk.bold('Uptime   ') + ' : ' +
        chalk.green(`${info.days}`) + chalk.dim('d ') +
        chalk.green(`${info.hours}`) + chalk.dim('h ') +
        chalk.green(`${info.minutes}`) + chalk.dim('m ') +
        chalk.green(`${info.seconds}`) + chalk.dim('s')
      )
    })
}
```

### `.gitignore`
```
node_modules/
dist/
*.tgz
```

### `.npmignore`
```
src/
tsconfig.json
tsdown.config.ts
```

---

## Implementation Order

1. Create all config files: `package.json`, `tsconfig.json`, `tsdown.config.ts`, `.gitignore`, `.npmignore`
2. Create `src/index.ts` and `src/commands/uptime.ts`
3. Run `pnpm install` → generates `pnpm-lock.yaml`
4. Run `pnpm run build` → produces `dist/index.cjs`
5. Verify shebang: `head -1 dist/index.cjs` should print `#!/usr/bin/env node`
6. Test: `pnpm link --global` → `yyp uptime` / `yyp uptime --json`

---

## Publish Workflow

```bash
# Bump version (creates git commit + tag automatically)
npm version patch   # 0.1.0 → 0.1.1

# Push and publish
git push && git push --tags
pnpm publish        # prepublishOnly runs build automatically

# Dry run to inspect what gets published
pnpm publish --dry-run
```

Note: pnpm uses `pnpm publish` and `pnpm link --global`. `npm version` still works for version bumping since it only touches `package.json`.

---

## Verification

```bash
pnpm run build
head -1 dist/index.cjs       # #!/usr/bin/env node
pnpm link --global
yyp --help
yyp uptime                   # colored output: Boot time + Uptime breakdown
yyp uptime --json            # raw JSON output
pnpm unlink --global yyp-cli
```
