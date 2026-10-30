import { run, powershell, parseJsonList } from '../utils/exec.js'

export interface GpuInfo {
  name: string
  vendor?: string
  cores?: number
  /** e.g. "Metal 4" on macOS, driver version on Windows. */
  api?: string
  vram?: { total: number; used?: number }
  /** 0..1, only available via nvidia-smi. */
  utilization?: number
}

function parseSize(text?: string): number | undefined {
  const match = text?.match(/([\d.]+)\s*(MB|GB)/i)
  if (!match) return undefined
  return Number(match[1]) * 1024 ** (match[2].toUpperCase() === 'GB' ? 3 : 2)
}

interface SPDisplay {
  sppci_model?: string
  _name?: string
  spdisplays_vendor?: string
  sppci_cores?: string
  spdisplays_mtlgpufamilysupport?: string
  spdisplays_vram?: string
  spdisplays_vram_shared?: string
}

function getDarwinGpus(): GpuInfo[] {
  const raw = run('system_profiler', ['SPDisplaysDataType', '-json'])
  if (!raw) return []
  const list: SPDisplay[] = JSON.parse(raw).SPDisplaysDataType ?? []
  return list.map((gpu) => {
    const vram = parseSize(gpu.spdisplays_vram ?? gpu.spdisplays_vram_shared)
    return {
      name: gpu.sppci_model ?? gpu._name ?? 'Unknown GPU',
      vendor: gpu.spdisplays_vendor?.replace(/^sppci_vendor_/, ''),
      cores: gpu.sppci_cores ? Number(gpu.sppci_cores) : undefined,
      // spdisplays_metal4 -> Metal 4
      api: gpu.spdisplays_mtlgpufamilysupport?.replace(/^spdisplays_metal/, 'Metal '),
      vram: vram ? { total: vram } : undefined,
    }
  })
}

function getNvidiaGpus(): GpuInfo[] {
  const raw = run('nvidia-smi', [
    '--query-gpu=name,memory.total,memory.used,utilization.gpu',
    '--format=csv,noheader,nounits',
  ])
  if (!raw) return []
  return raw.trim().split('\n').map((line) => {
    const [name, total, used, util] = line.split(',').map((s) => s.trim())
    return {
      name,
      vendor: 'NVIDIA',
      vram: { total: Number(total) * 1024 ** 2, used: Number(used) * 1024 ** 2 },
      utilization: Number(util) / 100,
    }
  })
}

function getLinuxGpus(): GpuInfo[] {
  const nvidia = getNvidiaGpus()
  if (nvidia.length) return nvidia
  const raw = run('lspci') ?? ''
  // 01:00.0 VGA compatible controller: NVIDIA Corporation GA102 [GeForce RTX 3080] (rev a1)
  return raw
    .split('\n')
    .filter((line) => /VGA|3D controller|Display controller/.test(line))
    .map((line) => ({ name: line.replace(/^.*?controller:\s*/, '').replace(/\s*\(rev \w+\)$/, '') }))
}

function getWindowsGpus(): GpuInfo[] {
  const raw = powershell(
    'Get-CimInstance Win32_VideoController | Select-Object Name,AdapterCompatibility,AdapterRAM,DriverVersion | ConvertTo-Json'
  )
  return parseJsonList<{ Name: string; AdapterCompatibility?: string; AdapterRAM?: number; DriverVersion?: string }>(raw)
    .map((gpu) => ({
      name: gpu.Name,
      vendor: gpu.AdapterCompatibility,
      api: gpu.DriverVersion ? `Driver ${gpu.DriverVersion}` : undefined,
      // AdapterRAM is a uint32 and caps at 4 GiB.
      vram: gpu.AdapterRAM ? { total: gpu.AdapterRAM } : undefined,
    }))
}

export function getGpuInfo(): GpuInfo[] {
  try {
    if (process.platform === 'darwin') return getDarwinGpus()
    if (process.platform === 'linux') return getLinuxGpus()
    if (process.platform === 'win32') return getWindowsGpus()
  } catch {
    // Unparsable output: treat as no GPU info.
  }
  return []
}
