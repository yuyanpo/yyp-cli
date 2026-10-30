#!/usr/bin/env node
// Version gate: keep this file free of static imports and modern syntax so old
// Node versions reach the friendly message instead of a parse / import error.
// Keep in sync with "engines" in package.json.
const MIN_MAJOR = 22
const MIN_MINOR = 13

const [major, minor] = process.versions.node.split('.').map(Number)
if (major < MIN_MAJOR || (major === MIN_MAJOR && minor < MIN_MINOR)) {
  console.error(
    `yyp-cli requires Node.js >= ${MIN_MAJOR}.${MIN_MINOR}, but you are running ${process.versions.node}.\n` +
      'Please upgrade Node.js: https://nodejs.org'
  )
  process.exit(1)
}

await import('./cli.js')

export {}
