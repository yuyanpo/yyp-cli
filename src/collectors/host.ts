import os from 'node:os'
import { readFileSync } from 'node:fs'
import { run } from '../utils/exec.js'

export interface HostInfo {
  hostname: string
  os: string
}

function osName(): string {
  if (process.platform === 'darwin') {
    const version = run('sw_vers', ['-productVersion'])?.trim()
    return version ? `macOS ${version}` : 'macOS'
  }
  if (process.platform === 'linux') {
    try {
      const release = readFileSync('/etc/os-release', 'utf8')
      const name = release.match(/^PRETTY_NAME="?([^"\n]+)"?/m)?.[1]
      if (name) return name
    } catch {
      // Fall through to os.version().
    }
  }
  // Windows: "Windows 11 Pro"
  return os.version()
}

export function getHostInfo(): HostInfo {
  return {
    hostname: os.hostname().replace(/\.local$/, ''),
    os: osName(),
  }
}
