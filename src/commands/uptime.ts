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
