// 用假数据预览 `yyp uptime` / `yyp sys` 及其子命令的输出效果，覆盖绿 / 黄 / 红三档
// 直接复用 src/utils/format.ts 的渲染逻辑（Node >= 22.18 可直接加载 .ts），样式只需改一处
// 用法: pnpm preview [uptime|sys|sys-3disks|sys-5disks|cpu|mem|disk|gpu]

import { formatBytes, formatDate, formatDuration, joinParts, renderPanel, style, tone } from '../src/utils/format.ts'

const GiB = 1024 ** 3
const usage = (used, total) => `${formatBytes(used * GiB)} / ${formatBytes(total * GiB)}`
const heading = (title, ...extra) => joinParts([style('bold', title), ...extra.map((part) => tone.muted(part))])

// ---------- 假数据 ----------
const bootDate = new Date('2026-10-26T09:54:46')
const uptimeSec = 4 * 86400 + 5 * 3600 + 10 * 60 + 7
const cpuSummary = joinParts(['Apple M2 Pro', '10 cores (6P + 4E)', 'arm64'])
const gpuSummary = joinParts(['Apple M2 Pro', '16 cores', 'Metal 4'])
const perCore = [0.92, 0.88, 0.71, 0.64, 0.45, 0.38, 0.22, 0.15, 0.04, 0]

// [name, mount, used GiB, total GiB]
const disks = [
  ['system', '/', 428.2, 460.4],
  ['Backup', '/Volumes/Backup', 578.1, 1863],
  ['USB', '/Volumes/USB', 57.9, 59.6],
  ['Photos', '/Volumes/Photos', 1210.5, 1863],
  ['Time Machine', '/Volumes/Time Machine', 2104.7, 3726],
]
const diskRow = ([name, mount, used, total], label = name) => ({ label, ratio: used / total, detail: usage(used, total), note: mount })

/** Same rules as overviewDiskMeters() in src/commands/sys.ts. */
const overviewDisks = (list) => [
  ...list.slice(0, 3).map((disk, i) => {
    const { note, ...row } = diskRow(disk, i === 0 ? 'disk' : ` ${disk[0]}`)
    return row
  }),
  ...(list.length > 3 ? [{ label: '', value: tone.muted(`+${list.length - 3} more · yyp sys disk`) }] : []),
]

const overview = (diskList) => () =>
  renderPanel(heading('yyp-mbp', 'macOS 27.0.1', `up ${formatDuration(uptimeSec, false)}`), [
    [
      { label: 'cpu', ratio: 0.206, detail: 'load 2.88 / 10 cores' },
      { label: 'memory', ratio: 0.72, detail: `${usage(11.5, 16)} · swap ${formatBytes(2.1 * GiB)}` },
      ...overviewDisks(diskList),
    ],
    [
      { label: 'CPU', value: cpuSummary },
      { label: 'GPU', value: gpuSummary },
    ],
  ])

const previews = {
  uptime: () =>
    renderPanel(null, [[
      { label: 'Boot time', value: style('cyan', formatDate(bootDate)) },
      { label: 'Uptime', value: style('green', formatDuration(uptimeSec)) },
    ]]),

  sys: overview(disks.slice(0, 1)),
  'sys-3disks': overview(disks.slice(0, 3)),
  'sys-5disks': overview(disks),

  cpu: () =>
    renderPanel(heading('CPU', 'Apple M2 Pro', '2.40 GHz'), [
      [{ label: 'cpu', ratio: 0.439, detail: 'load 2.88 2.69 2.74 (1m 5m 15m) / 10 cores' }],
      perCore.map((ratio, i) => ({ label: `core ${i}`, ratio })),
      [{ label: 'CPU', value: cpuSummary }],
    ]),

  mem: () =>
    renderPanel(heading('Memory', `${formatBytes(16 * GiB)} total`), [
      [
        { label: 'memory', ratio: 0.846, detail: usage(13.5, 16) },
        { label: 'swap', ratio: 0.875, detail: usage(11.4, 13) },
      ],
      [{ label: 'Available', value: style('green', formatBytes(2.5 * GiB)) }],
    ]),

  disk: () =>
    renderPanel(heading('Disk', `${disks.length} mounted`), [disks.map((disk) => diskRow(disk))]),

  gpu: () =>
    renderPanel(heading('GPU', '1 detected'), [[{ label: 'GPU', value: gpuSummary }]]),
}

const pick = process.argv[2]
const entries = Object.entries(previews).filter(([name]) => !pick || name === pick)
if (!entries.length) {
  console.error(`Unknown preview "${pick}". Available: ${Object.keys(previews).join(', ')}`)
  process.exit(1)
}

for (const [name, render] of entries) {
  const [base, variant] = name.split('-')
  const command = base === 'uptime' || base === 'sys' ? base : `sys ${base}`
  console.log(`\n${tone.frame(`$ yyp ${command}`)}${variant ? tone.track(`  # ${variant}`) : ''}\n`)
  console.log(render())
}
console.log()
