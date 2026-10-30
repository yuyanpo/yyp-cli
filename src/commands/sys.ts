import { Command } from 'commander'
import { getBootInfo } from '../collectors/boot.js'
import { getCpuInfo, type CpuInfo } from '../collectors/cpu.js'
import { getDisks, type DiskInfo } from '../collectors/disk.js'
import { getGpuInfo, type GpuInfo } from '../collectors/gpu.js'
import { getHostInfo } from '../collectors/host.js'
import { getMemoryInfo, type MemoryInfo } from '../collectors/memory.js'
import {
  formatBytes, formatDate, formatDuration, joinParts, percent,
  renderPanel, style, tone, type Row,
} from '../utils/format.js'

// ---------- rows ----------

function cpuSummary(cpu: CpuInfo): string {
  const split = cpu.coreTypes ? ` (${cpu.coreTypes.performance}P + ${cpu.coreTypes.efficiency}E)` : ''
  return joinParts([cpu.model, `${cpu.cores} cores${split}`, cpu.arch])
}

const usage = (used: number, total: number) => `${formatBytes(used)} / ${formatBytes(total)}`

/** Load average is only meaningful relative to the core count. */
function cpuMeter(cpu: CpuInfo, fullLoad = false): Row {
  if (!cpu.loadavg) return { label: 'cpu', ratio: cpu.usage, detail: `${cpu.cores} cores` }
  const load = fullLoad
    ? `load ${cpu.loadavg.map((n) => n.toFixed(2)).join(' ')} (1m 5m 15m)`
    : `load ${cpu.loadavg[0].toFixed(2)}`
  return { label: 'cpu', ratio: cpu.usage, detail: `${load} / ${cpu.cores} cores` }
}

function memoryMeter(mem: MemoryInfo): Row {
  const swap = mem.swap?.used ? ` · swap ${formatBytes(mem.swap.used)}` : ''
  return { label: 'memory', ratio: mem.used / mem.total, detail: usage(mem.used, mem.total) + swap }
}

function swapMeter(mem: MemoryInfo): Row[] {
  if (!mem.swap) return []
  return [{ label: 'swap', ratio: mem.swap.used / mem.swap.total, detail: usage(mem.swap.used, mem.swap.total) }]
}

function diskMeter(disk: DiskInfo, label = disk.name): Row {
  return { label, ratio: disk.used / disk.total, detail: usage(disk.used, disk.total) }
}

const OVERVIEW_DISKS = 3

/** System disk as "disk", other disks indented under it; extras fold into a hint. */
function overviewDiskMeters(disks: DiskInfo[]): Row[] {
  const rows = disks
    .slice(0, OVERVIEW_DISKS)
    .map((disk, i) => diskMeter(disk, i === 0 ? 'disk' : ` ${disk.name}`))
  const hidden = disks.length - OVERVIEW_DISKS
  if (hidden > 0) rows.push({ label: '', value: tone.muted(`+${hidden} more · yyp sys disk`) })
  return rows
}

function gpuRows(gpus: GpuInfo[]): Row[] {
  if (!gpus.length) return [{ label: 'GPU', value: tone.muted('not detected') }]
  return gpus.map((gpu, i) => ({
    label: i === 0 ? 'GPU' : '',
    value: joinParts([
      gpu.name,
      gpu.cores ? `${gpu.cores} cores` : undefined,
      gpu.api,
      gpu.vram && !gpu.vram.used && formatBytes(gpu.vram.total),
    ]),
  }))
}

function gpuMeters(gpus: GpuInfo[]): Row[] {
  return gpus.flatMap((gpu, i) => {
    const suffix = gpus.length > 1 ? ` ${i}` : ''
    const rows: Row[] = []
    if (gpu.utilization !== undefined) {
      rows.push({ label: `gpu${suffix}`, ratio: gpu.utilization })
    }
    if (gpu.vram?.used !== undefined) {
      rows.push({
        label: `vram${suffix}`,
        ratio: gpu.vram.used / gpu.vram.total,
        detail: usage(gpu.vram.used, gpu.vram.total),
      })
    }
    return rows
  })
}

// ---------- json ----------

const cpuJson = (cpu: CpuInfo) => ({
  ...cpu,
  usage: percent(cpu.usage),
  perCore: cpu.perCore.map(percent),
  loadavg: cpu.loadavg?.map((n) => Math.round(n * 100) / 100) ?? null,
})

const usageJson = <T extends { used: number; total: number }>(item: T) => ({
  ...item,
  usage: percent(item.used / item.total),
})

const memoryJson = (mem: MemoryInfo) => ({
  ...usageJson(mem),
  swap: mem.swap && usageJson(mem.swap),
})

const gpuJson = (gpu: GpuInfo) => ({
  ...gpu,
  utilization: gpu.utilization === undefined ? undefined : percent(gpu.utilization),
})

// ---------- output ----------

function print(json: boolean | undefined, data: unknown, header: string, sections: Row[][]): void {
  console.log(json ? JSON.stringify(data, null, 2) : renderPanel(header, sections))
}

const isJson = (cmd: Command): boolean | undefined => cmd.optsWithGlobals().json

const heading = (title: string, ...extra: (string | undefined | false)[]) =>
  joinParts([style('bold', title), ...extra.map((part) => part && tone.muted(part))])

export function registerSysCommand(program: Command): void {
  const sys = program
    .command('sys')
    .description('Show hardware overview: CPU, GPU, memory, disk')
    .option('--json', 'Output as JSON')
    .action(async (opts: { json?: boolean }) => {
      const cpu = await getCpuInfo()
      const gpus = getGpuInfo()
      const mem = getMemoryInfo()
      const disks = getDisks()
      const boot = getBootInfo()
      const host = getHostInfo()

      print(
        opts.json,
        {
          host,
          cpu: cpuJson(cpu),
          gpu: gpus.map(gpuJson),
          memory: memoryJson(mem),
          disks: disks.map(usageJson),
          uptime: { bootTime: boot.bootDate.toISOString(), seconds: boot.uptimeSec },
        },
        heading(host.hostname, host.os, `up ${formatDuration(boot.uptimeSec, false)}`),
        [
          [cpuMeter(cpu), memoryMeter(mem), ...overviewDiskMeters(disks), ...gpuMeters(gpus)],
          [{ label: 'CPU', value: cpuSummary(cpu) }, ...gpuRows(gpus)],
        ]
      )
    })

  sys
    .command('cpu')
    .description('Show CPU details and per-core usage')
    .action(async (_opts, cmd: Command) => {
      const cpu = await getCpuInfo(500)
      print(isJson(cmd), cpuJson(cpu), heading('CPU', cpu.model, cpu.speedMHz > 0 && `${(cpu.speedMHz / 1000).toFixed(2)} GHz`), [
        [cpuMeter(cpu, true)],
        cpu.perCore.map((ratio, i) => ({ label: `core ${i}`, ratio })),
        [{ label: 'CPU', value: cpuSummary(cpu) }],
      ])
    })

  sys
    .command('gpu')
    .description('Show GPU details')
    .action((_opts, cmd: Command) => {
      const gpus = getGpuInfo()
      print(isJson(cmd), gpus.map(gpuJson), heading('GPU', `${gpus.length} detected`), [gpuMeters(gpus), gpuRows(gpus)])
    })

  sys
    .command('mem')
    .description('Show memory and swap usage')
    .action((_opts, cmd: Command) => {
      const mem = getMemoryInfo()
      print(isJson(cmd), memoryJson(mem), heading('Memory', `${formatBytes(mem.total)} total`), [
        [{ ...memoryMeter(mem), detail: usage(mem.used, mem.total) }, ...swapMeter(mem)],
        [{ label: 'Available', value: style('green', formatBytes(mem.available)) }],
      ])
    })

  sys
    .command('disk')
    .description('Show usage of mounted disks')
    .action((_opts, cmd: Command) => {
      const disks = getDisks()
      print(isJson(cmd), disks.map(usageJson), heading('Disk', `${disks.length} mounted`), [
        disks.map((disk) => ({ ...diskMeter(disk), note: disk.mount })),
      ])
    })
}
