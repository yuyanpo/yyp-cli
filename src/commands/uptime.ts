import { execSync, execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { Command } from 'commander'
import chalk from 'chalk'
import boxen from 'boxen'

interface BootInfo {
  bootDate: Date
  days: number
  hours: number
  minutes: number
  seconds: number
}

function getBootSec(): number {
  const platform = process.platform

  if (platform === 'darwin') {
    const raw = execSync('sysctl kern.boottime', { encoding: 'utf8' })
    const match = raw.match(/sec\s*=\s*(\d+)/)
    if (!match) throw new Error('Could not parse kern.boottime')
    return parseInt(match[1], 10)
  }

  if (platform === 'linux') {
    const raw = readFileSync('/proc/uptime', 'utf8')
    const uptimeSec = parseFloat(raw.split(' ')[0])
    return Math.floor(Date.now() / 1000 - uptimeSec)
  }

  if (platform === 'win32') {
    const raw = execFileSync('wmic', ['os', 'get', 'LastBootUpTime'], { encoding: 'utf8' })
    // Format: 20260320103000.000000+480
    const match = raw.match(/(\d{14})/)
    if (!match) throw new Error('Could not parse LastBootUpTime')
    const s = match[1]
    const date = new Date(
      `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T` +
      `${s.slice(8, 10)}:${s.slice(10, 12)}:${s.slice(12, 14)}`
    )
    return Math.floor(date.getTime() / 1000)
  }

  throw new Error(`Unsupported platform: ${platform}`)
}

function formatDate(date: Date): string {
  const pad = (n: number, len = 2) => String(n).padStart(len, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  )
}

function formatUptime(days: number, hours: number, minutes: number, seconds: number): string {
  return (
    [
      days    ? chalk.green(`${days}`)    + chalk.dim('d') : '',
      hours   ? chalk.green(`${hours}`)   + chalk.dim('h') : '',
      minutes ? chalk.green(`${minutes}`) + chalk.dim('m') : '',
      chalk.green(`${seconds}`) + chalk.dim('s'),
    ]
      .filter(Boolean)
      .join(chalk.dim(' '))
  )
}

function getBootInfo(): BootInfo {
  const bootSec = getBootSec()
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

      const content = [
        `${chalk.gray('Boot time: ')} ${chalk.cyan(formatDate(info.bootDate))}`,
        `${chalk.gray('Uptime   : ')} ${formatUptime(info.days, info.hours, info.minutes, info.seconds)}`,
      ].join('\n\n')

      console.log(
        boxen(content, {
          title: chalk.bold.gray('💻 System Status'),
          titleAlignment: 'center',
          padding: { top: 1, bottom: 1, left: 2, right: 2 },
          borderStyle: 'round',
          borderColor: 'gray',
        })
      )
    })
}
