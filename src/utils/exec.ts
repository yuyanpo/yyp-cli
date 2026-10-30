import { execFileSync } from 'node:child_process'

/** Run a command and return stdout, or null if it is missing / fails / times out. */
export function run(file: string, args: string[] = []): string | null {
  try {
    return execFileSync(file, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000,
    })
  } catch {
    return null
  }
}

export function powershell(command: string): string | null {
  return run('powershell', ['-NoProfile', '-NonInteractive', '-Command', command])
}

/** PowerShell's ConvertTo-Json emits a bare object for a single result. */
export function parseJsonList<T>(raw: string | null): T[] {
  if (!raw?.trim()) return []
  try {
    const data = JSON.parse(raw)
    return Array.isArray(data) ? data : [data]
  } catch {
    return []
  }
}
