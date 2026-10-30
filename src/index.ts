#!/usr/bin/env node
import { Command } from 'commander'
import { version } from '../package.json'
import { registerUptimeCommand } from './commands/uptime.js'
import { registerSysCommand } from './commands/sys.js'

const program = new Command()
program.name('yyp').description('Personal CLI tool').version(version)
registerUptimeCommand(program)
registerSysCommand(program)
program.parseAsync()
