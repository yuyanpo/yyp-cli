import { Command } from 'commander'
import { version } from '../package.json'
import { registerUptimeCommand } from './commands/uptime.js'
import { registerSysCommand } from './commands/sys.js'
import { renderBanner } from './utils/banner.js'

const program = new Command()
program.name('yyp').description('Personal CLI tool').version(version)
program.addHelpText('before', renderBanner())
registerUptimeCommand(program)
registerSysCommand(program)
await program.parseAsync()
