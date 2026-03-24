// 快速调试 formatDate 输出格式
// 用法: node scripts/test-format.mjs

import chalk from 'chalk'
import boxen from 'boxen'

function formatDate(date) {
  const pad = (n, len = 2) => String(n).padStart(len, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  )
}

function formatUptime(days, hours, minutes, seconds) {
  return [
    days    ? chalk.green(`${days}`)    + chalk.dim('d') : '',
    hours   ? chalk.green(`${hours}`)   + chalk.dim('h') : '',
    minutes ? chalk.green(`${minutes}`) + chalk.dim('m') : '',
    chalk.green(`${seconds}`) + chalk.dim('s'),
  ]
    .filter(Boolean)
    .join(chalk.dim(' '))
}

// 静态测试数据
const bootDate = new Date('2026-03-15T13:25:23')
const days = 0, hours = 3, minutes = 28, seconds = 47

const content = [
  `${chalk.gray('Boot time: ')} ${chalk.cyan(formatDate(bootDate))}`,
  `${chalk.gray('Uptime   : ')} ${formatUptime(days, hours, minutes, seconds)}`,
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
