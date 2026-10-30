import { Command } from 'commander'
import { getBootInfo } from '../collectors/boot.js'
import { formatDate, formatDuration, renderPanel, splitDuration, style } from '../utils/format.js'

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
          ...splitDuration(info.uptimeSec),
        }, null, 2))
        return
      }

      console.log(renderPanel(null, [[
        { label: 'Boot time', value: style('cyan', formatDate(info.bootDate)) },
        { label: 'Uptime', value: style('green', formatDuration(info.uptimeSec)) },
      ]]))
    })
}
