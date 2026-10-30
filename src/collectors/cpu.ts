import os from 'node:os'
import { setTimeout as sleep } from 'node:timers/promises'
import { run } from '../utils/exec.js'

export interface CpuInfo {
  model: string
  arch: string
  cores: number
  /** Apple Silicon performance / efficiency core split. */
  coreTypes: { performance: number; efficiency: number } | null
  speedMHz: number
  /** Overall usage over the sample window, 0..1. */
  usage: number
  perCore: number[]
  /** 1/5/15 min load average; null on Windows where it is always 0. */
  loadavg: number[] | null
}

function snapshot() {
  return os.cpus().map(({ times }) => {
    const total = times.user + times.nice + times.sys + times.idle + times.irq
    return { idle: times.idle, total }
  })
}

async function sampleUsage(ms: number) {
  const start = snapshot()
  await sleep(ms)
  const end = snapshot()
  let idle = 0
  let total = 0
  const perCore = end.map((e, i) => {
    const dIdle = e.idle - start[i].idle
    const dTotal = e.total - start[i].total
    idle += dIdle
    total += dTotal
    return dTotal > 0 ? 1 - dIdle / dTotal : 0
  })
  return { usage: total > 0 ? 1 - idle / total : 0, perCore }
}

function getCoreTypes(): CpuInfo['coreTypes'] {
  if (process.platform !== 'darwin') return null
  const raw = run('sysctl', ['-n', 'hw.perflevel0.physicalcpu', 'hw.perflevel1.physicalcpu'])
  const [performance, efficiency] = raw?.trim().split('\n').map(Number) ?? []
  return performance && efficiency ? { performance, efficiency } : null
}

export async function getCpuInfo(sampleMs = 250): Promise<CpuInfo> {
  const cpus = os.cpus()
  const { usage, perCore } = await sampleUsage(sampleMs)
  return {
    model: cpus[0]?.model.replace(/\s+/g, ' ').trim() || 'Unknown CPU',
    arch: os.arch(),
    cores: cpus.length,
    coreTypes: getCoreTypes(),
    speedMHz: cpus[0]?.speed ?? 0,
    usage,
    perCore,
    loadavg: process.platform === 'win32' ? null : os.loadavg(),
  }
}
