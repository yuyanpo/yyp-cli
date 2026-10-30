import { statfsSync } from 'node:fs'
import { run, powershell, parseJsonList } from '../utils/exec.js'

export interface DiskInfo {
  /** Volume name for display: "system" for the OS disk, otherwise the last path segment / drive letter. */
  name: string
  mount: string
  system: boolean
  total: number
  /** total - available: includes space reserved for root, so it matches what the user can actually use. */
  used: number
  available: number
}

function systemMount(): string {
  return process.platform === 'win32' ? `${process.env.SystemDrive ?? 'C:'}\\` : '/'
}

function toDisk(mount: string, total: number, available: number): DiskInfo {
  const system = mount.toLowerCase() === systemMount().toLowerCase()
  // "/Volumes/Backup" -> "Backup", "D:\" -> "D:"
  const name = system ? 'system' : mount.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || mount
  return { name, mount, system, total, used: total - available, available }
}

function getSystemDisk(): DiskInfo {
  const mount = systemMount()
  const { bsize, blocks, bavail } = statfsSync(mount)
  return toDisk(mount, blocks * bsize, bavail * bsize)
}

function isUserMount(device: string, mount: string): boolean {
  if (!device.startsWith('/dev/')) return false
  if (process.platform === 'darwin') {
    // APFS system volumes share the same container as /, only show / and external volumes.
    return mount === '/' || (mount.startsWith('/Volumes/') && mount !== '/Volumes/Recovery')
  }
  // Skip snap/loop images and small boot / EFI partitions.
  return !device.startsWith('/dev/loop') && !/^\/(boot|efi|snap)(\/|$)/.test(mount)
}

function getPosixDisks(): DiskInfo[] {
  const raw = run('df', ['-kP'])
  if (!raw) return []
  const seen = new Set<string>()
  const disks: DiskInfo[] = []
  for (const line of raw.trim().split('\n').slice(1)) {
    // Filesystem 1024-blocks Used Available Capacity Mounted-on (mount may contain spaces)
    const match = line.match(/^(\S+)\s+(\d+)\s+\d+\s+(\d+)\s+\d+%\s+(.+)$/)
    if (!match) continue
    const [, device, blocks, avail, mount] = match
    if (!isUserMount(device, mount) || seen.has(device)) continue
    seen.add(device)
    disks.push(toDisk(mount, Number(blocks) * 1024, Number(avail) * 1024))
  }
  return disks
}

function getWindowsDisks(): DiskInfo[] {
  const raw = powershell(
    'Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | Select-Object DeviceID,Size,FreeSpace | ConvertTo-Json'
  )
  return parseJsonList<{ DeviceID: string; Size: number; FreeSpace: number }>(raw)
    .filter((d) => d.Size)
    .map((d) => toDisk(`${d.DeviceID}\\`, d.Size, d.FreeSpace))
}

/** All user-visible disks, system disk first. */
export function getDisks(): DiskInfo[] {
  const disks = process.platform === 'win32' ? getWindowsDisks() : getPosixDisks()
  if (!disks.some((disk) => disk.system)) disks.unshift(getSystemDisk())
  return disks.sort((a, b) => Number(b.system) - Number(a.system))
}
