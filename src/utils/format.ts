import { styleText, stripVTControlCharacters } from 'node:util'

export type Style = Parameters<typeof styleText>[0]

export const style = (format: Style, text: string | number) => styleText(format, String(text))

// styleText already honors TTY / NO_COLOR / FORCE_COLOR, so reuse its decision.
const colorEnabled = style('red', 'x') !== 'x'
const has256 = colorEnabled && (!process.stdout.isTTY || process.stdout.getColorDepth() >= 8)

/** 256-color gray, falling back to the closest 16-color style. */
function gray(code: number, fallback: Style) {
  return (text: string) =>
    has256 ? `\x1b[38;5;${code}m${text}\x1b[39m` : style(fallback, text)
}

/** Neutral tones: bar track, brackets / rules / separators, secondary text. */
export const tone = {
  track: gray(246, 'gray'),
  frame: gray(248, 'gray'),
  muted: gray(254, 'white'),
}

const BAR_WIDTH = 24
const BAR_CHAR = '■'
const UNITS = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB']

export function formatBytes(bytes: number): string {
  let value = bytes
  let i = 0
  while (value >= 1024 && i < UNITS.length - 1) {
    value /= 1024
    i++
  }
  return `${i === 0 ? value : value.toFixed(1)} ${UNITS[i]}`
}

export function formatDate(date: Date): string {
  const pad = (n: number, len = 2) => String(n).padStart(len, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  )
}

export function splitDuration(totalSec: number) {
  return {
    days: Math.floor(totalSec / 86400),
    hours: Math.floor((totalSec % 86400) / 3600),
    minutes: Math.floor((totalSec % 3600) / 60),
    seconds: totalSec % 60,
  }
}

/** "4d 4h 24m 7s"; leading zero units are dropped. */
export function formatDuration(totalSec: number, withSeconds = true): string {
  const { days, hours, minutes, seconds } = splitDuration(totalSec)
  const parts = [
    days && `${days}d`,
    (days || hours) && `${hours}h`,
    (days || hours || minutes || !withSeconds) && `${minutes}m`,
    withSeconds && `${seconds}s`,
  ]
  return parts.filter(Boolean).join(' ')
}

export const percent = (ratio: number) => Math.round(ratio * 1000) / 10

/** Join value segments with a separator, skipping empty ones. */
export const joinParts = (parts: (string | undefined | false)[]) =>
  parts.filter(Boolean).join(tone.frame(' · '))

export type Row =
  | { label: string; value: string }
  | { label: string; ratio: number; detail?: string; note?: string }

function levelColor(ratio: number): 'red' | 'yellow' | 'green' {
  if (ratio >= 0.85) return 'red'
  if (ratio >= 0.6) return 'yellow'
  return 'green'
}

/** detailWidth aligns the trailing `note` column across rows of the same section. */
function renderRow(row: Row, labelWidth: number, detailWidth: number): string {
  const label = row.label.padEnd(labelWidth)
  if (!('ratio' in row)) return `${style('blue', label)}  ${row.value}`

  const color = levelColor(row.ratio)
  const clamped = Math.min(Math.max(row.ratio, 0), 1)
  const filled = Math.round(clamped * BAR_WIDTH)
  const bar =
    tone.frame('[') +
    style(color, BAR_CHAR.repeat(filled)) +
    tone.track(BAR_CHAR.repeat(BAR_WIDTH - filled)) +
    tone.frame(']')
  const pct = `${percent(clamped).toFixed(1)}%`.padStart(6)
  const detail = tone.muted((row.detail ?? '').padEnd(row.note ? detailWidth : 0))
  const note = row.note ? `  ${tone.frame(row.note)}` : ''
  return `${style(color, label)}  ${bar} ${style(color, pct)}  ${detail}${note}`.trimEnd()
}

const visibleWidth = (text: string) => stripVTControlCharacters(text).length

/**
 * Borderless panel: optional header line, then sections of rows separated by
 * horizontal rules. Labels are aligned across all sections.
 */
export function renderPanel(header: string | null, sections: Row[][]): string {
  const nonEmpty = sections.filter((rows) => rows.length)
  const labelWidth = Math.max(...nonEmpty.flat().map((row) => row.label.length))
  const blocks = nonEmpty.map((rows) => {
    const detailWidth = Math.max(0, ...rows.map((row) => ('detail' in row && row.detail?.length) || 0))
    return rows.map((row) => renderRow(row, labelWidth, detailWidth))
  })
  const lines = [...(header ? [header] : []), ...blocks.flat()]
  const rule = tone.frame('─'.repeat(Math.max(40, ...lines.map(visibleWidth))))

  const out = header ? [header, rule] : []
  blocks.forEach((block, i) => {
    if (i > 0) out.push(rule)
    out.push(...block)
  })
  return out.map((line) => `  ${line}`).join('\n')
}
