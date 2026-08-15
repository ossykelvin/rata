const { readdirSync, statSync } = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const roots = ['electron', 'packages', 'tests']

function collect(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) return collect(target)
    return entry.isFile() && target.endsWith('.cjs') ? [target] : []
  })
}

const files = roots.filter(root => statSync(root).isDirectory()).flatMap(collect)
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status || 1)
}

console.log(`Checked ${files.length} CommonJS files.`)
