import os from 'node:os'

export interface BootInfo {
  bootDate: Date
  uptimeSec: number
}

/** os.uptime() reads kern.boottime / /proc/uptime / GetTickCount64 under the hood. */
export function getBootInfo(): BootInfo {
  const uptimeSec = Math.floor(os.uptime())
  const nowSec = Math.floor(Date.now() / 1000)
  return { bootDate: new Date((nowSec - uptimeSec) * 1000), uptimeSec }
}
