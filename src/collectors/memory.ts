import os from 'node:os'
import { readFileSync } from 'node:fs'
import { run } from '../utils/exec.js'

export interface MemoryInfo {
  total: number
  used: number
  available: number
  swap: { total: number; used: number } | null
}

/**
 * os.freemem() on macOS only counts truly free pages, which makes memory look
 * almost always full. Mirror Activity Monitor instead:
 * used = app memory (anonymous - purgeable) + wired + compressed.
 */
function getDarwinMemory(total: number): MemoryInfo | null {
  const raw = run('vm_stat')
  if (!raw) return null
  const pageSize = Number(raw.match(/page size of (\d+) bytes/)?.[1] ?? 4096)
  const pages = (key: string) =>
    Number(raw.match(new RegExp(`${key}:\\s+(\\d+)`))?.[1] ?? 0) * pageSize

  const used = Math.min(
    pages('Anonymous pages') - pages('Pages purgeable') +
      pages('Pages wired down') + pages('Pages occupied by compressor'),
    total
  )

  // vm.swapusage: total = 6144.00M  used = 5226.25M  free = 917.75M  (encrypted)
  const swapRaw = run('sysctl', ['-n', 'vm.swapusage']) ?? ''
  const mb = (key: string) => Math.round(Number(swapRaw.match(new RegExp(`${key} = ([\\d.]+)M`))?.[1] ?? 0) * 1024 ** 2)
  const swapTotal = mb('total')

  return {
    total,
    used,
    available: total - used,
    swap: swapTotal ? { total: swapTotal, used: mb('used') } : null,
  }
}

function getLinuxMemory(): MemoryInfo | null {
  let raw: string
  try {
    raw = readFileSync('/proc/meminfo', 'utf8')
  } catch {
    return null
  }
  const kb = (key: string) => Number(raw.match(new RegExp(`^${key}:\\s+(\\d+)`, 'm'))?.[1] ?? 0) * 1024
  const total = kb('MemTotal')
  const available = kb('MemAvailable')
  const swapTotal = kb('SwapTotal')
  return {
    total,
    used: total - available,
    available,
    swap: swapTotal ? { total: swapTotal, used: swapTotal - kb('SwapFree') } : null,
  }
}

export function getMemoryInfo(): MemoryInfo {
  const total = os.totalmem()
  const info =
    process.platform === 'darwin' ? getDarwinMemory(total) :
    process.platform === 'linux' ? getLinuxMemory() :
    null
  if (info) return info

  const available = os.freemem()
  return { total, used: total - available, available, swap: null }
}
